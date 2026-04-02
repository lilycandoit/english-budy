"""AI service with pluggable providers (Groq, Gemini, or mock rules)."""

from __future__ import annotations

import json
import os
import re
import socket
from urllib import error, request

MISTAKE_TYPES = ("grammar", "spelling", "punctuation", "vocabulary", "no_mistake")

# System messages (role context, kept short — Groq caches these)
_SYSTEM_CORRECTION = "You are an English writing assistant. Reply with valid JSON only."
_SYSTEM_LESSON     = "You are an English teacher. Reply with valid JSON only."
_SYSTEM_REVIEW     = "You are a creative English teacher. Reply with valid JSON only."

# User-turn messages (task + format, no role repetition)
_USER_CORRECTION = (
    "Correct this sentence. Return JSON: "
    '{{"corrected_text":"...","mistake_type":"grammar|spelling|punctuation|vocabulary|no_mistake","explanation":"one sentence"}}.'
    "\n\nSentence: {text}"
)

_USER_LESSON = (
    "Words to study: {words}\n\n"
    "For EACH word return a detailed entry. Also write exactly 5 quiz questions testing meaning and usage.\n\n"
    "Return JSON:\n"
    '{{"words":[{{'
    '"word":"...","ipa":"...","stress":"stressed syllable in CAPS e.g. re-SIL-i-ent",'
    '"meanings":["technical/specific meaning first if applicable","general meaning — max 2 total"],'
    '"synonyms":["3-4 words"],'
    '"antonyms":["2-3 words"],'
    '"collocations":["3 natural phrases using the word"],'
    '"examples":["Australian English style sentence","second example sentence"]'
    '}}],'
    '"quiz":[{{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correct":"A","explanation":"one sentence"}}]}}'
)


_USER_REVIEW_STORY = (
    "Write a natural, engaging 250-word story that uses ALL of these vocabulary words: {words}\n\n"
    "Use each word in a context that makes its meaning clear from the surrounding text. "
    "The story should have a clear beginning, middle, and end.\n\n"
    'Return JSON: {{"story":"full story text here"}}'
)


def correct_sentence(text: str) -> dict:
    """
    Analyze a sentence and return a correction result.

    Returns:
        {
            "corrected_text": str,
            "mistake_type": str,   # one of MISTAKE_TYPES
            "explanation": str,
        }
    """
    normalized = text.strip()
    if not normalized:
        return {
            "corrected_text": "",
            "mistake_type": "no_mistake",
            "explanation": "Text is empty.",
        }

    provider = os.getenv("AI_PROVIDER", "mock").strip().lower()

    if provider == "groq":
        result = _correct_with_groq(normalized)
        if result:
            return result
    elif provider == "gemini":
        result = _correct_with_gemini(normalized)
        if result:
            return result

    return _apply_rules(normalized)


def generate_lesson(words: list[str]) -> dict | None:
    """
    Generate a story + 5-question quiz for the given vocabulary words.

    Returns:
        {
            "story": str,
            "quiz": [{"question", "options", "correct", "explanation"}, ...]
        }
        or None on failure.
    """
    words_str = ", ".join(words)
    provider = os.getenv("AI_PROVIDER", "mock").strip().lower()

    if provider == "groq":
        return _call_groq_raw(words_str)
    elif provider == "gemini":
        return _call_gemini_raw(words_str)

    return None


def generate_review_story(words: list[str]) -> str | None:
    """Generate a 250-word review story using the given vocab words. Returns story string or None."""
    words_str = ", ".join(words)
    provider = os.getenv("AI_PROVIDER", "mock").strip().lower()

    if provider == "groq":
        return _call_groq_review(words_str)
    elif provider == "gemini":
        return _call_gemini_review(words_str)
    return None


def _call_groq_review(words_str: str) -> str | None:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return None

    payload = {
        "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        "response_format": {"type": "json_object"},
        "temperature": 0.8,
        "max_tokens": 500,
        "messages": [
            {"role": "system", "content": _SYSTEM_REVIEW},
            {"role": "user", "content": _USER_REVIEW_STORY.format(words=words_str)},
        ],
    }
    headers = {"Authorization": f"Bearer {os.getenv('GROQ_API_KEY','').strip()}", "Content-Type": "application/json"}
    raw = _post_json("https://api.groq.com/openai/v1/chat/completions", payload, headers)
    if not raw:
        return None
    try:
        content = raw["choices"][0]["message"]["content"]
        return json.loads(content).get("story")
    except (KeyError, IndexError, TypeError, json.JSONDecodeError):
        return None


