"use client";

import { useState, useCallback, useRef } from "react";

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string) => {
    // Cancel any current playback
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // ── Microsoft Edge TTS (high quality, cross-platform, free) ──────────
    try {
      setSpeaking(true);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const { audioContent } = await res.json();
        const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
        audioRef.current = audio;
        audio.onended = () => setSpeaking(false);
        audio.onerror = () => setSpeaking(false);
        audio.play();
        return;
      }
    } catch {
      // fall through to browser TTS
    }
    setSpeaking(false);

    // ── Browser speechSynthesis fallback ────────────────────────────────
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "en-AU";
    utt.rate = 0.88;

    function pickVoice(voices: SpeechSynthesisVoice[]) {
      return (
        voices.find(v => v.name.includes("Premium") && v.lang.startsWith("en-AU")) ??
        voices.find(v => v.name.includes("Enhanced") && v.lang.startsWith("en-AU")) ??
        voices.find(v => v.name.includes("Premium") && v.lang.startsWith("en")) ??
        voices.find(v => v.name.includes("Enhanced") && v.lang.startsWith("en")) ??
        voices.find(v => v.name === "Karen") ??
        voices.find(v => v.lang === "en-AU" && v.localService) ??
        voices.find(v => v.lang === "en-AU") ??
        voices.find(v => v.name.includes("Samantha")) ??
        voices.find(v => v.lang.startsWith("en") && v.localService) ??
        voices.find(v => v.lang.startsWith("en"))
      );
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      const preferred = pickVoice(voices);
      if (preferred) utt.voice = preferred;
    } else {
      window.speechSynthesis.addEventListener("voiceschanged", () => {
        const preferred = pickVoice(window.speechSynthesis.getVoices());
        if (preferred) utt.voice = preferred;
      }, { once: true });
    }

    utt.onstart = () => setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking };
}
