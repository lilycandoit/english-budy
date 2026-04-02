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

// Word bank cache (populated on Vocab Builder tab load)
let wordBankData = [];   // [{word, word_info, updated_at}, ...]

// Flashcard state
let fcCards = [];        // [{word, word_info}, ...]
let fcIndex = 0;
let fcRatings = {};      // {word: "known"|"review"}
let fcFlipped = false;

// ── Init ────────────────────────────────────────────────────────────────────
loadHistory();
loadStats();
loadSessions();
loadWordBank();

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
    if (btn.dataset.tab === "words-review") initWordsReview();
    if (btn.dataset.tab === "vocab-builder") loadWordBank();
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
    loadWordBank();
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

const SESSIONS_PREVIEW = 5;

async function loadSessions() {
  const sessions = await api("GET", API_LEARNING + "/sessions").catch(() => []);
  const list      = document.getElementById("sessions-list");
  const toggleBtn = document.getElementById("sessions-toggle-btn");
  list.innerHTML  = "";

  if (!sessions.length) {
    list.innerHTML = '<li class="empty-state">No sessions yet. Generate your first lesson above!</li>';
    toggleBtn.style.display = "none";
    return;
  }

  let showAll = false;

  function render() {
    list.innerHTML = "";
    const visible = showAll ? sessions : sessions.slice(0, SESSIONS_PREVIEW);

    visible.forEach((s) => {
      const li = document.createElement("li");
      li.className = "session-item";

      const scoreHtml = s.score != null
        ? `<span class="session-score">${s.score}/${s.total}</span>`
        : `<span class="session-score" style="color:var(--muted)">—</span>`;

      // Build word chips
      const chipsHtml = s.words
        .map((w) => `<button class="wb-chip session-word-chip" data-word="${escapeHtml(w.toLowerCase())}">${escapeHtml(w)}</button>`)
        .join("");

      li.innerHTML = `
        <div class="session-item-top">
          <span class="session-words">${chipsHtml}</span>
          <span class="session-meta">
            ${scoreHtml}
            <span class="session-date">${formatDate(s.created_at)}</span>
          </span>
        </div>
        <div class="session-word-detail hidden"></div>
      `;

      // Wire up chip clicks
      const detailEl = li.querySelector(".session-word-detail");
      li.querySelectorAll(".session-word-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          const word = chip.dataset.word;
          const isOpen = chip.classList.contains("active");

          // Deactivate all chips in this session
          li.querySelectorAll(".session-word-chip").forEach((c) => c.classList.remove("active"));

          if (isOpen) {
            detailEl.classList.add("hidden");
            detailEl.innerHTML = "";
            return;
          }

          chip.classList.add("active");

          const bankMap = {};
          wordBankData.forEach((e) => { bankMap[e.word.toLowerCase()] = e; });
          const entry = bankMap[word];

          if (!entry) {
            detailEl.innerHTML = `<p class="session-detail-missing">No word bank entry for "<strong>${escapeHtml(word)}</strong>" yet — generate a lesson for it to populate.</p>`;
          } else {
            const info = entry.word_info;
            const meaningsHtml = (info.meanings || []).map((m) => `<li>${escapeHtml(m)}</li>`).join("");
            const tagsHtml = (arr, cls) =>
              (arr || []).map((t) => `<span class="tag ${cls}">${escapeHtml(t)}</span>`).join("");
            const examplesHtml = (info.examples || []).map((e) => `<li>${escapeHtml(e)}</li>`).join("");
            detailEl.innerHTML = `
              <div class="word-card-header">
                <span class="word-title">${escapeHtml(info.word || entry.word)}</span>
                <span class="word-ipa">${escapeHtml(info.ipa || "")}</span>
                <span class="word-stress">${escapeHtml(info.stress || "")}</span>
              </div>
              <div class="word-card-body">
                <div>
                  <div class="word-section-label">Meanings</div>
                  <ol class="meanings-list">${meaningsHtml}</ol>
                </div>
                <div class="word-row">
                  <div>
                    <div class="word-section-label">Synonyms</div>
                    <div class="tag-list">${tagsHtml(info.synonyms, "synonym")}</div>
                  </div>
                  <div>
                    <div class="word-section-label">Antonyms</div>
                    <div class="tag-list">${tagsHtml(info.antonyms, "antonym")}</div>
                  </div>
                </div>
                <div>
                  <div class="word-section-label">Collocations</div>
                  <div class="tag-list">${tagsHtml(info.collocations, "collocation")}</div>
                </div>
                <div>
                  <div class="word-section-label">Examples</div>
                  <ul class="examples-list">${examplesHtml}</ul>
                </div>
              </div>
            `;
          }
          detailEl.classList.remove("hidden");
          detailEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      });

      list.appendChild(li);
    });

    if (sessions.length <= SESSIONS_PREVIEW) {
      toggleBtn.style.display = "none";
    } else {
      toggleBtn.style.display = "";
      toggleBtn.textContent = showAll ? "Show less" : `Show all (${sessions.length})`;
    }
  }

  toggleBtn.onclick = () => { showAll = !showAll; render(); };
  render();
}

