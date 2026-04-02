const API_MISTAKES  = "/api/mistakes";
const API_LEARNING  = "/api/learning";

// ── DOM refs ────────────────────────────────────────────────────────────────
const input      = document.getElementById("sentence-input");
const submitBtn  = document.getElementById("submit-btn");
const resultBox  = document.getElementById("result");
const filterSel  = document.getElementById("filter-type");

const vocabInput  = document.getElementById("vocab-input");
const generateBtn = document.getElementById("generate-btn");
const vocabError  = document.getElementById("vocab-error");
const lessonPanel = document.getElementById("lesson-panel");
const loadingState = document.getElementById("loading-state");
const lessonContent = document.getElementById("lesson-content");
const wordInfosEl = document.getElementById("word-infos");
const quizQuestionsEl = document.getElementById("quiz-questions");
const submitQuizBtn = document.getElementById("submit-quiz-btn");
const quizScore   = document.getElementById("quiz-score");

// Holds current quiz data from generation response
let currentQuiz = [];
let currentSessionId = null;
let quizSubmitted = false;

// ── Init ────────────────────────────────────────────────────────────────────
loadHistory();
loadStats();
loadSessions();

// ── Tab switching ────────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.classList.remove("active");
      p.classList.add("hidden");
    });
    btn.classList.add("active");
    const panel = document.getElementById("tab-" + btn.dataset.tab);
    panel.classList.remove("hidden");
    panel.classList.add("active");
  });
});

// ── Sentence Check events ────────────────────────────────────────────────────
submitBtn.addEventListener("click", submitSentence);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submitSentence();
  }
});

filterSel.addEventListener("change", loadHistory);

// ── Vocab Builder events ──────────────────────────────────────────────────────
generateBtn.addEventListener("click", generateLesson);

vocabInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") generateLesson();
});

submitQuizBtn.addEventListener("click", submitQuiz);

// ── Sentence Check actions ────────────────────────────────────────────────────

async function submitSentence() {
  const text = input.value.trim();
  if (!text) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Checking…";

  try {
    const data = await api("POST", API_MISTAKES, { text });
    showResult(data);
    input.value = "";
    loadHistory();
    loadStats();
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Check";
  }
}

async function deleteMistake(id) {
  await api("DELETE", API_MISTAKES + `/${id}`);
  loadHistory();
  loadStats();
}

