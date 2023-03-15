import React, { useState } from 'react';
import './ChatWindow.css';

const ChatWindow = () => {
  const [messages, setMessages] = useState([]);

  const handleSendMessage = (message) => {
    setMessages([...messages, { text: message, sender: 'user' }]);
    // Simulate bot response
    setMessages((prevMessages) => [
      ...prevMessages,
      { text: 'Bot response', sender: 'bot' },
    ]);
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
      </div>
    </div>
  );
};

export default ChatWindow;
