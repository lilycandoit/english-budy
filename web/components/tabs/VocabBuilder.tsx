"use client";

import { useEffect, useState } from "react";
import { WordCard, type WordInfo } from "@/components/WordCard";

interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  word: string;
}

interface GenerateResult {
  sessionId: string;
  words: WordInfo[];
  quiz: QuizQuestion[];
}

interface QuizFeedback {
  score: number;
  total: number;
  feedback: { correct: boolean; correctAnswer: string; selected: string; explanation: string }[];
}

interface PastSession {
  id: string;
  words: string[];
  createdAt: string;
  score: number | null;
  total: number | null;
}

interface WbEntry {
  id: string;
  word: string;
  wordInfo: WordInfo;
  updatedAt: string;
}

const SESSIONS_PREVIEW = 5;

// ── Main component ────────────────────────────────────────────────────────────

export function VocabBuilder() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);

  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizFeedback | null>(null);

  const [wordBank, setWordBank] = useState<WbEntry[]>([]);
  const [wbSearch, setWbSearch] = useState("");
  const [wbStats, setWbStats] = useState({ total: 0, thisWeek: 0, today: 0 });
  const [expandedWord, setExpandedWord] = useState<string | null>(null);

  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [showAll, setShowAll] = useState(false);

  const [drillWord, setDrillWord] = useState<string | null>(null);
  const [drillAnchor, setDrillAnchor] = useState<string | null>(null); // parent word
  const [drillData, setDrillData] = useState<WordInfo | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  useEffect(() => {
    loadWordBank();
    loadSessions();
  }, []);

  async function loadWordBank() {
    const res = await fetch("/api/learning/word-bank");
    if (res.ok) {
      const data = await res.json();
      setWordBank(data.entries);
      setWbStats(data.stats);
    }
  }

  async function loadSessions() {
    const res = await fetch("/api/learning/sessions");
    if (res.ok) setPastSessions(await res.json());
  }

  async function handleGenerate(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setQuizAnswers({});
    setQuizResult(null);
    setDrillWord(null);
    setDrillData(null);

    const res = await fetch("/api/learning/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: input }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) { setError(data.error || "Something went wrong"); return; }

    setResult(data);
    loadWordBank();
    loadSessions();
  }

  async function handleSubmitQuiz(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!result) return;
    setQuizSubmitting(true);

    const answers = result.quiz.map((_, i) => quizAnswers[i] ?? "");

    const res = await fetch("/api/learning/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: result.sessionId, answers }),
    });

    setQuizSubmitting(false);
    if (res.ok) setQuizResult(await res.json());
  }

  async function handleDrilldown(word: string, anchorWord: string) {
    if (drillWord === word && drillAnchor === anchorWord) {
      setDrillWord(null); setDrillData(null); return;
    }
    setDrillWord(word);
    setDrillAnchor(anchorWord);
    setDrillData(null);
    setDrillLoading(true);

    const res = await fetch("/api/learning/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: word }),
    });

    setDrillLoading(false);
    if (res.ok) {
      const data = await res.json();
      setDrillData(data.words?.[0] ?? null);
      loadWordBank();
    }
  }

  const filteredWb = wordBank.filter((e) =>
    e.word.toLowerCase().includes(wbSearch.toLowerCase())
  );
  const visibleSessions = showAll ? pastSessions : pastSessions.slice(0, SESSIONS_PREVIEW);

  return (
    <div className="space-y-8">

      {/* ── Input ── */}
      <form onSubmit={handleGenerate} className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Enter words separated by commas
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. reckon, keen, arvo"
            className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </form>

      {/* ── Word cards ── */}
      {result && (
        <div className="space-y-4">
          {result.words.map((w) => (
            <div key={w.word}>
              <WordCard
                w={w}
                onDrilldown={(tag) => handleDrilldown(tag, w.word)}
              />
              {/* Drill-down card */}
              {drillAnchor === w.word && (
                <div className="mt-2 ml-4 border-l-4 border-blue-300 pl-4">
                  {drillLoading && drillWord && (
                    <p className="text-sm text-slate-400 py-3">Loading "{drillWord}"…</p>
                  )}
                  {drillData && drillAnchor === w.word && (
                    <div className="relative">
                      <button
                        onClick={() => { setDrillWord(null); setDrillData(null); }}
                        className="absolute top-3 right-3 text-slate-300 hover:text-slate-500 text-xs"
                      >
                        ✕ close
                      </button>
                      <WordCard w={drillData} onDrilldown={() => {}} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Quiz ── */}
      {result && result.quiz.length > 0 && (
        <div className="border border-slate-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Quiz — {result.quiz.length} questions
          </h3>

          {quizResult ? (
            <div className="space-y-4">
              <div className="text-center py-3">
                <p className="text-3xl font-bold text-blue-600">
                  {quizResult.score}/{quizResult.total}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {quizResult.score === quizResult.total
                    ? "Perfect score! 🎉"
                    : quizResult.score >= quizResult.total / 2
                    ? "Good effort! Keep practising."
                    : "Keep going — review the words above."}
                </p>
              </div>
              {result.quiz.map((q, i) => {
                const fb = quizResult.feedback[i];
                return (
                  <div key={i} className={`rounded-xl p-3 text-sm ${fb.correct ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                    <p className="font-medium text-slate-700 mb-1">{q.question}</p>
                    <p className={fb.correct ? "text-green-700" : "text-red-600"}>
                      {fb.correct ? "✓" : "✗"} Your answer: {fb.selected || "(no answer)"}
                    </p>
                    {!fb.correct && (
                      <>
                        <p className="text-slate-600 mt-0.5">Correct: <span className="font-medium">{fb.correctAnswer}</span></p>
                        {fb.explanation && (
                          <p className="text-slate-500 text-xs mt-1.5 leading-relaxed border-l-2 border-red-200 pl-2">
                            {fb.explanation}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <form onSubmit={handleSubmitQuiz} className="space-y-5">
              {result.quiz.map((q, i) => (
                <div key={i}>
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    {i + 1}. {q.question}
                  </p>
                  <div className="space-y-1.5">
                    {q.options.map((opt) => (
                      <label
                        key={opt}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                          quizAnswers[i] === opt
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${i}`}
                          value={opt}
                          checked={quizAnswers[i] === opt}
                          onChange={() => setQuizAnswers((a) => ({ ...a, [i]: opt }))}
                          className="accent-blue-600"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button
                type="submit"
                disabled={quizSubmitting || Object.keys(quizAnswers).length < result.quiz.length}
                className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {quizSubmitting ? "Submitting…" : "Submit answers"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── Word Bank ── */}
      {wordBank.length > 0 && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h3 className="text-sm font-semibold text-slate-700 whitespace-nowrap">Word Bank</h3>
              <p className="text-xs text-slate-400 whitespace-nowrap">
                {wbStats.total} words · {wbStats.thisWeek} this week · {wbStats.today} today
              </p>
            </div>
            <input
              type="text"
              value={wbSearch}
              onChange={(e) => setWbSearch(e.target.value)}
              placeholder="Search…"
              className="w-full sm:w-32 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {filteredWb.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setExpandedWord(expandedWord === entry.word ? null : entry.word)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  expandedWord === entry.word
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600"
                }`}
              >
                {entry.word}
              </button>
            ))}
          </div>
          {expandedWord && (() => {
            const entry = filteredWb.find((e) => e.word === expandedWord);
            return entry ? (
              <div className="mt-3">
                <WordCard w={entry.wordInfo} onDrilldown={() => {}} />
              </div>
            ) : null;
          })()}
          {filteredWb.length === 0 && wbSearch && (
            <p className="text-sm text-slate-400">No words match &quot;{wbSearch}&quot;</p>
          )}
        </div>
      )}

      {/* ── Past Sessions ── */}
      {pastSessions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Past Sessions</h3>
            {pastSessions.length > SESSIONS_PREVIEW && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="text-xs text-blue-600 hover:underline"
              >
                {showAll ? "Show less" : `Show all (${pastSessions.length})`}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {visibleSessions.map((s) => (
              <div key={s.id} className="border border-slate-200 rounded-xl px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5 flex-1 mr-3">
                    {s.words.map((w) => (
                      <button
                        key={w}
                        onClick={() => setExpandedWord(expandedWord === w ? null : w)}
                        className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                          expandedWord === w
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {s.score !== null && (
                      <span className="text-xs font-medium text-blue-600">
                        {s.score}/{s.total}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {new Date(s.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
                {s.words.some((w) => w === expandedWord) && (() => {
                  const entry = wordBank.find((e) => e.word === expandedWord);
                  return entry ? (
                    <div className="mt-3">
                      <WordCard w={entry.wordInfo} onDrilldown={() => {}} />
                    </div>
                  ) : null;
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

