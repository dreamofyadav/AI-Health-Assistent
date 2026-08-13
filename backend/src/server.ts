import 'dotenv/config';
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import gTTS from 'gtts';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { CallSession } from './types';
import { getNextAIResponse } from './services/aiPipeline';
import { generateReport } from './services/reportGenerator';

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Health Voice AI backend is running",
    websocket: "/",
  });
});

app.get("/api/tts", (req, res) => {
  try {
    const text = (req.query.text as string) || "";
    if (!text.trim()) {
      return res.status(400).send("Text query parameter is required.");
    }

    const isHindi = /[\u0900-\u097F]/.test(text);
    const lang = isHindi ? "hi" : "en";

    const gtts = new gTTS(text, lang);
    const tempFilePath = path.join(os.tmpdir(), `tts_${Date.now()}.mp3`);

    gtts.save(tempFilePath, (err:Error | undefined) => {
      if (err) {
        console.error("gTTS Save Error:", err);
        return res.status(500).send("Failed to generate speech");
      }

      res.sendFile(tempFilePath, (sendErr) => {
        if (sendErr) console.error("Error sending file:", sendErr);
        fs.unlink(tempFilePath, () => {});
      });
    });
  } catch (error) {
    console.error("gTTS Error:", error);
    res.status(500).send("Failed to generate audio");
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const activeSessions = new Map<WebSocket, CallSession>();

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');

  ws.on('message', async (data: string) => {
    try {
      const payload = JSON.parse(data.toString());

      if (payload.type === 'START_CALL') {
        const languagePref = payload.languagePref || 'en-US';

        const session: CallSession = {
          id: Date.now().toString(),
          history: [],
          status: 'active',
          startedAt: new Date(),
          languagePref, 
          isInterrupted: false,
        };
        activeSessions.set(ws, session);

        const initialGreeting = languagePref === 'hi-IN'
          ? "नमस्ते! मैं आपका डिजिटल हेल्थ असिस्टेंट हूँ। क्या आप अपना पूरा नाम और आज की अपनी स्वास्थ्य समस्या बता सकते हैं?"
          : "Hello! I'm your health intake assistant. May I start with your full name and what brings you in today?";

        session.history.push({ role: 'assistant', content: initialGreeting });

        ws.send(JSON.stringify({
          type: 'AI_RESPONSE',
          text: initialGreeting
        }));
      }

      if (payload.type === 'INTERRUPT') {
        const session = activeSessions.get(ws);
        if (session) {
          console.log(`⚡ Session ${session.id} interrupted by user.`);
          session.isInterrupted = true;
        }
        return;
      }

      if (payload.type === 'USER_SPEECH') {
        const session = activeSessions.get(ws);
        if (!session || session.status !== 'active') return;

        session.isInterrupted = false;

        const userText = payload.text;
        if (!userText?.trim()) return;

        session.history.push({ role: 'user', content: userText });

        const aiResponse = await getNextAIResponse(session.history);

        // Drop response if user barged in during Groq generation
        if (session.isInterrupted) {
          console.log("Discarded Groq response due to barge-in interrupt.");
          return;
        }

        session.history.push({ role: 'assistant', content: aiResponse });

        ws.send(JSON.stringify({
          type: 'AI_RESPONSE',
          text: aiResponse
        }));
      }

      if (payload.type === 'END_CALL') {
        const session = activeSessions.get(ws);
        if (session) {
          session.status = 'ended';
          const report = await generateReport(session.history);
          ws.send(JSON.stringify({ type: 'REPORT_READY', report }));
          activeSessions.delete(ws);
        }
      }
    } catch (err) {
      console.error('Socket error:', err);
    }
  });

  ws.on('close', () => {
    activeSessions.delete(ws);
  });
});

const PORT = process.env.PORT || 8082;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});