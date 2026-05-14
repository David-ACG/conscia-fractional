import { DeepgramClient } from "@deepgram/sdk";
import type {
  TranscriptSegment,
  TranscriptionConfig,
} from "@/lib/types/transcription";

const DEFAULT_CONFIG: Required<TranscriptionConfig> = {
  model: "nova-3",
  language: "en",
  smart_format: true,
  diarize: true,
  punctuate: true,
  utterances: true,
};

function getClient(): DeepgramClient {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY environment variable is not set");
  }
  return new DeepgramClient({ apiKey });
}

function isRetryableTranscriptionError(error: unknown): boolean {
  const maybeError = error as {
    message?: string;
    statusCode?: number;
    rawResponse?: { status?: number };
  };
  const status = maybeError.statusCode ?? maybeError.rawResponse?.status;
  if (status === 0 || status === 408 || status === 429) return true;
  if (status && status >= 500) return true;

  const message = maybeError.message?.toLowerCase() ?? "";
  return (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("fetch failed")
  );
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTranscriptionRetry<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !isRetryableTranscriptionError(error)) {
        throw error;
      }
      await wait(1500 * attempt);
    }
  }

  throw lastError;
}

interface DeepgramUtterance {
  start?: number;
  end?: number;
  confidence?: number;
  transcript?: string;
  words?: Array<{
    word?: string;
    start?: number;
    end?: number;
    confidence?: number;
    speaker?: number;
    punctuated_word?: string;
  }>;
  speaker?: number;
}

export function deepgramResponseToSegments(
  utterances: DeepgramUtterance[],
): TranscriptSegment[] {
  return utterances.map((utterance) => ({
    text: utterance.transcript ?? "",
    startMs: Math.round((utterance.start ?? 0) * 1000),
    endMs: Math.round((utterance.end ?? 0) * 1000),
    speaker: `Speaker ${(utterance.speaker ?? 0) + 1}`,
    confidence: utterance.confidence ?? 0,
  }));
}

export async function createTemporaryApiKey(): Promise<{
  key: string;
  expiresAt: Date;
}> {
  const client = getClient();

  // Get project list to find the project ID
  const projectsResponse = await client.manage.v1.projects.list();
  const projects = projectsResponse.projects;
  if (!projects || projects.length === 0) {
    throw new Error("No Deepgram projects found");
  }
  const projectId = projects[0]!.projectId!;

  const expiresAt = new Date(Date.now() + 60 * 1000); // 60 seconds TTL

  const response = await client.manage.v1.projects.keys.create(projectId, {
    comment: "Temporary browser streaming key",
    scopes: ["usage:write"],
    expirationDate: expiresAt.toISOString(),
  });

  if (!response.key) {
    throw new Error("Failed to create temporary API key");
  }

  return {
    key: response.key,
    expiresAt,
  };
}

export async function transcribeBatch(
  audioUrl: string,
  config?: TranscriptionConfig,
): Promise<TranscriptSegment[]> {
  const client = getClient();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const response = await withTranscriptionRetry(() =>
    client.listen.v1.media.transcribeUrl({
      url: audioUrl,
      model: mergedConfig.model,
      language: mergedConfig.language,
      smartFormat: mergedConfig.smart_format,
      diarize: mergedConfig.diarize,
      punctuate: mergedConfig.punctuate,
      utterances: mergedConfig.utterances,
    }),
  );

  const utterances = response.results?.utterances ?? [];
  return deepgramResponseToSegments(utterances as DeepgramUtterance[]);
}

export async function transcribeBatchFromBuffer(
  buffer: Buffer,
  mimetype: string,
  config?: TranscriptionConfig,
): Promise<TranscriptSegment[]> {
  const client = getClient();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const blob = new Blob([buffer], { type: mimetype });

  const response = await withTranscriptionRetry(() =>
    client.listen.v1.media.transcribeFile(blob, {
      model: mergedConfig.model,
      language: mergedConfig.language,
      smartFormat: mergedConfig.smart_format,
      diarize: mergedConfig.diarize,
      punctuate: mergedConfig.punctuate,
      utterances: mergedConfig.utterances,
    }),
  );

  const utterances = response.results?.utterances ?? [];
  return deepgramResponseToSegments(utterances as DeepgramUtterance[]);
}
