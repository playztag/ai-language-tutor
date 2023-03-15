import React from 'react';
import './Message.css';

const Message = ({ message }) => {
  const { type, content } = message;

  return (
    <div className={`message ${type === 'user' ? 'user-message' : 'bot-message'}`}>
      <p>{content}</p>
    </div>
  );
};

export { Message };