// ── Word Bank ─────────────────────────────────────────────────────────────────

async function loadWordBank() {
  const data = await api("GET", API_LEARNING + "/word-bank").catch(() => null);
  if (!data) return;

  wordBankData = data.words || [];

  // Stats
  document.getElementById("wb-stat-total").textContent = data.stats.total;
  document.getElementById("wb-stat-week").textContent  = data.stats.this_week;
  document.getElementById("wb-stat-today").textContent = data.stats.today;

  renderWordBank("");
}

function renderWordBank(query) {
  const grid = document.getElementById("wb-grid");
  const q = query.toLowerCase().trim();
  const filtered = q
    ? wordBankData.filter((e) => e.word.toLowerCase().includes(q))
    : wordBankData;

  if (!filtered.length) {
    grid.innerHTML = wordBankData.length
      ? '<p class="empty-state">No words match your search.</p>'
      : '<p class="empty-state">No words yet — generate your first lesson above!</p>';
    return;
  }

  grid.innerHTML = "";
  filtered.forEach((entry) => {
    const chip = document.createElement("button");
    chip.className = "wb-chip";
    chip.textContent = entry.word;
    chip.addEventListener("click", () => toggleWordDetail(entry, chip));
    grid.appendChild(chip);
  });
}

function toggleWordDetail(entry, chipEl) {
  const detail = document.getElementById("wb-detail");
  const isOpen = chipEl.classList.contains("active");

  // Deactivate all chips
  document.querySelectorAll(".wb-chip").forEach((c) => c.classList.remove("active"));

  if (isOpen) {
    detail.classList.add("hidden");
    detail.innerHTML = "";
    return;
  }

  chipEl.classList.add("active");

  // Render a mini word card inside the detail panel
  const info = entry.word_info;
  const meaningsHtml = (info.meanings || []).map((m) => `<li>${escapeHtml(m)}</li>`).join("");
  const tagsHtml = (arr, cls) =>
    (arr || []).map((t) => `<span class="tag ${cls}">${escapeHtml(t)}</span>`).join("");
  const examplesHtml = (info.examples || []).map((e) => `<li>${escapeHtml(e)}</li>`).join("");

  detail.innerHTML = `
    <div class="word-card-header">
      <span class="word-title">${escapeHtml(info.word || entry.word)}</span>
      <span class="word-ipa">${escapeHtml(info.ipa || "")}</span>
      <span class="word-stress">${escapeHtml(info.stress || "")}</span>
    </div>
    <div class="word-card-body">
      <div>
        <div class="word-section-label">Meanings</div>
        <ol class="meanings-list">${meaningsHtml}</ol>
      </div>
      <div class="word-row">
        <div>
          <div class="word-section-label">Synonyms</div>
          <div class="tag-list">${tagsHtml(info.synonyms, "synonym")}</div>
        </div>
        <div>
          <div class="word-section-label">Antonyms</div>
          <div class="tag-list">${tagsHtml(info.antonyms, "antonym")}</div>
        </div>
      </div>
      <div>
        <div class="word-section-label">Collocations</div>
        <div class="tag-list">${tagsHtml(info.collocations, "collocation")}</div>
      </div>
      <div>
        <div class="word-section-label">Examples</div>
        <ul class="examples-list">${examplesHtml}</ul>
      </div>
    </div>
  `;
  detail.classList.remove("hidden");
  detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.getElementById("wb-search").addEventListener("input", (e) => {
  renderWordBank(e.target.value);
  // close any open detail when searching
  document.getElementById("wb-detail").classList.add("hidden");
  document.getElementById("wb-detail").innerHTML = "";
  document.querySelectorAll(".wb-chip").forEach((c) => c.classList.remove("active"));
});

// ── Words Review ─────────────────────────────────────────────────────────────

let reviewSelectedWords = new Set();
let allHistoryWordsList = [];
let reviewDateGroups = [];

// Mode switching
document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".mode-panel").forEach((p) => p.classList.add("hidden"));
    document.getElementById("mode-" + btn.dataset.mode).classList.remove("hidden");
  });
});

