"use client";

import { useEffect, useState } from "react";

interface ActivityDay {
  date: string;
  words: number;
  sentences: number;
  topics: number;
}

interface Stats {
  streak: number;
  words: { total: number; thisWeek: number; today: number };
  mastery: { new: number; learning: number; mastered: number };
  sentences: { total: number; grammar: number; spelling: number; punctuation: number; none: number };
  topics: number;
  quizAverage: number | null;
  activity: ActivityDay[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function activityLevel(day: ActivityDay): 0 | 1 | 2 | 3 {
  const total = day.words + day.sentences + day.topics;
  if (total === 0) return 0;
  if (total <= 2)  return 1;
  if (total <= 5)  return 2;
  return 3;
}

const HEAT_COLORS = [
  "bg-slate-100",
  "bg-blue-200",
  "bg-blue-400",
  "bg-blue-600",
];

function StatCard({ label, value, sub, color = "text-slate-800" }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-1">
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export function Progress() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
        Loading…
      </div>
    );
  }

  if (!stats) return null;

  const masteryTotal = stats.mastery.new + stats.mastery.learning + stats.mastery.mastered;
  const masteredPct = masteryTotal ? Math.round((stats.mastery.mastered / masteryTotal) * 100) : 0;

  // Group activity into 4 weeks for heatmap
  // Pad front so first day aligns to correct weekday
  const firstDate = new Date(stats.activity[0].date);
  const paddingDays = firstDate.getDay(); // 0=Sun
  const padded = [
    ...Array(paddingDays).fill(null),
    ...stats.activity,
  ];
  // Build columns (weeks)
  const weeks: (ActivityDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7) as (ActivityDay | null)[]);
  }

  // Month labels for heatmap
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const firstReal = week.find(d => d !== null);
    if (firstReal) {
      const m = new Date(firstReal.date).getMonth();
      if (m !== lastMonth) { monthLabels.push({ label: MONTHS[m], col: wi }); lastMonth = m; }
    }
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">

      {/* ── Top stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Day streak"
          value={stats.streak === 0 ? "—" : `${stats.streak} 🔥`}
          sub={stats.streak > 0 ? "Keep it up!" : "Start today"}
          color="text-orange-500"
        />
        <StatCard
          label="Words learned"
          value={stats.words.total}
          sub={`+${stats.words.thisWeek} this week`}
          color="text-blue-600"
        />
        <StatCard
          label="Mastered"
          value={`${masteredPct}%`}
          sub={`${stats.mastery.mastered} of ${masteryTotal} reviewed`}
          color="text-green-600"
        />
        <StatCard
          label="Quiz avg"
          value={stats.quizAverage !== null ? `${stats.quizAverage}%` : "—"}
          sub="across all sessions"
          color="text-violet-600"
        />
      </div>

      {/* ── Mastery breakdown ── */}
      {masteryTotal > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-3">Mastery breakdown</p>
          <div className="flex rounded-full overflow-hidden h-3 mb-3">
            {stats.mastery.mastered > 0 && (
              <div className="bg-green-400 transition-all" style={{ width: `${(stats.mastery.mastered / masteryTotal) * 100}%` }} />
            )}
            {stats.mastery.learning > 0 && (
              <div className="bg-blue-400 transition-all" style={{ width: `${(stats.mastery.learning / masteryTotal) * 100}%` }} />
            )}
            {stats.mastery.new > 0 && (
              <div className="bg-slate-200 transition-all" style={{ width: `${(stats.mastery.new / masteryTotal) * 100}%` }} />
            )}
          </div>
          <div className="flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Mastered ({stats.mastery.mastered})</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Learning ({stats.mastery.learning})</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-200 inline-block" />New ({stats.mastery.new})</span>
          </div>
        </div>
      )}

      {/* ── Sentence check breakdown ── */}
      {stats.sentences.total > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-3">
            Sentence checks — {stats.sentences.total} total
          </p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { key: "grammar",     label: "Grammar",     color: "text-red-500" },
              { key: "spelling",    label: "Spelling",    color: "text-yellow-500" },
              { key: "punctuation", label: "Punctuation", color: "text-purple-500" },
              { key: "none",        label: "Correct",     color: "text-green-500" },
            ].map(({ key, label, color }) => (
              <div key={key} className="bg-slate-50 rounded-xl py-3">
                <p className={`text-2xl font-bold ${color}`}>
                  {stats.sentences[key as keyof typeof stats.sentences]}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Activity heatmap ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-3">Activity — last 4 weeks</p>

        {/* Month labels */}
        <div className="flex gap-1.5 mb-1 pl-7">
          {weeks.map((_, wi) => {
            const ml = monthLabels.find(m => m.col === wi);
            return (
              <div key={wi} className="w-5 text-xs text-slate-400 text-center">
                {ml ? ml.label : ""}
              </div>
            );
          })}
        </div>

        <div className="flex gap-1.5">
          {/* Day labels */}
          <div className="flex flex-col gap-1.5 justify-between pr-1">
            {DAYS.map((d, i) => (
              <div key={d} className="text-xs text-slate-300 w-5 text-right h-5 flex items-center justify-end">
                {i % 2 === 1 ? d.slice(0, 1) : ""}
              </div>
            ))}
          </div>

          {/* Grid */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1.5">
              {Array(7).fill(null).map((_, di) => {
                const day = week[di] ?? null;
                if (!day) return <div key={di} className="w-5 h-5" />;
                const level = activityLevel(day);
                const isToday = day.date === today;
                const tooltip = `${day.date}: ${day.words}w ${day.sentences}s ${day.topics}t`;
                return (
                  <div
                    key={di}
                    title={tooltip}
                    className={`w-5 h-5 rounded-sm ${HEAT_COLORS[level]} ${isToday ? "ring-2 ring-blue-500 ring-offset-1" : ""} transition-colors`}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-3 justify-end">
          <span className="text-xs text-slate-400">Less</span>
          {HEAT_COLORS.map((c, i) => (
            <div key={i} className={`w-3.5 h-3.5 rounded-sm ${c}`} />
          ))}
          <span className="text-xs text-slate-400">More</span>
        </div>
      </div>

      {/* ── Quick stats row ── */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-white border border-slate-200 rounded-2xl py-4">
          <p className="text-2xl font-bold text-slate-800">{stats.topics}</p>
          <p className="text-xs text-slate-400 mt-0.5">Topics explored</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl py-4">
          <p className="text-2xl font-bold text-slate-800">{stats.words.today}</p>
          <p className="text-xs text-slate-400 mt-0.5">Words today</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl py-4">
          <p className="text-2xl font-bold text-slate-800">{stats.sentences.none}</p>
          <p className="text-xs text-slate-400 mt-0.5">Perfect sentences</p>
        </div>
      </div>

    </div>
  );
}
