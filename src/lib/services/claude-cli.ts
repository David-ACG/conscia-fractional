import { execClaude } from "./claude-exec";

export interface ClaudeCliOptions {
  /** Timeout in milliseconds (default: 120000 = 2 min) */
  timeout?: number;
  /** Max output buffer in bytes (default: 10MB) */
  maxBuffer?: number;
}

export interface ClaudeCliResult {
  /** The text result from Claude */
  text: string;
}

/**
 * Call Claude via `claude -p --output-format json` (uses Claude Max subscription, no API key needed).
 * The prompt is passed via stdin.
 */
export async function callClaude(
  prompt: string,
  options?: ClaudeCliOptions,
): Promise<ClaudeCliResult> {
  const timeout = options?.timeout ?? 120_000;
  const maxBuffer = options?.maxBuffer ?? 1024 * 1024 * 10;

  let stdout: string;
  try {
    stdout = await execClaude(["-p", "--output-format", "json"], {
      input: prompt,
      timeout,
      maxBuffer,
    });
  } catch (err: unknown) {
    const error = err as Error & { code?: string; killed?: boolean };
    if (error.killed || error.code === "ETIMEDOUT") {
      throw new Error(
        `Claude CLI timed out after ${timeout}ms. The transcript may be too long.`,
      );
    }
    if (error.code === "ENOENT") {
      throw new Error(
        "Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code",
      );
    }
    throw new Error(`Claude CLI failed: ${error.message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(
      `Failed to parse Claude CLI JSON output: ${stdout.slice(0, 500)}`,
    );
  }

  // claude --output-format json returns { type: "result", result: "..." }
  const obj = parsed as Record<string, unknown>;
  if (obj.type === "result" && typeof obj.result === "string") {
    return { text: obj.result };
  }

  // Fallback: if it's a string directly
  if (typeof parsed === "string") {
    return { text: parsed };
  }

  throw new Error(
    `Unexpected Claude CLI output format: ${JSON.stringify(parsed).slice(0, 500)}`,
  );
}
