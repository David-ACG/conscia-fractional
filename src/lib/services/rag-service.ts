import { callClaude } from "./claude-cli";
import { embed } from "./embedding-service";
import { getQdrantClient, COLLECTION_NAME } from "@/lib/qdrant-client";

export interface SearchResult {
  content: string;
  score: number;
  documentName: string;
  sourceType: string;
  chunkIndex: number;
  documentId: string;
}

export interface SearchOptions {
  userId: string;
  crmCustomerId?: string;
  limit?: number;
}

export interface GenerateAnswerResult {
  answer: string;
  sources: { name: string; sourceType: string }[];
}

export async function search(
  query: string,
  options: SearchOptions,
): Promise<SearchResult[]> {
  const { userId, crmCustomerId, limit = 5 } = options;

  const queryVector = await embed(query);

  const qdrant = getQdrantClient();

  const mustFilters: Array<{ key: string; match: { value: string } }> = [
    { key: "user_id", match: { value: userId } },
  ];

  if (crmCustomerId) {
    mustFilters.push({
      key: "crm_customer_id",
      match: { value: crmCustomerId },
    });
  }

  const results = await qdrant.search(COLLECTION_NAME, {
    vector: queryVector,
    limit,
    filter: { must: mustFilters },
    with_payload: true,
  });

  const searchResults: SearchResult[] = results.map((r) => {
    const payload = r.payload as Record<string, unknown>;
    return {
      content: String(payload.content ?? ""),
      score: r.score,
      documentName: String(payload.name ?? ""),
      sourceType: String(payload.source_type ?? ""),
      chunkIndex: Number(payload.chunk_index ?? 0),
      documentId: String(payload.document_id ?? ""),
    };
  });

  return searchResults.sort((a, b) => b.score - a.score);
}

export async function generateAnswer(
  query: string,
  context: SearchResult[],
  options?: { crmCustomerName?: string },
): Promise<GenerateAnswerResult> {
  const { crmCustomerName } = options ?? {};

  const formattedContext = context
    .map(
      (r) =>
        `--- Source: ${r.documentName} (${r.sourceType}) ---\n${r.content}\n\n`,
    )
    .join("");

  const systemPrompt = `You are a helpful assistant for a fractional executive. Answer questions based on the provided context documents about ${crmCustomerName || "this customer"}. Cite your sources by document name. If the context doesn't contain enough information to answer, say so clearly.`;

  const prompt = `${systemPrompt}\n\nContext:\n${formattedContext}\n\nQuestion: ${query}`;

  const result = await callClaude(prompt, { timeout: 60_000 });
  const answer = result.text;

  const seen = new Set<string>();
  const sources: { name: string; sourceType: string }[] = [];
  for (const r of context) {
    const key = `${r.documentName}::${r.sourceType}`;
    if (!seen.has(key)) {
      seen.add(key);
      sources.push({ name: r.documentName, sourceType: r.sourceType });
    }
  }

  return { answer, sources };
}
