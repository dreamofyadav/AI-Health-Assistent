import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  Check,
  Clock3,
  Globe2,
  HeartPulse,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
} from "lucide-react";

import { HealthReport, HealthReportView } from "./HealthReportView";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type Transcript = {
  sender: "You" | "AI Screening Agent";
  text: string;
};

const SILENCE_LIMIT = 10;
const MAX_SILENCE_PROMPTS = 5; // Auto-disconnects after 5 unanswered prompts

const SCREENING_STEPS = [
  "Your Name / नाम",
  "Main Concern / मुख्य समस्या",
  "Symptoms / लक्षण",
  "Duration / अवधि",
  "Severity / गंभीरता",
];

const BACKEND_URL = "http://localhost:8082";

export const VoiceCall: React.FC = () => {
  const [isCalling, setIsCalling] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);

  // Set English as default language
  const [selectedLang, setSelectedLang] = useState<"en-US" | "hi-IN">("en-US");

  const [status, setStatus] = useState(
    'Click "Start Call" to begin your screening'
  );

  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [report, setReport] = useState<HealthReport | null>(null);
  const [silenceSeconds, setSilenceSeconds] = useState(SILENCE_LIMIT);
  const [callSeconds, setCallSeconds] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const isCallActiveRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const recognitionRunningRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silencePromptRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Consecutive silence counter ref
  const silenceCountRef = useRef(0);

  const resetSilenceCount = () => {
    silenceCountRef.current = 0;
  };

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setSilenceSeconds(SILENCE_LIMIT);
    silencePromptRef.current = false;
  };

  // =====================================================
  // SILENCE TIMER WITH AUTO-DISCONNECT
  // =====================================================
  const startSilenceTimer = () => {
    clearSilenceTimer();

    if (!isCallActiveRef.current || isSpeakingRef.current) return;

    let remaining = SILENCE_LIMIT;
    setSilenceSeconds(remaining);

    silenceTimerRef.current = setInterval(() => {
      if (!isCallActiveRef.current || isSpeakingRef.current) {
        clearSilenceTimer();
        return;
      }

      remaining -= 1;
      setSilenceSeconds(remaining);

      if (remaining <= 0) {
        clearSilenceTimer();

        if (
          isCallActiveRef.current &&
          !isSpeakingRef.current &&
          !silencePromptRef.current
        ) {
          silencePromptRef.current = true;
          silenceCountRef.current += 1;

          // AUTO-DISCONNECT CHECK
          if (silenceCountRef.current >= MAX_SILENCE_PROMPTS) {
            console.log("Max silence threshold reached. Auto disconnecting...");

            const disconnectMsg =
              selectedLang === "hi-IN"
                ? "ऐसा लगता है कि हमारा संपर्क टूट गया है या बात बंद हो गई है। धन्यवाद, आवश्यकता होने पर बेझिझक पुनः संपर्क करें।"
                : "It seems we are disconnected or out of conversation. Thank you, feel free to reach out again anytime.";

            setTranscripts((prev) => [
              ...prev,
              {
                sender: "AI Screening Agent",
                text: disconnectMsg,
              },
            ]);

            speakText(disconnectMsg, true); // true = hang up call after playing
            return;
          }

          // REPEAT PROMPT
          const prompt =
            selectedLang === "hi-IN"
              ? "मुझे आपकी आवाज नहीं सुनाई दी। क्या आप कृपया दोहरा सकते हैं?"
              : "I didn't hear you. Could you please repeat that, or let me know if you're still there?";

          setTranscripts((prev) => [
            ...prev,
            {
              sender: "AI Screening Agent",
              text: prompt,
            },
          ]);

          speakText(prompt);
        }
      }
    }, 1000);
  };

  useEffect(() => {
    if (!isCalling) return;
    const timer = setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isCalling]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = selectedLang;
    }
  }, [selectedLang]);

  // =====================================================
  // BARGE-IN HANDLER
  // =====================================================
  const handleBargeIn = () => {
    if (!isSpeakingRef.current) return;

    console.log("⚡ BARGE-IN DETECTED: Stopping audio...");

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }

    isSpeakingRef.current = false;
    setIsAISpeaking(false);
    clearSilenceTimer();

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "INTERRUPT",
        })
      );
    }
  };

  // =====================================================
  // SPEECH RECOGNITION SETUP
  // =====================================================
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech Recognition is not supported.");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      .then((stream) => {
        audioStreamRef.current = stream;
      })
      .catch((err) => console.warn("Mic AEC warning:", err));

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLang;

    recognition.onstart = () => {
      recognitionRunningRef.current = true;
      setIsListening(true);
      setStatus(
        isSpeakingRef.current ? "AI Speaking (Speak to interrupt)..." : "Listening..."
      );
    };

    recognition.onresult = (event: any) => {
      const lastIndex = event.results.length - 1;
      const result = event.results[lastIndex];
      const text = result[0].transcript?.trim();

      if (!text) return;

      if (isSpeakingRef.current) {
        handleBargeIn();
      }

      if (result.isFinal) {
        console.log("User (Final):", text);

        resetSilenceCount(); // Reset silence counter when user speaks
        clearSilenceTimer();
        setIsListening(false);
        setStatus("AI is thinking...");

        setTranscripts((prev) => [
          ...prev,
          {
            sender: "You",
            text,
          },
        ]);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "USER_SPEECH",
              text,
            })
          );
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech") {
        console.warn("Speech recognition error:", event.error);
      }
      recognitionRunningRef.current = false;
      setIsListening(false);

      if (isCallActiveRef.current) {
        restartRecognition();
      }
    };

    recognition.onend = () => {
      recognitionRunningRef.current = false;
      setIsListening(false);

      if (isCallActiveRef.current) {
        restartRecognition();
      }
    };

    recognitionRef.current = recognition;

    return () => {
      clearSilenceTimer();
      isCallActiveRef.current = false;
      try {
        recognition.abort();
      } catch {}
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      wsRef.current?.close();
    };
  }, []);

  const startRecognition = () => {
    if (
      !recognitionRef.current ||
      !isCallActiveRef.current ||
      recognitionRunningRef.current
    )
      return;

    try {
      recognitionRef.current.start();
    } catch (error) {}
  };

  const restartRecognition = () => {
    setTimeout(() => {
      if (isCallActiveRef.current) {
        startRecognition();
      }
    }, 150);
  };

  const handleStartCall = () => {
    clearSilenceTimer();
    resetSilenceCount();
    setTranscripts([]);
    setReport(null);
    setCallSeconds(0);

    isCallActiveRef.current = true;

    const ws = new WebSocket("ws://localhost:8082");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsCalling(true);
      setStatus("Connected — starting screening...");

      startRecognition();

      ws.send(
        JSON.stringify({
          type: "START_CALL",
          languagePref: selectedLang,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "AI_RESPONSE") {
          setTranscripts((prev) => [
            ...prev,
            {
              sender: "AI Screening Agent",
              text: data.text,
            },
          ]);

          speakText(data.text);
        }

        if (data.type === "REPORT_READY") {
          setReport(data.report);
          endCallCleanly();
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    };

    ws.onerror = () => {
      setStatus("Connection error. Please try again.");
    };

    ws.onclose = () => {
      if (isCallActiveRef.current) {
        endCallCleanly();
      }
    };
  };

  // =====================================================
  // AUDIO PLAYBACK
  // =====================================================
  const speakText = (text: string, isFinalDisconnectMsg = false) => {
    clearSilenceTimer();

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    isSpeakingRef.current = true;
    setIsAISpeaking(true);
    setStatus("AI Screening Agent is speaking...");

    if (!recognitionRunningRef.current) {
      startRecognition();
    }

    const audioUrl = `${BACKEND_URL}/api/tts?text=${encodeURIComponent(text)}`;
    const audio = new Audio(audioUrl);

    audio.volume = 1.0;
    audio.muted = false;
    currentAudioRef.current = audio;

    audio.play().catch((err) => {
      console.error("Error playing audio:", err);
      isSpeakingRef.current = false;
      setIsAISpeaking(false);
      if (isFinalDisconnectMsg) {
        handleEndCall();
      } else {
        startSilenceTimer();
      }
    });

    audio.onended = () => {
      isSpeakingRef.current = false;
      setIsAISpeaking(false);
      currentAudioRef.current = null;

      if (isFinalDisconnectMsg) {
        handleEndCall();
        return;
      }

      if (!isCallActiveRef.current) return;

      setStatus("Listening... speak naturally");
      startSilenceTimer();
    };

    audio.onerror = (e) => {
      console.error("Audio stream error:", e);
      isSpeakingRef.current = false;
      setIsAISpeaking(false);
      currentAudioRef.current = null;

      if (isFinalDisconnectMsg) {
        handleEndCall();
      } else if (isCallActiveRef.current) {
        setStatus("Listening... speak naturally");
        startSilenceTimer();
      }
    };
  };

  const handleEndCall = () => {
    clearSilenceTimer();
    setStatus("Ending call & generating report...");

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "END_CALL",
        })
      );
    } else {
      endCallCleanly();
    }
  };

  const endCallCleanly = () => {
    clearSilenceTimer();
    resetSilenceCount();
    isCallActiveRef.current = false;
    isSpeakingRef.current = false;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    try {
      recognitionRef.current?.abort();
    } catch {}

    setIsCalling(false);
    setIsListening(false);
    setIsAISpeaking(false);

    setStatus('Click "Start Call" to begin your screening');
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${secs}`;
  };

  const userMessages = transcripts.filter((item) => item.sender === "You");

  const progress = Math.min(
    Math.round((userMessages.length / SCREENING_STEPS.length) * 100),
    100
  );

  if (report) {
    return (
      <HealthReportView
        report={report}
        onReset={() => {
          setReport(null);
          setTranscripts([]);
          setCallSeconds(0);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#eef8ff] text-[#10235d]">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-400/20 blur-[120px]" />
        <div className="absolute top-1/3 right-[-150px] w-[450px] h-[450px] rounded-full bg-purple-400/20 blur-[120px]" />
        <div className="absolute bottom-[-200px] left-1/3 w-[500px] h-[400px] rounded-full bg-cyan-400/20 blur-[120px]" />
      </div>

      <main className="relative max-w-[1450px] mx-auto px-4 md:px-6 py-5">
        {/* HEADER */}
        <header className="bg-white/90 backdrop-blur-xl rounded-[25px] px-6 py-4 shadow-[0_15px_45px_rgba(40,90,180,0.12)] border border-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
              <HeartPulse size={27} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
                AI Health Screening
              </h1>
              <p className="text-xs md:text-sm text-slate-500">
                Your friendly voice assistant for better health
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-100 bg-blue-50">
              <Globe2 size={17} className="text-blue-500" />
              <select
                value={selectedLang}
                onChange={(e) =>
                  setSelectedLang(e.target.value as "en-US" | "hi-IN")
                }
                className="bg-transparent text-sm font-medium border-none focus:outline-none cursor-pointer"
              >
                <option value="en-US">English</option>
                <option value="hi-IN">हिन्दी / Hindi</option>
              </select>
            </div>

            <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isCalling ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                }`}
              />
              <span className="text-xs md:text-sm font-semibold">
                {isCalling ? "Online" : "Ready"}
              </span>
            </div>
          </div>
        </header>

        <div className="grid lg:grid-cols-[330px_minmax(0,1fr)_270px] gap-5 mt-5">
          <section className="relative min-h-[610px] overflow-hidden rounded-[30px] shadow-[0_20px_60px_rgba(38,90,190,0.18)] border border-white">
            <img
              src="/ai-doctor.png"
              alt="AI Health Assistant"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1555c8]/90 via-transparent to-transparent" />
            <div className="absolute top-8 left-6 right-6">
              <div className="relative bg-white rounded-[25px] px-5 py-4 shadow-xl">
                <p className="text-lg font-bold">Hi! / नमस्ते! 👋</p>
                <p className="text-sm leading-relaxed text-slate-600 mt-1">
                  I can speak Hindi and English. Speak anytime to interrupt.
                </p>
                <div className="absolute -bottom-3 left-10 w-6 h-6 bg-white rotate-45" />
              </div>
            </div>
            <div className="absolute bottom-6 left-5 right-5 text-center text-white">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-emerald-600 shadow-lg text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {isCalling ? "Screening in progress" : "Ready to help"}
              </div>
              <div className="mt-4">
                <h2 className="text-xl font-extrabold">Your Health Companion</h2>
                <p className="text-xs text-blue-100 mt-1">Safe • Private • Smart</p>
              </div>
            </div>
          </section>

          {/* LOCKED HEIGHT SECTION: h-[650px] PREVENTS PAGE STRETCHING */}
          <section className="bg-white/90 backdrop-blur-xl rounded-[30px] border border-white shadow-[0_20px_60px_rgba(38,90,190,0.12)] overflow-hidden flex flex-col h-[650px]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <Waves size={22} className="text-blue-500" />
                </div>
                <div>
                  <h2 className="font-extrabold text-lg">Live Conversation</h2>
                  <p className="text-xs text-slate-400">
                    Speak naturally • Hands-free
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock3 size={15} />
                {formatTime(callSeconds)}
              </div>
            </div>

            {/* INTERNAL SCROLLABLE CHAT CONTAINER */}
            <div className="flex-1 overflow-y-auto min-h-0 px-5 py-5 space-y-5 scroll-smooth">
              {transcripts.length === 0 ? (
                <div className="h-full min-h-[350px] flex items-center justify-center">
                  <div className="text-center max-w-sm">
                    <div className="w-20 h-20 mx-auto rounded-3xl bg-blue-50 flex items-center justify-center">
                      <HeartPulse size={35} className="text-blue-500" />
                    </div>
                    <h3 className="font-bold text-lg mt-5">
                      Ready for your screening?
                    </h3>
                    <p className="text-sm text-slate-400 mt-2">
                      Click Start Call below to begin.
                    </p>
                  </div>
                </div>
              ) : (
                transcripts.map((message, index) => {
                  const isUser = message.sender === "You";
                  return (
                    <div
                      key={index}
                      className={`flex items-end gap-3 ${
                        isUser ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!isUser && (
                        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-blue-100 flex-shrink-0">
                          <img
                            src="/ai-doctor.png"
                            alt="AI"
                            className="w-full h-full object-cover object-top"
                          />
                        </div>
                      )}
                      <div
                        className={`max-w-[78%] px-5 py-3.5 rounded-[22px] ${
                          isUser
                            ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-br-md"
                            : "bg-blue-50 text-[#19316d] rounded-bl-md"
                        }`}
                      >
                        <div className="text-[10px] font-bold opacity-60 mb-1">
                          {isUser ? "You" : "AI Health Assistant"}
                        </div>
                        <p className="text-sm leading-relaxed">
                          {message.text}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              {isAISpeaking && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden">
                    <img
                      src="/ai-doctor.png"
                      alt="AI"
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div className="px-5 py-4 rounded-2xl bg-blue-50">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>

            <div className="mx-5 mb-5 rounded-[25px] bg-gradient-to-r from-blue-50 via-white to-purple-50 border border-blue-100 p-5">
              <div className="flex items-center justify-center gap-6">
                <div className="relative">
                  {isListening && (
                    <>
                      <div className="absolute -inset-3 rounded-full border-4 border-blue-200 animate-ping" />
                      <div className="absolute -inset-6 rounded-full border border-blue-100 animate-pulse" />
                    </>
                  )}
                  <div
                    className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-xl ${
                      isListening
                        ? "bg-gradient-to-br from-blue-500 to-purple-500"
                        : isAISpeaking
                        ? "bg-gradient-to-br from-purple-500 to-pink-500"
                        : "bg-slate-200"
                    }`}
                  >
                    {isListening ? (
                      <Mic size={38} className="text-white" />
                    ) : isAISpeaking ? (
                      <Volume2 size={38} className="text-white" />
                    ) : (
                      <Mic size={38} className="text-slate-500" />
                    )}
                  </div>
                </div>

                <div className="text-center min-w-[90px]">
                  <div className="text-3xl font-extrabold text-[#1b2f72]">
                    {isListening ? `${silenceSeconds}s` : "--"}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {isListening ? "Auto-prompt in" : "Waiting"}
                  </p>
                </div>
              </div>

              <div className="text-center mt-3">
                <h3 className="font-extrabold">
                  {isAISpeaking
                    ? "AI Speaking..."
                    : isListening
                    ? "Listening..."
                    : "Ready"}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {isListening
                    ? "Speak now in English or Hindi"
                    : isAISpeaking
                    ? "You can interrupt at any time"
                    : "Start the call to begin"}
                </p>
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="bg-white/90 rounded-[25px] border border-white shadow-lg p-5">
              <div className="flex justify-between items-center">
                <h3 className="font-extrabold">Call Status</h3>
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isCalling
                        ? "bg-emerald-500 animate-pulse"
                        : "bg-slate-300"
                    }`}
                  />
                  {isCalling ? "Connected" : "Ready"}
                </span>
              </div>
              <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-center">
                <Clock3 size={27} className="text-blue-500 mx-auto" />
                <div className="text-3xl font-extrabold mt-2">
                  {formatTime(callSeconds)}
                </div>
                <p className="text-xs text-slate-400">Call Duration</p>
              </div>
            </div>
          </aside>
        </div>

        <section className="mt-5 bg-white/95 backdrop-blur-xl rounded-[30px] border border-white shadow-[0_20px_60px_rgba(38,90,190,0.15)] p-5 md:p-6">
          <div className="grid md:grid-cols-3 items-center gap-5">
            <div className="flex items-center gap-4 justify-center md:justify-start">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center ${
                  isListening
                    ? "bg-red-50 text-red-500"
                    : "bg-blue-50 text-blue-500"
                }`}
              >
                {isListening ? <Mic size={25} /> : <MicOff size={25} />}
              </div>
              <div>
                <p className="font-extrabold text-sm">
                  {isListening
                    ? "Listening..."
                    : isAISpeaking
                    ? "AI Speaking..."
                    : "Microphone"}
                </p>
                <p className="text-xs text-slate-400">
                  {isListening ? "Microphone Active" : "Waiting"}
                </p>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleStartCall}
                disabled={isCalling}
                className="flex items-center justify-center gap-3 min-w-[220px] px-8 py-4 rounded-full text-white font-extrabold bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 hover:scale-105 active:scale-95 transition-all disabled:opacity-40"
              >
                <span className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <PhoneCall size={21} />
                </span>
                <span>
                  <span className="block">
                    {isCalling ? "Call Active" : "Start Call"}
                  </span>
                </span>
              </button>
            </div>

            <div className="flex justify-center md:justify-end">
              <button
                onClick={handleEndCall}
                disabled={!isCalling}
                className="flex items-center justify-center gap-3 min-w-[190px] px-7 py-4 rounded-full font-extrabold border bg-red-50 text-red-500 border-red-100 hover:bg-red-500 hover:text-white transition-all disabled:opacity-30"
              >
                <PhoneOff size={20} />
                <span>End Call</span>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};