def _call_gemini_review(words_str: str) -> str | None:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )
    combined = _SYSTEM_REVIEW + "\n\n" + _USER_REVIEW_STORY.format(words=words_str)
    payload = {
        "contents": [{"role": "user", "parts": [{"text": combined}]}],
        "generationConfig": {"temperature": 0.8, "maxOutputTokens": 500, "responseMimeType": "application/json"},
    }
    raw = _post_json(url, payload, {"Content-Type": "application/json"})
    if not raw:
        return None
    try:
        content = raw["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(content).get("story")
    except (KeyError, IndexError, TypeError, json.JSONDecodeError):
        return None


def _call_groq_raw(words_str: str) -> dict | None:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return None

    payload = {
        "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        "response_format": {"type": "json_object"},
        "temperature": 0.7,
        "max_tokens": 1500,
        "messages": [
            {"role": "system", "content": _SYSTEM_LESSON},
            {"role": "user", "content": _USER_LESSON.format(words=words_str)},
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    raw = _post_json("https://api.groq.com/openai/v1/chat/completions", payload, headers)
    if not raw:
        return None
    try:
        content = raw["choices"][0]["message"]["content"]
        return json.loads(content)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError):
        return None


def _call_gemini_raw(words_str: str) -> dict | None:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("[ai_service] GEMINI_API_KEY is not set")
        return None

    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )
    combined = _SYSTEM_LESSON + "\n\n" + _USER_LESSON.format(words=words_str)
    payload = {
        "contents": [{"role": "user", "parts": [{"text": combined}]}],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 1500,
            "responseMimeType": "application/json",
        },
    }
    raw = _post_json(url, payload, {"Content-Type": "application/json"})
    if not raw:
        return None
    try:
        content = raw["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(content)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError):
        return None


def _correct_with_groq(text: str) -> dict | None:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return None

    payload = {
        "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "max_tokens": 150,
        "messages": [
            {"role": "system", "content": _SYSTEM_CORRECTION},
            {"role": "user", "content": _USER_CORRECTION.format(text=text)},
        ],
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    raw = _post_json("https://api.groq.com/openai/v1/chat/completions", payload, headers)
    if not raw:
        return None

    try:
        content = raw["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        return _normalize_result(parsed)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError):
        return None


def _correct_with_gemini(text: str) -> dict | None:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )

    combined = _SYSTEM_CORRECTION + "\n\n" + _USER_CORRECTION.format(text=text)
    payload = {
        "contents": [{"role": "user", "parts": [{"text": combined}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 150,
            "responseMimeType": "application/json",
        },
    }

    raw = _post_json(url, payload, {"Content-Type": "application/json"})
    if not raw:
        return None

    try:
        content = raw["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(content)
        return _normalize_result(parsed)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError):
        return None


def _post_json(url: str, payload: dict, headers: dict) -> dict | None:
    data = json.dumps(payload).encode("utf-8")
    all_headers = {"User-Agent": "english-buddy/1.0", **headers}
    req = request.Request(url, data=data, headers=all_headers, method="POST")
    timeout_seconds = float(os.getenv("AI_TIMEOUT_SECONDS", "40"))

    try:
        with request.urlopen(req, timeout=timeout_seconds) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[ai_service] HTTP {e.code} from API: {body[:300]}")
        return None
    except error.URLError as e:
        print(f"[ai_service] URL error: {e.reason}")
        return None
    except (TimeoutError, socket.timeout, json.JSONDecodeError, ValueError, OSError) as e:
        print(f"[ai_service] Error: {e}")
        return None


def _normalize_result(payload: dict) -> dict | None:
    corrected_text = str(payload.get("corrected_text", "")).strip()
    mistake_type = str(payload.get("mistake_type", "")).strip().lower()
    explanation = str(payload.get("explanation", "")).strip()

    if not corrected_text:
        return None
    if mistake_type not in MISTAKE_TYPES:
        mistake_type = "no_mistake"
    if not explanation:
        explanation = "No explanation provided."

    return {
        "corrected_text": corrected_text,
        "mistake_type": mistake_type,
        "explanation": explanation,
    }


# ---------------------------------------------------------------------------
# Mock rules — replace this entire section when connecting to real AI
# ---------------------------------------------------------------------------

_RULES = [
    # (pattern, replacement, type, explanation)
    (
        r"\bi\b",
        "I",
        "grammar",
        'The pronoun "I" is always capitalized in English.',
    ),
    (
        r"\bim\b",
        "I'm",
        "grammar",
        '"im" should be "I\'m" — a contraction of "I am".',
    ),
    (
        r"\bdont\b",
        "don't",
        "grammar",
        '"dont" is missing an apostrophe. The correct form is "don\'t".',
    ),
    (
        r"\bcant\b",
        "can't",
        "grammar",
        '"cant" is missing an apostrophe. The correct form is "can\'t".',
    ),
    (
        r"\bwont\b",
        "won't",
        "grammar",
        '"wont" is missing an apostrophe. The correct form is "won\'t".',
    ),
    (
        r"\bisnt\b",
        "isn't",
        "grammar",
        '"isnt" is missing an apostrophe. The correct form is "isn\'t".',
    ),
    (
        r"\bwasnt\b",
        "wasn't",
        "grammar",
        '"wasnt" is missing an apostrophe. The correct form is "wasn\'t".',
    ),
    (
        r"\btheir\s+is\b",
        "there is",
        "grammar",
        '"their" shows possession. Use "there" to refer to a place or existence.',
    ),
    (
        r"\bthere\s+going\b",
        "they're going",
        "grammar",
        'Use "they\'re" (they are) instead of "there" here.',
    ),
    (
        r"\byour\s+welcome\b",
        "you're welcome",
        "grammar",
        '"your" is possessive. Use "you\'re" (you are) here.',
    ),
    (
        r"\bgoed\b",
        "went",
        "grammar",
        '"goed" is not a word. The past tense of "go" is "went".',
    ),
    (
        r"\bteached\b",
        "taught",
        "grammar",
        '"teached" is not correct. The past tense of "teach" is "taught".',
    ),
    (
        r"\bteh\b",
        "the",
        "spelling",
        '"teh" is a common typo for "the".',
    ),
    (
        r"\brecieve\b",
        "receive",
        "spelling",
        'Remember the rule: "i before e except after c". Correct spelling is "receive".',
    ),
    (
        r"\boccured\b",
        "occurred",
        "spelling",
        '"occurred" has double "c" and double "r".',
    ),
    (
        r"\bseperate\b",
        "separate",
        "spelling",
        'Common misspelling. Remember: there is "a rat" in "sep-a-r-ate".',
    ),
    (
        r"\bdefenitely\b",
        "definitely",
        "spelling",
        'Common misspelling. "Definitely" contains "finite".',
    ),
]


def _apply_rules(text: str) -> dict:
    corrected = text
    found_type = "no_mistake"
    found_explanation = "Your sentence looks correct! No issues found."

    # Apply ALL matching rules (real AI does this naturally in one pass)
    for pattern, replacement, mistake_type, explanation in _RULES:
        new_text, count = re.subn(pattern, replacement, corrected, flags=re.IGNORECASE)
        if count > 0:
            corrected = new_text
            # Report the type/explanation of the first mistake found
            if found_type == "no_mistake":
                found_type = mistake_type
                found_explanation = explanation

    # Capitalize first letter
    if corrected:
        corrected = corrected[0].upper() + corrected[1:]

    # Ensure sentence ends with punctuation
    if corrected and corrected[-1] not in ".!?":
        corrected += "."
        if found_type == "no_mistake":
            found_type = "punctuation"
            found_explanation = "A sentence should end with punctuation (. ! or ?)."

    return {
        "corrected_text": corrected,
        "mistake_type": found_type,
        "explanation": found_explanation,
    }