function showResult(data) {
  const hasMistake = data.mistake_type !== "no_mistake";

  resultBox.classList.remove("hidden", "has-mistake");
  if (hasMistake) resultBox.classList.add("has-mistake");

  document.getElementById("result-original-text").textContent = data.original_text;
  document.getElementById("result-corrected-text").textContent = data.corrected_text;

  const badge = document.getElementById("result-type");
  badge.textContent = data.mistake_type.replace("_", " ");
  badge.className = "badge " + data.mistake_type;

  document.getElementById("result-explanation").textContent = data.explanation;

  resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function loadHistory() {
  const type = filterSel.value;
  const url = type ? `?mistake_type=${encodeURIComponent(type)}` : "";
  const items = await api("GET", API_MISTAKES + url);

  const list = document.getElementById("mistake-list");
  list.innerHTML = "";

  if (!items.length) {
    list.innerHTML = '<li class="empty-state">No entries yet. Submit a sentence above!</li>';
    return;
  }

  items.forEach((m) => {
    const li = document.createElement("li");
    li.className = "mistake-item";
    li.innerHTML = `
      <div class="mistake-item-header">
        <span class="badge ${m.mistake_type}">${m.mistake_type.replace("_", " ")}</span>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <span class="mistake-item-date">${formatDate(m.created_at)}</span>
          <button class="delete-btn" title="Delete" data-id="${m.id}">×</button>
        </div>
      </div>
      <div class="mistake-item-texts">
        <span class="mistake-item-original">${escapeHtml(m.original_text)}</span>
        <span class="mistake-item-corrected">${escapeHtml(m.corrected_text)}</span>
      </div>
      <div class="mistake-item-explanation">${escapeHtml(m.explanation)}</div>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteMistake(btn.dataset.id));
  });
}

async function loadStats() {
  const stats = await api("GET", API_MISTAKES + "/stats");
  document.getElementById("stat-total").textContent = stats.total ?? 0;
  document.getElementById("stat-grammar").textContent = stats.by_type?.grammar ?? 0;
  document.getElementById("stat-spelling").textContent = stats.by_type?.spelling ?? 0;
  document.getElementById("stat-punctuation").textContent = stats.by_type?.punctuation ?? 0;
}

// ── Vocabulary Builder actions ────────────────────────────────────────────────

async function generateLesson() {
  const raw = vocabInput.value.trim();
  if (!raw) return;

  const words = raw.split(",").map((w) => w.trim()).filter(Boolean);
  if (!words.length) return;

  // Reset state
  vocabError.classList.add("hidden");
  quizSubmitted = false;
  currentQuiz = [];
  currentSessionId = null;
  quizScore.classList.add("hidden");
  submitQuizBtn.disabled = false;
  submitQuizBtn.textContent = "Submit Quiz";

  // Show lesson panel + loading
  lessonPanel.classList.remove("hidden");
  loadingState.classList.remove("hidden");
  lessonContent.classList.add("hidden");
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating…";

  try {
    const data = await api("POST", API_LEARNING + "/generate", { words });

    currentSessionId = data.session_id;
    currentQuiz = data.quiz;

    renderWordInfos(data.word_infos);
    renderQuiz(data.quiz);

    loadingState.classList.add("hidden");
    lessonContent.classList.remove("hidden");
    lessonPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    loadSessions();
  } catch (err) {
    loadingState.classList.add("hidden");
    lessonPanel.classList.add("hidden");
    vocabError.textContent = "Error: " + err.message;
    vocabError.classList.remove("hidden");
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate";
  }
}

function renderWordInfos(wordInfos) {
  wordInfosEl.innerHTML = "";
  wordInfos.forEach((w) => {
    const card = document.createElement("div");
    card.className = "word-card";

    const meaningsHtml = (w.meanings || [])
      .map((m) => `<li>${escapeHtml(m)}</li>`).join("");

    const tagsHtml = (arr, cls) =>
      (arr || []).map((t) => `<span class="tag ${cls}">${escapeHtml(t)}</span>`).join("");

    const examplesHtml = (w.examples || [])
      .map((e) => `<li>${escapeHtml(e)}</li>`).join("");

    card.innerHTML = `
      <div class="word-card-header">
        <span class="word-title">${escapeHtml(w.word)}</span>
        <span class="word-ipa">${escapeHtml(w.ipa || "")}</span>
        <span class="word-stress">${escapeHtml(w.stress || "")}</span>
      </div>
      <div class="word-card-body">
        <div>
          <div class="word-section-label">Meanings</div>
          <ol class="meanings-list">${meaningsHtml}</ol>
        </div>
        <div class="word-row">
          <div>
            <div class="word-section-label">Synonyms</div>
            <div class="tag-list">${tagsHtml(w.synonyms, "synonym")}</div>
          </div>
          <div>
            <div class="word-section-label">Antonyms</div>
            <div class="tag-list">${tagsHtml(w.antonyms, "antonym")}</div>
          </div>
        </div>
        <div>
          <div class="word-section-label">Collocations</div>
          <div class="tag-list">${tagsHtml(w.collocations, "collocation")}</div>
        </div>
        <div>
          <div class="word-section-label">Examples</div>
          <ul class="examples-list">${examplesHtml}</ul>
        </div>
      </div>
    `;
    wordInfosEl.appendChild(card);
  });
}

function renderQuiz(quiz) {
  quizQuestionsEl.innerHTML = "";
  quiz.forEach((q, idx) => {
    const div = document.createElement("div");
    div.className = "quiz-question";
    div.dataset.index = idx;

    const optionsHtml = q.options.map((opt, i) => {
      const letter = String.fromCharCode(65 + i); // A, B, C, D
      return `
        <label class="quiz-option">
          <input type="radio" name="q${idx}" value="${letter}" />
          <span>${escapeHtml(opt)}</span>
        </label>
      `;
    }).join("");

    div.innerHTML = `
      <p>${idx + 1}. ${escapeHtml(q.question)}</p>
      <div class="quiz-options">${optionsHtml}</div>
    `;
    quizQuestionsEl.appendChild(div);
  });
}

async function submitQuiz() {
  if (quizSubmitted || !currentSessionId) return;

  // Collect answers
  const answers = [];
  let allAnswered = true;

  currentQuiz.forEach((_, idx) => {
    const selected = quizQuestionsEl.querySelector(`input[name="q${idx}"]:checked`);
    if (selected) {
      answers.push(selected.value);
    } else {
      allAnswered = false;
    }
  });

  if (!allAnswered) {
    alert("Please answer all questions before submitting.");
    return;
  }

  submitQuizBtn.disabled = true;
  submitQuizBtn.textContent = "Submitting…";

  try {
    const result = await api("POST", API_LEARNING + "/submit", {
      session_id: currentSessionId,
      answers,
    });

    quizSubmitted = true;
    showQuizResults(result);
    loadSessions();
  } catch (err) {
    alert("Error: " + err.message);
    submitQuizBtn.disabled = false;
    submitQuizBtn.textContent = "Submit Quiz";
  }
}

function showQuizResults(result) {
  // Colour each question and add feedback
  result.results.forEach((r, idx) => {
    const questionEl = quizQuestionsEl.querySelector(`.quiz-question[data-index="${idx}"]`);
    if (!questionEl) return;

    questionEl.classList.add(r.is_correct ? "correct" : "incorrect");

    // Disable radios
    questionEl.querySelectorAll("input[type='radio']").forEach((inp) => {
      inp.disabled = true;
    });

    const feedback = document.createElement("div");
    feedback.className = "quiz-feedback";
    if (r.is_correct) {
      feedback.innerHTML = `<span class="correct-label">Correct!</span> ${escapeHtml(r.explanation)}`;
    } else {
      feedback.innerHTML = `<span class="incorrect-label">Incorrect.</span> The correct answer was <strong>${escapeHtml(r.correct)}</strong>. ${escapeHtml(r.explanation)}`;
    }
    questionEl.appendChild(feedback);
  });

  // Show score
  const pct = Math.round((result.score / result.total) * 100);
  quizScore.innerHTML = `
    <div class="score-number">${result.score}/${result.total}</div>
    <div class="score-label">${pct}% — ${scoreMessage(pct)}</div>
  `;
  quizScore.classList.remove("hidden");
  quizScore.scrollIntoView({ behavior: "smooth", block: "nearest" });

  submitQuizBtn.textContent = "Submitted";
}

function scoreMessage(pct) {
  if (pct === 100) return "Perfect score!";
  if (pct >= 80)  return "Great job!";
  if (pct >= 60)  return "Not bad, keep practicing!";
  return "Keep studying — you'll get there!";
}

async function loadSessions() {
  const sessions = await api("GET", API_LEARNING + "/sessions").catch(() => []);
  const list = document.getElementById("sessions-list");
  list.innerHTML = "";

  if (!sessions.length) {
    list.innerHTML = '<li class="empty-state">No sessions yet. Generate your first lesson above!</li>';
    return;
  }

  sessions.forEach((s) => {
    const li = document.createElement("li");
    li.className = "session-item";
    const wordsHtml = s.words.map((w) => `<strong>${escapeHtml(w)}</strong>`).join(", ");
    const scoreHtml = s.score != null
      ? `<span class="session-score">${s.score}/${s.total}</span>`
      : `<span class="session-score" style="color:var(--muted)">—</span>`;
    li.innerHTML = `
      <span class="session-words">${wordsHtml}</span>
      <span class="session-meta">
        ${scoreHtml}
        <span class="session-date">${formatDate(s.created_at)}</span>
      </span>
    `;
    list.appendChild(li);
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function api(method, url, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
