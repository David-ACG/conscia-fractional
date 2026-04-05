// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecClaude } = vi.hoisted(() => ({
  mockExecClaude:
    vi.fn<
      (
        args: string[],
        options: { input: string; timeout: number; maxBuffer: number },
      ) => Promise<string>
    >(),
}));

vi.mock("../claude-exec", () => ({
  execClaude: mockExecClaude,
}));

import { callClaude } from "../claude-cli";

describe("claude-cli", () => {
  beforeEach(() => {
    mockExecClaude.mockReset();
  });

  it("calls claude with correct arguments and parses result", async () => {
    mockExecClaude.mockResolvedValue(
      JSON.stringify({ type: "result", result: "Hello world" }),
    );

    const result = await callClaude("test prompt");

    expect(result.text).toBe("Hello world");
    expect(mockExecClaude).toHaveBeenCalledWith(
      ["-p", "--output-format", "json"],
      expect.objectContaining({
        input: "test prompt",
        timeout: 120_000,
        maxBuffer: 1024 * 1024 * 10,
      }),
    );
  });

  it("uses custom timeout and maxBuffer", async () => {
    mockExecClaude.mockResolvedValue(
      JSON.stringify({ type: "result", result: "ok" }),
    );

    await callClaude("prompt", { timeout: 60_000, maxBuffer: 1024 });

    expect(mockExecClaude).toHaveBeenCalledWith(
      ["-p", "--output-format", "json"],
      expect.objectContaining({
        timeout: 60_000,
        maxBuffer: 1024,
      }),
    );
  });

  it("throws on ENOENT (claude not installed)", async () => {
    const error = new Error("spawn claude ENOENT") as Error & { code: string };
    error.code = "ENOENT";
    mockExecClaude.mockRejectedValue(error);

    await expect(callClaude("prompt")).rejects.toThrow("Claude CLI not found");
  });

  it("throws on timeout", async () => {
    const error = new Error("timed out") as Error & {
      killed: boolean;
      code: string;
    };
    error.killed = true;
    error.code = "ETIMEDOUT";
    mockExecClaude.mockRejectedValue(error);

    await expect(callClaude("prompt")).rejects.toThrow("timed out");
  });

  it("throws on invalid JSON output", async () => {
    mockExecClaude.mockResolvedValue("not json at all");

    await expect(callClaude("prompt")).rejects.toThrow(
      "Failed to parse Claude CLI JSON output",
    );
  });

  it("throws on unexpected JSON structure", async () => {
    mockExecClaude.mockResolvedValue(
      JSON.stringify({ unexpected: "structure" }),
    );

    await expect(callClaude("prompt")).rejects.toThrow(
      "Unexpected Claude CLI output format",
    );
  });

  it("handles string result directly", async () => {
    mockExecClaude.mockResolvedValue(JSON.stringify("direct string"));

    const result = await callClaude("prompt");
    expect(result.text).toBe("direct string");
  });

  it("passes prompt via input option", async () => {
    mockExecClaude.mockResolvedValue(
      JSON.stringify({ type: "result", result: "ok" }),
    );

    await callClaude("my prompt text");

    expect(mockExecClaude).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ input: "my prompt text" }),
    );
  });
});
