"use client";

import { useState } from "react";
import { SentenceCheck } from "@/components/tabs/SentenceCheck";
import { VocabBuilder } from "@/components/tabs/VocabBuilder";

const TABS = [
  { id: "sentence", label: "Sentence Check", icon: "✏️" },
  { id: "vocab", label: "Vocabulary Builder", icon: "📖" },
  { id: "topic", label: "Daily Topic", icon: "💬" },
  { id: "review", label: "Words Review", icon: "🔁" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function TabShell() {
  const [active, setActive] = useState<TabId>("sentence");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              active === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content — placeholder panels, filled in Phase B–E */}
      <div className="p-6">
        {active === "sentence" && <SentenceCheck />}
        {active === "vocab" && <VocabBuilder />}
        {active === "topic" && (
          <ComingSoon
            title="Daily Topic"
            desc="Pick a topic → AI generates a dialog or story using everyday Australian English."
          />
        )}
        {active === "review" && (
          <ComingSoon
            title="Words Review"
            desc="Review words through AI stories and spaced-repetition flashcards."
          />
        )}
      </div>
    </div>
  );
}

function ComingSoon({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-4">🚧</div>
      <h2 className="text-lg font-semibold text-slate-700 mb-2">{title}</h2>
      <p className="text-slate-500 text-sm max-w-xs">{desc}</p>
      <p className="text-xs text-slate-400 mt-3">Coming soon — migration in progress</p>
    </div>
  );
}
