// Install dependencies: npm install express cors @google/generative-ai dotenv
// Create a .env file with: GEMINI_API_KEY=your_api_key_here

const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Store chat sessions (in production, use a database)
const chatSessions = new Map();

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'Middleware server is running' });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get or create chat session
    let chat;
    if (sessionId && chatSessions.has(sessionId)) {
      chat = chatSessions.get(sessionId);
    } else {
      // Start a new chat with history if provided
      const chatHistory = [];
      
      if (history && Array.isArray(history)) {
        // Convert history to Gemini format
        history.forEach((msg) => {
          if (msg.role === 'user') {
            chatHistory.push({
              role: 'user',
              parts: [{ text: msg.content }]
            });
          } else if (msg.role === 'assistant') {
            chatHistory.push({
              role: 'model',
              parts: [{ text: msg.content }]
            });
          }
        });
      }

      chat = model.startChat({
        history: chatHistory,
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.9,
        },
      });

      // Store the chat session
      const newSessionId = sessionId || Date.now().toString();
      chatSessions.set(newSessionId, chat);
    }

    // Send message and get response
    const result = await chat.sendMessage(message);
    const response = result.response;
    const text = response.text();

    res.json({
      response: text,
      sessionId: sessionId || Date.now().toString()
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Failed to get AI response',
      details: error.message
    });
  }
});

// Clear old sessions periodically (every hour)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [sessionId, _] of chatSessions.entries()) {
    if (parseInt(sessionId) < oneHourAgo) {
      chatSessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Middleware server running on port ${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/chat`);
});