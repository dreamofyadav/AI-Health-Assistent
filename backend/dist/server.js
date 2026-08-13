"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
// import dotenv from 'dotenv';
const cors_1 = __importDefault(require("cors"));
const aiPipeline_1 = require("./services/aiPipeline");
const reportGenerator_1 = require("./services/reportGenerator");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get("/", (req, res) => {
    res.json({
        ok: true,
        message: "Health Voice AI backend is running",
        websocket: "/",
    });
});
const server = http_1.default.createServer(app);
const wss = new ws_1.WebSocketServer({ server });
const activeSessions = new Map();
wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('message', async (data) => {
        try {
            const payload = JSON.parse(data.toString());
            if (payload.type === 'START_CALL') {
                const session = {
                    id: Date.now().toString(),
                    history: [],
                    status: 'active',
                    startedAt: new Date()
                };
                activeSessions.set(ws, session);
                const initialGreeting = "Hello! I'm your health intake assistant. May I start with your full name and what brings you in today?";
                session.history.push({ role: 'assistant', content: initialGreeting });
                ws.send(JSON.stringify({
                    type: 'AI_RESPONSE',
                    text: initialGreeting
                }));
            }
            if (payload.type === 'USER_SPEECH') {
                const session = activeSessions.get(ws);
                if (!session || session.status !== 'active')
                    return;
                const userText = payload.text;
                if (!userText?.trim())
                    return;
                session.history.push({ role: 'user', content: userText });
                // Get AI response via Groq
                const aiResponse = await (0, aiPipeline_1.getNextAIResponse)(session.history);
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
                    const report = await (0, reportGenerator_1.generateReport)(session.history);
                    ws.send(JSON.stringify({ type: 'REPORT_READY', report }));
                    activeSessions.delete(ws);
                }
            }
        }
        catch (err) {
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
