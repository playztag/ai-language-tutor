import React, { useState, useRef } from 'react';
import MicRecorder from 'mic-recorder-to-mp3';
import openai from 'openai';
import './ChatWindow.css';


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
  
  
  

  const handleSendMessage = async (message, audioUrl) => {
    setMessages([...messages, { text: message, sender: 'user', audioUrl }]);
    // Get bot response from ChatGPT API
    const reply = await chatgpt_api(message);
    setMessages((prevMessages) => [
      ...prevMessages,
      { text: reply, sender: 'bot' },
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
      playAudio();

      const transcription = await transcribeAudio(blob);
      if (transcription) {
        handleSendMessage(transcription, audioUrl);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const playAudio = async () => {
    if (audioURL) {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await fetch(audioURL).then(response => response.arrayBuffer());
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
            {message.sender === 'user' && (
  <button className="btn btn-primary" onClick={() => playAudio(message.audioUrl)}>
    Play
  </button>
)}
          </div>
        ))}
      </div>
      <div className="input-container">
        <input
          type="text"
          className="form-control"
          placeholder="Type your message here..."
          onKeyDown={(e) => {
            if (e.key ===
              'Enter') {
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
  