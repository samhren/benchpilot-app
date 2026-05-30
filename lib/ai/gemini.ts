// Minimal server-side Google Gemini client. Used by the AI coaching digest.
//
// We deliberately avoid an SDK dependency — the REST `generateContent` endpoint
// is a single fetch and keeps the bundle/footprint small. Calls are server-only
// (the action layer); the API key never reaches the client.
//
// Set GEMINI_API_KEY to enable. GEMINI_MODEL overrides the default model.
// Newest Flash as of 2026-05: gemini-3.5-flash (near-Pro reasoning at Flash
// speed/cost). `gemini-flash-latest` is the always-current alias if preferred.

const DEFAULT_MODEL = "gemini-3.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

// A JSON-schema-ish object in Gemini's OpenAPI subset (type/properties/items/
// enum/required). Passed as responseSchema to force structured output.
export type GeminiSchema = Record<string, unknown>;

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly reason: "not_configured" | "http" | "empty" | "parse",
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

interface GenerateJsonArgs {
  system?: string;
  prompt: string;
  schema: GeminiSchema;
  temperature?: number;
  signal?: AbortSignal;
}

// Generate a JSON object validated against `schema`. Throws GeminiError on any
// failure so callers can branch on `.reason` (e.g. surface "add an API key").
export async function generateJson<T>({
  system,
  prompt,
  schema,
  temperature = 0.4,
  signal,
}: GenerateJsonArgs): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiError("GEMINI_API_KEY is not set", "not_configured");
  }

  const model = geminiModel();
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  };

  const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new GeminiError(
      `Gemini HTTP ${res.status}: ${detail.slice(0, 300)}`,
      "http",
    );
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new GeminiError("Gemini returned no content", "empty");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiError(`Gemini returned non-JSON: ${text.slice(0, 200)}`, "parse");
  }
}