document.getElementById("shuffle-btn").addEventListener("click", shuffleReviewWords);
document.getElementById("add-custom-btn").addEventListener("click", addCustomWords);
document.getElementById("generate-review-btn").addEventListener("click", generateReviewStory);
document.getElementById("generate-flashcards-btn").addEventListener("click", startFlashcards);
document.getElementById("clear-chips-btn").addEventListener("click", () => {
  reviewSelectedWords.clear();
  renderReviewChips();
});

async function initWordsReview() {
  const [datesData, wordsData] = await Promise.all([
    api("GET", API_LEARNING + "/words-by-date").catch(() => []),
    api("GET", API_LEARNING + "/all-words").catch(() => ({ words: [] })),
  ]);
  reviewDateGroups = datesData;
  allHistoryWordsList = (wordsData.words || []);
  renderDateGroups();
  loadPastReviews();
}

function renderDateGroups() {
  const list = document.getElementById("date-groups-list");
  if (!reviewDateGroups.length) {
    list.innerHTML = '<p class="empty-state">No vocab sessions yet — use Vocabulary Builder first.</p>';
    return;
  }
  list.innerHTML = "";
  reviewDateGroups.forEach((group) => {
    const item = document.createElement("div");
    item.className = "date-group-item";
    const preview = group.words.slice(0, 4).join(", ") +
      (group.words.length > 4 ? ` +${group.words.length - 4} more` : "");
    item.innerHTML = `
      <span class="date-group-date">${formatDateOnly(group.date)}</span>
      <span class="date-group-words">${escapeHtml(preview)}</span>
      <button class="btn-secondary btn-sm">Add</button>
    `;
    item.querySelector("button").addEventListener("click", () => {
      group.words.forEach((w) => addReviewWord(w));
    });
    list.appendChild(item);
  });
}

function shuffleReviewWords() {
  if (!allHistoryWordsList.length) {
    document.getElementById("no-history-msg").classList.remove("hidden");
    return;
  }
  const count = parseInt(document.getElementById("random-count").value) || 5;
  const shuffled = [...allHistoryWordsList].sort(() => Math.random() - 0.5);
  shuffled.slice(0, count).forEach((w) => addReviewWord(w));
}

function addCustomWords() {
  const raw = document.getElementById("custom-words-input").value;
  raw.split(/[,\n]+/).map((w) => w.trim()).filter(Boolean).forEach((w) => addReviewWord(w));
  document.getElementById("custom-words-input").value = "";
}

function addReviewWord(word) {
  const key = word.toLowerCase().trim();
  if (!key) return;
  reviewSelectedWords.add(key);
  renderReviewChips();
}

