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

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": "english-buddy/2.0",
    },
    // gpt-oss models spend part of max_tokens on hidden reasoning before writing
    // the visible answer; reasoning_effort keeps that overhead small so JSON
    // output isn't truncated (a "high"-effort call can burn the whole budget
    // on reasoning and return empty content with finish_reason "length").
    body: JSON.stringify({ model, messages, max_tokens, temperature, reasoning_effort }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content && data.choices?.[0]?.finish_reason === "length") {
    throw new Error("Groq response truncated before any content was generated (reasoning consumed the token budget)");
  }
  return content;
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
