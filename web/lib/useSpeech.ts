"use client";

import { useState, useCallback } from "react";

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "en-AU";
    utt.rate = 0.88;

    // Pick the best available voice: prefer en-AU neural/enhanced, fall back to en-AU, then en
    // getVoices() may be empty on first call — speak after voices load if needed
    let voices = window.speechSynthesis.getVoices();
    if (!voices.length) {
      window.speechSynthesis.addEventListener("voiceschanged", () => {
        voices = window.speechSynthesis.getVoices();
      }, { once: true });
    }
    const preferred = voices.find(v => v.name === "Karen")                        // macOS AU
      ?? voices.find(v => v.lang === "en-AU" && v.localService)
      ?? voices.find(v => v.lang === "en-AU")
      ?? voices.find(v => v.name.includes("Samantha"))                            // macOS US fallback
      ?? voices.find(v => v.lang.startsWith("en") && v.localService)
      ?? voices.find(v => v.lang.startsWith("en"));
    if (preferred) utt.voice = preferred;

    utt.onstart = () => setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking };
}
