import { spawn } from "child_process";

/**
 * Execute the claude CLI. Uses spawn with explicit stdin write
 * because execFile's `input` option is unreliable on Windows.
 */
export async function execClaude(
  args: string[],
  options: { input: string; timeout: number; maxBuffer: number },
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
      shell: true,
      timeout: options.timeout,
    });

    const chunks: Buffer[] = [];
    let totalSize = 0;
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (data: Buffer) => {
      totalSize += data.length;
      if (totalSize > options.maxBuffer) {
        child.kill();
        reject(new Error("maxBuffer exceeded"));
        return;
      }
      chunks.push(data);
    });

    child.stderr.on("data", (data: Buffer) => {
      stderrChunks.push(data);
    });

    child.on("error", (err: Error & { code?: string }) => {
      reject(err);
    });

    child.on("close", (code) => {
      const stdout = Buffer.concat(chunks).toString("utf-8");
      if (code === 0 && stdout.length > 0) {
        resolve(stdout);
      } else {
        const stderr = Buffer.concat(stderrChunks).toString("utf-8");
        const error = new Error(
          `Command failed: claude ${args.join(" ")} ${stderr || stdout}`.trim(),
        ) as Error & { code?: string; killed?: boolean };
        error.code = code !== null ? String(code) : undefined;
        error.killed = child.killed;
        reject(error);
      }
    });

    // Write prompt to stdin immediately
    child.stdin.write(options.input);
    child.stdin.end();
  });
}
