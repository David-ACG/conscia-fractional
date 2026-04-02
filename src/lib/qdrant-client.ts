import { QdrantClient } from "@qdrant/js-client-rest";

export const COLLECTION_NAME = "fractionalbuddy_docs";

let client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!client) {
    const url = process.env.QDRANT_URL ?? "http://192.168.178.50:6333";
    const apiKey = process.env.QDRANT_API_KEY;

    client = new QdrantClient({
      url,
      ...(apiKey ? { apiKey } : {}),
    });
  }
  return client;
}

export async function ensureCollection(
  name: string,
  vectorSize: number = 4096,
): Promise<void> {
  const qdrant = getQdrantClient();

  try {
    await qdrant.getCollection(name);
    // Collection already exists — no-op
  } catch {
    // Collection does not exist — create it
    await qdrant.createCollection(name, {
      vectors: {
        size: vectorSize,
        distance: "Cosine",
      },
    });
  }
}
