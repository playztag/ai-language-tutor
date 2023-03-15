import React, { useState, useRef } from 'react';
import MicRecorder from 'mic-recorder-to-mp3';
import './ChatWindow.css';
import AWS from 'aws-sdk';

const Mp3Recorder = new MicRecorder({ bitRate: 128 });

const ChatWindow = () => {
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const audioRef = useRef(null);

  async function chatgpt_api(input_text) {
    const messages = [
      {
        role: "system",
        content:
          "You are a helpful Spanish tutor that helps me with my grammar",
      },
    ];

    if (input_text) {
      messages.push({
        role: "user",
        content: `You are a patient Spanish tutor (mexico), I will speak to you in English and Spanish, please reply back with the correct way it should be spoken in Spanish and give me a follow up response in both Spanish and its English translation so we can continue the conversation: "${input_text}"`,
      });

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: messages,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('OpenAI API Error:', errorData);
          throw new Error('Failed to get a response from the API');
        }

        const data = await response.json();
        const reply = data.choices[0].message.content;
        return reply;
      } catch (error) {
        console.error('Error calling OpenAI API:', error);
      }
    }
  }

  AWS.config.update({
    accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY,
    secretAccessKey: process.env.REACT_APP_AWS_SECRET_KEY,
    region: process.env.REACT_APP_AWS_REGION,
  });

  const synthesizeSpeech = async (text) => {
    const polly = new AWS.Polly();
    const params = {
      OutputFormat: 'mp3',
      Text: `<speak><prosody rate="0.8">${text}</prosody></speak>`, // Adjust the rate value to your desired speed
      VoiceId: 'Mia', // Choose a Spanish-speaking voice
      TextType: 'ssml' // Add this line to enable SSML
    };

    return new Promise((resolve, reject) => {
      polly.synthesizeSpeech(params, (err, data) => {
        if (err) {
          reject(err);
          return;
        }

        const audioDataURL = URL.createObjectURL(new Blob([data.AudioStream]));
        resolve(audioDataURL);
      });
    });
  };

  const handleSendMessage = async (message, audioUrl) => {
    setMessages([...messages, { text: message, sender: 'user', audioUrl }]);
    // Get bot response from ChatGPT API
    const reply = await chatgpt_api(message);
    const replyAudioUrl = await synthesizeSpeech(reply);
    setMessages((prevMessages) => [
      ...prevMessages,
      { text: reply, sender: 'bot', audioUrl: replyAudioUrl },
    ]);
  };

  const startRecording = async () => {
    try {
      await Mp3Recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const transcribeAudio = async (audioBlob) => {
   
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.mp3');
    formData.append('model', 'whisper-1');

    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Whisper API Error:', errorData);
        throw new Error('Failed to transcribe audio');
      }

      const data = await response.json();
      return data.text;
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  };

  const stopRecording = async () => {
    try {
      const [buffer, blob] = await Mp3Recorder.stop().getMp3();
      setIsRecording(false);

      const fileName = `tempRecordings/recording_${Date.now()}.mp3`;
      const file = new File(buffer, fileName, {
        type: blob.type,
        lastModified: Date.now(),
      });

      const audioUrl = URL.createObjectURL(file);
      setAudioURL(audioUrl);

      // Add this line
      playAudio(audioUrl);

      const transcription = await transcribeAudio(blob);
      if (transcription) {
        handleSendMessage(transcription, audioUrl);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const playAudio = async (audioUrl) => {
    if (audioUrl) {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await fetch(audioUrl).then(response => response.arrayBuffer());
        const decodedBuffer = await audioContext.decodeAudioData(audioBuffer);

        const audioSource = audioContext.createBufferSource();
        audioSource.buffer = decodedBuffer;
        audioSource.connect(audioContext.destination);

        audioSource.start(0);

        audioSource.addEventListener('ended', () => {
          console.log('Audio playback ended');
        });

        console.log('Audio playback started');
      } catch (error) {
        console.error('Audio playback error:', error);
      }
    }
  };

  return (
    <div className="chat-window">
      <h2>AI Language Tutor</h2>
      <div className="messages-container">
        <audio ref={audioRef}></audio>
        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${
              message.sender === 'user' ? 'user-message' : 'bot-message'
            }`}
          >
            {message.text}
            <button className="btn btn-primary" onClick={() => playAudio(message.audioUrl)}>
              Play
            </button>
          </div>
        ))}
      </div>
      <div className="input-container">
        <input
          type="text"
          className="form-control"
          placeholder="Type your message here..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSendMessage(e.target.value);
              e.target.value = '';
            }
          }}
        />
        <button
          className={`btn ${isRecording ? 'btn-danger' : 'btn-primary'}`}
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;
