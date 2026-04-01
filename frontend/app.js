const API = "/api/mistakes";

// ── DOM refs ────────────────────────────────────────────────────────────────
const input      = document.getElementById("sentence-input");
const submitBtn  = document.getElementById("submit-btn");
const resultBox  = document.getElementById("result");
const filterSel  = document.getElementById("filter-type");

// ── Init ────────────────────────────────────────────────────────────────────
loadHistory();
loadStats();

// ── Events ──────────────────────────────────────────────────────────────────
submitBtn.addEventListener("click", submitSentence);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submitSentence();
  }
});

filterSel.addEventListener("change", loadHistory);

// ── Core actions ─────────────────────────────────────────────────────────────

async function submitSentence() {
  const text = input.value.trim();
  if (!text) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Checking…";

  try {
    const data = await api("POST", "", { text });
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
  await api("DELETE", `/${id}`);
  loadHistory();
  loadStats();
}

// ── Display ──────────────────────────────────────────────────────────────────

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
  const items = await api("GET", url);

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
  const stats = await api("GET", "/stats");
  document.getElementById("stat-total").textContent = stats.total ?? 0;
  document.getElementById("stat-grammar").textContent = stats.by_type?.grammar ?? 0;
  document.getElementById("stat-spelling").textContent = stats.by_type?.spelling ?? 0;
  document.getElementById("stat-punctuation").textContent = stats.by_type?.punctuation ?? 0;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(API + path, opts);
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
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
