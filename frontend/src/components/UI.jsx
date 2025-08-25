import { useEffect, useRef, useState } from "react";
import { useChat } from "../hooks/useChat";

export const UI = ({ hidden, background = "Bar", setBackground = () => {}, useCustomHdri = false, setUseCustomHdri = () => {}, ...props }) => {
  const input = useRef();
  const { chat, loading, cameraZoomed, setCameraZoomed, message } = useChat();
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [suggestions] = useState([
    "How was your day?",
    "Tell me something cute",
    "What should we do tonight?",
    "Compliment me",
    "Sing me a song",
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  const enableAudio = async () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      if (ctx.state === "suspended") await ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001; // inaudible
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
      setAudioEnabled(true);
      window.__audioEnabled = true;
    } catch (e) {
      console.warn("Failed to enable audio:", e);
    }
  };

  // Persist zoom preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vg_zoom');
      if (saved === '1') setCameraZoomed(true);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('vg_zoom', cameraZoomed ? '1' : '0');
    } catch {}
  }, [cameraZoomed]);

  const sendMessage = () => {
    const text = input.current.value;
    if (!loading && !message) {
      chat(text);
      input.current.value = "";
    }
  };

  const startVoiceInput = () => {
    try {
      const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Rec) {
        alert("Speech recognition not supported on this browser.");
        return;
      }
      const recognition = new Rec();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (e) => {
        const text = e.results[0][0].transcript;
        if (input.current) input.current.value = text;
      };
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = () => setIsRecording(false);
      recognitionRef.current = recognition;
      setIsRecording(true);
      recognition.start();
    } catch (e) {
      setIsRecording(false);
    }
  };

  const stopVoiceInput = () => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setIsRecording(false);
  };

  const captureScreenshot = async () => {
    try {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'capture.png';
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (e) {
      console.warn('Capture failed', e);
    }
  };
  if (hidden) {
    return null;
  }

  return (
    <>
      <div className="fixed top-0 left-0 right-0 bottom-0 z-10 flex justify-between p-4 flex-col pointer-events-none">
        <div className="self-start backdrop-blur-md bg-white/50 p-3 rounded-xl flex items-center gap-3">
          <h1 className="font-black text-xl">My Virtual GF</h1>
          <p>I will always love you ❤️</p>
        </div>
        
        {/* Right side controls */}
        <div className="fixed top-4 right-4 flex flex-col gap-3 pointer-events-auto">
          {/* HDRI toggle */}
          <div className="backdrop-blur-md bg-white/50 p-3 rounded-xl">
            <label className="flex items-center gap-2 select-none text-sm">
              <span>HDRI</span>
              <button
                onClick={() => setUseCustomHdri(!useCustomHdri)}
                className={`w-12 h-7 rounded-full p-1 transition relative ${useCustomHdri ? 'bg-pink-500' : 'bg-gray-300'} active:scale-95`}
              >
                <span
                  className={`w-5 h-5 bg-white rounded-full block transition-transform ${useCustomHdri ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </label>
          </div>
          
          {/* Background switcher */}
          <div className="backdrop-blur-md bg-white/50 p-3 rounded-xl">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-700">Background</span>
              <div className="flex flex-col gap-1">
                {[
                  { label: "Bar", val: "Bar" },
                  { label: "Park", val: "Park" },
                  { label: "Beach", val: "Beach" },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    onClick={() => setBackground(opt.val)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      background === opt.val
                        ? "bg-pink-500 text-white"
                        : "bg-white/70 hover:bg-white text-gray-800"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {message && (
          <div className="self-start backdrop-blur-md bg-pink-100 bg-opacity-90 p-4 rounded-lg max-w-lg mx-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                💕
              </div>
              <div className="flex-1">
                <p className="text-gray-800 leading-relaxed">{message.text}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                  <span className="capitalize">{message.facialExpression}</span>
                  <span>•</span>
                  <span>{message.animation}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="w-full flex flex-col items-end justify-center gap-4">
          <button
            onClick={() => setCameraZoomed(!cameraZoomed)}
            className="pointer-events-auto bg-pink-500 hover:bg-pink-600 text-white p-4 rounded-md transition active:scale-95"
          >
            {cameraZoomed ? "Unzoom Camera" : "Zoom Camera"}
          </button>
          <button
            onClick={() => {
              const body = document.querySelector("body");
              if (body.classList.contains("greenScreen")) {
                body.classList.remove("greenScreen");
              } else {
                body.classList.add("greenScreen");
              }
            }}
            className="pointer-events-auto bg-pink-500 hover:bg-pink-600 text-white p-4 rounded-md"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </button>
        </div>
        {/* Suggestions */}
        <div className="pointer-events-auto max-w-screen-sm w-full mx-auto">
          <div className="flex gap-2 flex-wrap justify-center mb-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                disabled={loading || message}
                onClick={() => !loading && !message && chat(s)}
                className={`text-sm px-3 py-1 rounded-full border backdrop-blur bg-white/50 hover:bg-white transition active:scale-95 ${
                  loading || message ? "opacity-40 cursor-not-allowed" : ""
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {/* Bottom control bar */}
          <div className="w-full mx-auto">
            <div className="flex items-center gap-2 p-2 rounded-2xl backdrop-blur bg-white/60 shadow-lg">
              <button
                className={`relative p-3 rounded-full transition active:scale-95 ${isRecording ? 'bg-red-500 text-white' : 'bg-white hover:bg-gray-100'} disabled:opacity-40`}
                onClick={isRecording ? stopVoiceInput : startVoiceInput}
                disabled={loading || !!message}
                title="Voice input"
              >
                {isRecording ? (
                  <div className="relative">
                    {/* Pulsing ring */}
                    <span className="absolute -inset-1 rounded-full border-2 border-red-400 animate-pulse" />
                    {/* Stop icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 relative">
                      <path d="M6 6h12v12H6z" />
                    </svg>
                  </div>
                ) : (
                  // Mic icon
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6V9a6 6 0 10-12 0v3.75a6 6 0 006 6zm0 0v2.25m-4.5 0h9" />
                  </svg>
                )}
              </button>

              <input
                className="flex-1 placeholder:text-gray-800 placeholder:italic px-4 py-3 rounded-full bg-white/80 outline-none"
                placeholder="Ask anything..."
                ref={input}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    sendMessage();
                  }
                }}
              />
              <button
                onClick={captureScreenshot}
                className="p-3 rounded-full bg-white hover:bg-gray-100 transition active:scale-95"
                title="Capture"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h3l1.5-2.25h9L18 7.5h3A1.5 1.5 0 0122.5 9v9A1.5 1.5 0 0121 19.5H3A1.5 1.5 0 011.5 18V9A1.5 1.5 0 013 7.5zm9 9a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" />
                </svg>
              </button>
              <button
                disabled={loading || message}
                onClick={sendMessage}
                className={`px-5 py-3 rounded-full text-white bg-pink-500 hover:bg-pink-600 font-semibold transition active:scale-95 ${
                  loading || message ? 'opacity-30 cursor-not-allowed' : ''
                }`}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
