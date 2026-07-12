import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encrypt";

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqOptions {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  reasoning_effort?: "low" | "medium" | "high";
}

/** Thrown when Groq rate-limits the request. `retryAfterSeconds` is the wait Groq recommended. */
export class GroqRateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`Groq rate limit reached. Please wait about ${Math.ceil(retryAfterSeconds)}s and try again.`);
    this.name = "GroqRateLimitError";
  }
}

// Only auto-retry a 429 when Groq says the wait is short — a longer wait risks
// exceeding the serverless function's own execution timeout, which would trade
// one failure for a worse, unexplained one.
const RATE_LIMIT_AUTO_RETRY_THRESHOLD_SECONDS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterSeconds(res: Response, bodyText: string): number {
  const header = res.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (!Number.isNaN(seconds)) return seconds;
  }
  const match = bodyText.match(/try again in ([\d.]+)\s*(ms|s)/i);
  if (match) {
    const value = parseFloat(match[1]);
    return match[2].toLowerCase() === "ms" ? value / 1000 : value;
  }
  return 5;
}

/** Fetch the user's decrypted Groq API key from DB. Throws if missing. */
export async function getUserGroqKey(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { groqApiKey: true },
  });
  if (!user?.groqApiKey) {
    throw new Error("NO_GROQ_KEY");
  }
  return decrypt(user.groqApiKey);
}

/** Make a chat completion request to Groq using the user's own API key. */
export async function groqChat(
  apiKey: string,
  messages: GroqMessage[],
  opts: GroqOptions = {}
): Promise<string> {
  const { model = "openai/gpt-oss-120b", max_tokens = 300, temperature = 0.2, reasoning_effort = "low" } = opts;

  const body = JSON.stringify({ model, messages, max_tokens, temperature, reasoning_effort });
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "User-Agent": "english-buddy/2.0",
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers, body });

    if (res.status === 429) {
      const text = await res.text();
      const retryAfterSeconds = parseRetryAfterSeconds(res, text);
      if (attempt === 0 && retryAfterSeconds <= RATE_LIMIT_AUTO_RETRY_THRESHOLD_SECONDS) {
        await sleep(retryAfterSeconds * 1000);
        continue;
      }
      throw new GroqRateLimitError(retryAfterSeconds);
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    // gpt-oss models spend part of max_tokens on hidden reasoning before writing
    // the visible answer; reasoning_effort keeps that overhead small so JSON
    // output isn't truncated (a "high"-effort call can burn the whole budget
    // on reasoning and return empty content with finish_reason "length").
    if (!content && data.choices?.[0]?.finish_reason === "length") {
      throw new Error("Groq response truncated before any content was generated (reasoning consumed the token budget)");
    }
    return content;
  }

  throw new Error("Groq request failed after retry");
}

/**
 * Calls Groq and parses its response as JSON. If parsing fails (the model
 * occasionally emits a stray unescaped character that breaks even the repaired
 * parse in extractJson), retries the whole call once for a fresh sample rather
 * than failing on a single bad generation.
 */
export async function groqChatJson<T>(
  apiKey: string,
  messages: GroqMessage[],
  opts: GroqOptions = {}
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await groqChat(apiKey, messages, opts);
    try {
      return extractJson(raw) as T;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/** Extract the first JSON object from a string (handles markdown code fences). */
export function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in AI response");

  const raw = match[0];

  // Try direct parse first
  try {
    return JSON.parse(raw);
  } catch {
    // AI often returns literal newlines/tabs inside JSON string values, which
    // breaks JSON.parse. Walk char-by-char and escape them only inside strings.
    let out = "";
    let inString = false;
    let escaped = false;

    for (const ch of raw) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\" && inString) {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        out += ch;
        continue;
      }
      if (inString && ch === "\n") { out += "\\n"; continue; }
      if (inString && ch === "\r") { out += "\\r"; continue; }
      if (inString && ch === "\t") { out += "\\t"; continue; }
      out += ch;
    }

    return JSON.parse(out);
  }
}