function renderReviewChips() {
  const container     = document.getElementById("review-chips");
  const countEl       = document.getElementById("chip-count");
  const clearBtn      = document.getElementById("clear-chips-btn");
  const genStoryBtn   = document.getElementById("generate-review-btn");
  const genFlashBtn   = document.getElementById("generate-flashcards-btn");

  countEl.textContent = `(${reviewSelectedWords.size})`;

  if (!reviewSelectedWords.size) {
    container.innerHTML = '<span class="empty-chips">No words selected yet</span>';
    clearBtn.classList.add("hidden");
    genStoryBtn.disabled = true;
    genFlashBtn.disabled = true;
    return;
  }

  container.innerHTML = "";
  reviewSelectedWords.forEach((word) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${escapeHtml(word)}<button class="chip-remove" aria-label="Remove">×</button>`;
    chip.querySelector(".chip-remove").addEventListener("click", () => {
      reviewSelectedWords.delete(word);
      renderReviewChips();
    });
    container.appendChild(chip);
  });

  clearBtn.classList.remove("hidden");
  genStoryBtn.disabled = false;
  genFlashBtn.disabled = false;
}

async function generateReviewStory() {
  const words = Array.from(reviewSelectedWords);
  if (!words.length) return;

  const storyPanel   = document.getElementById("review-story-panel");
  const loadingEl    = document.getElementById("review-loading");
  const storyContent = document.getElementById("review-story-content");
  const errorEl      = document.getElementById("review-error");
  const generateBtn  = document.getElementById("generate-review-btn");

  errorEl.classList.add("hidden");
  storyPanel.classList.remove("hidden");
  loadingEl.classList.remove("hidden");
  storyContent.classList.add("hidden");
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating…";

  try {
    const data = await api("POST", API_LEARNING + "/review", { words });
    document.getElementById("review-story-text").innerHTML = highlightWords(data.story, words);
    loadingEl.classList.add("hidden");
    storyContent.classList.remove("hidden");
    storyPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    loadPastReviews();
  } catch (err) {
    loadingEl.classList.add("hidden");
    storyPanel.classList.add("hidden");
    errorEl.textContent = "Error: " + err.message;
    errorEl.classList.remove("hidden");
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate Story";
  }
}

async function loadPastReviews() {
  const reviews = await api("GET", API_LEARNING + "/reviews").catch(() => []);
  const list = document.getElementById("past-reviews-list");

  if (!reviews.length) {
    list.innerHTML = '<p class="empty-state">No review stories yet. Generate your first one above!</p>';
    return;
  }

  list.innerHTML = "";
  reviews.forEach((r) => {
    const item = document.createElement("div");
    item.className = "past-review-item";
    const wordsHtml = r.words.map((w) => `<span class="tag collocation">${escapeHtml(w)}</span>`).join("");
    const preview = r.story.slice(0, 180) + (r.story.length > 180 ? "…" : "");

    item.innerHTML = `
      <div class="past-review-header">
        <div class="tag-list">${wordsHtml}</div>
        <span class="session-date">${formatDate(r.created_at)}</span>
      </div>
      <p class="past-review-preview">${escapeHtml(preview)}</p>
      <div class="past-review-full hidden">${highlightWords(r.story, r.words)}</div>
      <button class="read-more-btn" data-expanded="false">Read more</button>
    `;
    item.querySelector(".read-more-btn").addEventListener("click", function () {
      const expanded = this.dataset.expanded === "true";
      item.querySelector(".past-review-full").classList.toggle("hidden", expanded);
      item.querySelector(".past-review-preview").classList.toggle("hidden", !expanded);
      this.textContent = expanded ? "Read more" : "Show less";
      this.dataset.expanded = String(!expanded);
    });
    list.appendChild(item);
  });
}

function highlightWords(story, words) {
  let result = escapeHtml(story);
  words.forEach((word) => {
    const safe = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\b(${safe})\\b`, "gi"), '<mark class="vocab-highlight">$1</mark>');
  });
  return result;
}

function formatDateOnly(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}

// ── Flashcards ────────────────────────────────────────────────────────────────

