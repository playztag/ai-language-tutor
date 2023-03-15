import React, { useState } from 'react';
import MicRecorder from 'mic-recorder-to-mp3';
import openai from 'openai';
import './ChatWindow.css';

const Mp3Recorder = new MicRecorder({ bitRate: 128 });

const ChatWindow = () => {
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);

  const handleSendMessage = async (message) => {
    setMessages([...messages, { text: message, sender: 'user' }]);
    // Simulate bot response
    setMessages((prevMessages) => [
      ...prevMessages,
      { text: 'Bot response', sender: 'bot' },
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

      const transcription = await transcribeAudio(blob);
      if (transcription) {
        handleSendMessage(transcription);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const playAudio = (source) => {
    if (source) {
      const audio = new Audio(source);
      audio.play();
    }
  };

  return (
    <div className="chat-window">
      <h2>AI Language Tutor</h2>
      <div className="messages-container">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${
              message.sender === 'user' ? 'user-message' : 'bot-message'
            }`}
          >
            {message.text}
            {message.sender === 'user' && (
              <button
                className="btn btn-primary"
                onClick={() => playAudio(audioURL)}
              >
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
  