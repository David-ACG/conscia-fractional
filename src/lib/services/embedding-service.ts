const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? "http://192.168.178.50:11434";
const MODEL = "qwen3-embedding:8b";
const EXPECTED_DIMENSIONS = 4096;
const MAX_BATCH_SIZE = 10;
const MAX_RETRIES = 3;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOllamaEmbed(input: string | string[]): Promise<number[][]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, input }),
      });

      if (!response.ok) {
        throw new Error(`Ollama responded with status ${response.status}`);
      }

      const data = (await response.json()) as { embeddings: number[][] };

      if (!Array.isArray(data.embeddings) || data.embeddings.length === 0) {
        throw new Error("Ollama returned no embeddings");
      }

      return data.embeddings;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        const backoff = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await sleep(backoff);
      }
    }
  }

  throw new Error(
    `Embedding failed after ${MAX_RETRIES} retries: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

export async function embed(text: string): Promise<number[]> {
  const embeddings = await callOllamaEmbed(text);
  const vector = embeddings[0];

  if (!Array.isArray(vector) || vector.length !== EXPECTED_DIMENSIONS) {
    throw new Error(
      `Expected ${EXPECTED_DIMENSIONS}-dimensional vector, got ${vector?.length ?? 0}`,
    );
  }

  return vector;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const results: number[][] = new Array(texts.length);

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batchTexts = texts.slice(i, i + MAX_BATCH_SIZE);
    const batchEmbeddings = await callOllamaEmbed(batchTexts);

    for (let j = 0; j < batchTexts.length; j++) {
      results[i + j] = batchEmbeddings[j];
    }
  }

  return results;
}
