# AI Health Screening Voice Assistant

An interactive, real-time, bilingual (English & Hindi) voice-powered medical intake assistant. Built with **React**, **Node.js**, **WebSockets**, **Groq (Llama 3.3 70B)**, and **gTTS (Google Text-to-Speech)**, this application conducts preliminary health screenings over a live voice call, captures symptoms, handles real-time user barge-in/interruptions, and generates a structured clinical report upon call completion.

---

## Key Features

- **Bilingual Support (English & Hindi)**: Supports seamless conversation in both English and Hindi. Automatically renders Hindi in Devanagari script for accurate speech synthesis.
- **Voice-First Hands-Free Interface**: Uses browser Web Speech API for real-time Speech Recognition and a backend gTTS streaming endpoint for audio synthesis.
- **Barge-In / Real-Time Interruption**: Allows users to interrupt the AI while it is speaking. The system immediately stops audio playback and cancels pending LLM tasks.
- **Silence Detection & Auto-Disconnect**: Monitors user responsiveness with a 10-second timer. Automatically prompts the user when silent and safely ends the call after 5 consecutive unanswered prompts.
- **Live Transcript & Scroll-Locked UI**: Keeps conversation history neatly formatted inside a scrollable view without disrupting the application dashboard layout.
- **Automated Health Screening Report**: Summarizes patient details, main complaints, duration, severity scale, and suggested next steps into a structured report once the call ends.

---

## Tech Stack

### Frontend
- **Framework**: React (TypeScript)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Speech Recognition**: Web Speech API (`webkitSpeechRecognition`)

### Backend
- **Runtime**: Node.js & TypeScript
- **HTTP & WebSockets**: Express, Node `http`, `ws`
- **Text-To-Speech**: `gtts` (Google Text-to-Speech)
- **AI Engine**: Groq SDK (`llama-3.3-70b-versatile`)

---

## System Architecture & Protocol

```text
┌─────────────────────────┐               ┌──────────────────────────┐
│  React Frontend         │               │  Node.js Backend         │
│  (VoiceCall.tsx)        │               │  (server.ts)             │
└───────────┬─────────────┘               └────────────┬─────────────┘
            │                                          │
            │ ──── 1. WebSocket Connection ──────────> │
            │ ──── 2. START_CALL (langPref) ─────────> │
            │ <─── 3. AI_RESPONSE (Text Greeting) ─── │
            │                                          │
            │ ──── 4. Fetch Audio (/api/tts) ────────> │ (Generates MP3 via gTTS)
            │ <─── 5. Return MP3 Stream ────────────── │
            │                                          │
            │ ──── 6. USER_SPEECH (Transcribed) ────> │
            │                                          │ ──> Sends to Groq API
            │                                          │ <── Received Llama 3.3 Text
            │ <─── 7. AI_RESPONSE ──────────────────── │
            │                                          │
            │ ──── 8. INTERRUPT (Barge-in) ──────────> │ (Cancels pending LLM processing)
            │ ──── 9. END_CALL ──────────────────────> │
            │ <─── 10. REPORT_READY (JSON Report) ──── │
```

---

## Project Directory Structure

```text
AI-Health-Assistent/
│
├── backend/                        # Node.js / Express Server
│   ├── src/
│   │   ├── services/
│   │   │   ├── aiPipeline.ts       # Groq LLM integration & prompt engineering
│   │   │   └── reportGenerator.ts # Final structured JSON report generator
│   │   └── types.ts                # TypeScript interfaces (CallSession, Message, etc.)
│   ├── server.ts                   # Express server & WebSocket event orchestration
│   ├── gtts.d.ts                   # Type declarations for gtts module
│   ├── .env                        # Backend environment variables
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                       # React Client Application
│   ├──public/  # doctor image
│   ├── src/
│   │   ├── components/
│   │   │   ├── VoiceCall.tsx       # Primary voice interface & Web Speech logic
│   │   │   └── HealthReportView.tsx# Clinical summary report renderer
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   │   ├──vite-env.d.ts
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── tsconfig.json
│
└── README.md
```
---

## Installation & Setup

### Prerequisites

- **Node.js**: `v18.x` or higher
- **npm** 
- **Groq API Key**: Obtain a free API key from [Groq Cloud Console](https://console.groq.com/).

### 1. Environment Configuration

Create a `.env` file in the root directory:

```env
PORT=8082
GROQ_API_KEY=your_groq_api_key_here
```

### 2. Backend Setup

Install dependencies and run the server:

```bash
# Install backend dependencies
npm install

# Build backend changes (when modifications are made)
npm run build

# Start backend server
npm start
```

The backend server will run at `http://localhost:8082`.

### 3. Frontend Setup

In a separate terminal tab, ensure your frontend application points to `http://localhost:8082` for gTTS audio streaming and `ws://localhost:8082` for WebSockets. Start or build the frontend React development server:

```bash
# 

# Run client development server
npm i
npm run dev
```

---

## API & WebSocket Documentation

### HTTP Endpoints

#### `GET /`
- **Description**: Health check endpoint.
- **Response**: `{"ok": true, "message": "Health Voice AI backend is running"}`

#### `GET /api/tts`
- **Description**: Streams gTTS MP3 audio for the given text payload. Automatically selects `hi` or `en` voice engines based on script detection.
- **Query Parameters**:
  - `text` (string, required): The text content to synthesize into speech.
- **Response**: `audio/mpeg` stream.

---

### WebSocket Protocol (`ws://localhost:8082`)

#### Client to Server Events

| Event Type | Payload | Description |
|---|---|---|
| `START_CALL` | `{"type": "START_CALL", "languagePref": "en-US" \| "hi-IN"}` | Initializes a new screening call session with language preference. |
| `USER_SPEECH` | `{"type": "USER_SPEECH", "text": "string"}` | Sends final user speech transcription to the LLM pipeline. |
| `INTERRUPT` | `{"type": "INTERRUPT"}` | Signals that the user barged in, cancelling active AI response processing. |
| `END_CALL` | `{"type": "END_CALL"}` | Terminates session and triggers report generation. |

#### Server to Client Events

| Event Type | Payload | Description |
|---|---|---|
| `AI_RESPONSE` | `{"type": "AI_RESPONSE", "text": "string"}` | Emits AI assistant response text to be spoken and logged. |
| `REPORT_READY` | `{"type": "REPORT_READY", "report": HealthReport}` | Delivers the structured JSON summary report upon call completion. |

---

## Troubleshooting & Notes

- **Microphone Permissions**: Ensure browser permissions for microphone access are granted.
- **Browser Compatibility**: Web Speech API (`webkitSpeechRecognition`) runs natively on Chrome, Edge, and Android WebViews.
- **Echo Cancellation**: If experiencing self-interruption on speakers, use headphones or ensure system audio echo cancellation (AEC) is enabled in OS audio settings.