function startFlashcards() {
  const selected = Array.from(reviewSelectedWords);
  if (!selected.length) return;

  // Match selected words against word bank (case-insensitive)
  const bankMap = {};
  wordBankData.forEach((e) => { bankMap[e.word.toLowerCase()] = e; });

  fcCards = selected
    .map((w) => bankMap[w.toLowerCase()])
    .filter(Boolean);

  const missing = selected.filter((w) => !bankMap[w.toLowerCase()]);

  if (!fcCards.length) {
    alert("None of the selected words are in your Word Bank.\nGenerate a Vocabulary Builder lesson for them first.");
    return;
  }

  if (missing.length) {
    const msg = `These words aren't in your Word Bank and will be skipped:\n${missing.join(", ")}\n\nContinue with ${fcCards.length} word(s)?`;
    if (!confirm(msg)) return;
  }

  // Shuffle cards
  fcCards = [...fcCards].sort(() => Math.random() - 0.5);
  fcIndex = 0;
  fcRatings = {};
  fcFlipped = false;

  const panel = document.getElementById("flashcard-panel");
  panel.classList.remove("hidden");
  document.getElementById("fc-summary").classList.add("hidden");
  document.getElementById("fc-rating").classList.add("hidden");

  renderFlashcard(0);
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderFlashcard(idx) {
  const card    = document.getElementById("fc-card");
  const wordEl  = document.getElementById("fc-word");
  const backEl  = document.getElementById("fc-back");
  const counter = document.getElementById("fc-counter");
  const bar     = document.getElementById("fc-progress-bar");
  const ratingEl = document.getElementById("fc-rating");

  // Reset flip
  fcFlipped = false;
  card.classList.remove("flipped");

  const entry = fcCards[idx];
  wordEl.textContent = entry.word;

  // Build back content (reuse word card structure)
  const info = entry.word_info;
  const meaningsHtml = (info.meanings || []).map((m) => `<li>${escapeHtml(m)}</li>`).join("");
  const tagsHtml = (arr, cls) =>
    (arr || []).map((t) => `<span class="tag ${cls}">${escapeHtml(t)}</span>`).join("");
  const examplesHtml = (info.examples || []).slice(0, 1).map((e) => `<li>${escapeHtml(e)}</li>`).join("");

  backEl.innerHTML = `
    <div class="word-card-header">
      <span class="word-title">${escapeHtml(info.word || entry.word)}</span>
      <span class="word-ipa">${escapeHtml(info.ipa || "")}</span>
    </div>
    <div class="word-card-body">
      <div>
        <div class="word-section-label">Meanings</div>
        <ol class="meanings-list">${meaningsHtml}</ol>
      </div>
      <div class="word-row">
        <div>
          <div class="word-section-label">Synonyms</div>
          <div class="tag-list">${tagsHtml(info.synonyms, "synonym")}</div>
        </div>
        <div>
          <div class="word-section-label">Antonyms</div>
          <div class="tag-list">${tagsHtml(info.antonyms, "antonym")}</div>
        </div>
      </div>
      <div>
        <div class="word-section-label">Example</div>
        <ul class="examples-list">${examplesHtml}</ul>
      </div>
    </div>
  `;

  counter.textContent = `Card ${idx + 1} of ${fcCards.length}`;
  bar.style.width = `${((idx) / fcCards.length) * 100}%`;
  ratingEl.classList.add("hidden");
}

// Card scene click → flip
document.getElementById("fc-card-scene").addEventListener("click", () => {
  if (document.getElementById("fc-summary").classList.contains("hidden") === false) return;

  const card = document.getElementById("fc-card");
  const ratingEl = document.getElementById("fc-rating");

  fcFlipped = !fcFlipped;
  card.classList.toggle("flipped", fcFlipped);
  if (fcFlipped) {
    ratingEl.classList.remove("hidden");
  }
});

function fcRate(result) {
  const entry = fcCards[fcIndex];
  fcRatings[entry.word] = result;
  fcIndex++;

  if (fcIndex >= fcCards.length) {
    showFlashcardSummary();
  } else {
    renderFlashcard(fcIndex);
    document.getElementById("fc-rating").classList.add("hidden");
  }
}

document.getElementById("fc-known-btn").addEventListener("click", () => fcRate("known"));
document.getElementById("fc-review-btn").addEventListener("click", () => fcRate("review"));

function showFlashcardSummary() {
  const card    = document.getElementById("fc-card");
  const ratingEl = document.getElementById("fc-rating");
  const bar     = document.getElementById("fc-progress-bar");
  const summary  = document.getElementById("fc-summary");
  const numbersEl = document.getElementById("fc-summary-numbers");

  card.classList.remove("flipped");
  ratingEl.classList.add("hidden");
  bar.style.width = "100%";

  const knownCount  = Object.values(fcRatings).filter((r) => r === "known").length;
  const reviewCount = Object.values(fcRatings).filter((r) => r === "review").length;

  numbersEl.innerHTML = `
    <div class="fc-summary-stat known">
      <span class="num">${knownCount}</span>
      <span class="lbl">Known</span>
    </div>
    <div class="fc-summary-stat review">
      <span class="num">${reviewCount}</span>
      <span class="lbl">Review Again</span>
    </div>
  `;
  summary.classList.remove("hidden");
}

document.getElementById("fc-save-btn").addEventListener("click", async () => {
  const reviews = Object.entries(fcRatings).map(([word, result]) => ({ word, result }));
  try {
    await api("POST", API_LEARNING + "/flashcards/review", { reviews });
  } catch (_) {
    // non-critical — don't block the user
  }
  document.getElementById("flashcard-panel").classList.add("hidden");
  document.getElementById("fc-summary").classList.add("hidden");
});

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
