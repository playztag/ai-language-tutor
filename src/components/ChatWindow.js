import React, { useState, useRef } from 'react';
import MicRecorder from 'mic-recorder-to-mp3';
import './ChatWindow.css';
import AWS from 'aws-sdk';

const Mp3Recorder = new MicRecorder({ bitRate: 128 });

const ChatWindow = () => {
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [language, setLanguage] = useState({ code: 'es-MX', voice: 'Mia' });
  const audioRef = useRef(null);

  const languages = [
    { name: 'English (US)', code: 'en-US', voice: 'Joanna' },
    { name: 'Spanish (Spain)', code: 'es-ES', voice: 'Conchita' },
    { name: 'Spanish (Mexico)', code: 'es-MX', voice: 'Mia' }, // Added Spanish for Mexico
    { name: 'Chinese (Mandarin)', code: 'zh-CN', voice: 'Zhiyu' },
    { name: 'French', code: 'fr-FR', voice: 'Celine' },
    { name: 'German', code: 'de-DE', voice: 'Hans' },
    { name: 'Italian', code: 'it-IT', voice: 'Carla' },
    { name: 'Portuguese (Brazil)', code: 'pt-BR', voice: 'Vitoria' },
    { name: 'Russian', code: 'ru-RU', voice: 'Tatyana' },
    { name: 'Japanese', code: 'ja-JP', voice: 'Mizuki' },
    { name: 'Korean', code: 'ko-KR', voice: 'Seoyeon' },
  ];

  async function chatgpt_api(input_text) {
    console.log("Language used:", language);
  
    const messages = [
      {
        role: "system",
        content: `You are a highly skilled and engaging ${language.name} tutor that helps me with my grammar and pronunciation while maintaining the context of our conversation. You will reply to me in ${language.name} and also provide an English translation.`,
      },
    ];
  
    if (input_text) {
      messages.push({
        role: "user",
        content: input_text,
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

  const synthesizeSpeech = async (text, voice) => {
    const polly = new AWS.Polly();
    const params = {
      OutputFormat: 'mp3',
      Text: `<speak><prosody rate="0.8">${text}</prosody></speak>`, // Adjust the rate value to your desired speed
      VoiceId: voice, // Use the selected Polly voice
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
    const replyAudioUrl = await synthesizeSpeech(reply, language.voice);
    setMessages((prevMessages) => [
      ...prevMessages,
      { text: reply, sender: 'bot', audioUrl: replyAudioUrl },
    ]);
  };

  const handleLanguageChange = (event) => {
    const selectedLanguage = languages.find(lang => lang.code === event.target.value);
    setLanguage({ code: selectedLanguage.code, voice: selectedLanguage.voice });
    console.log("Selected language:", selectedLanguage); // Add this line
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
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
  
        const audioBuffer = await fetch(audioUrl).then((response) => response.arrayBuffer());
        const decodedBuffer = await audioContext.decodeAudioData(audioBuffer);
  
        const audioSource = audioContext.createBufferSource();
        audioSource.buffer = decodedBuffer;
        audioSource.connect(audioContext.destination);
  
        audioSource.start(0);
  
        audioSource.addEventListener("ended", () => {
          console.log("Audio playback ended");
        });
  
        console.log("Audio playback started");
      } catch (error) {
        console.error("Audio playback error:", error);
      }
    }
  };
  

  return (

    <div className="chat-window">
      <h2>AI Language Tutor</h2>
      <div className="language-selector">
        <label htmlFor="language">Select a language:</label>
        <select
          id="language"
          value={language.code}
          onChange={handleLanguageChange}
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>
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
