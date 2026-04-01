import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const TEST_KEY = "a".repeat(64); // valid 64-char hex string

describe("encryption", () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    vi.resetModules();
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEnv;
  });

  async function getModule() {
    return await import("../encryption");
  }

  it("encrypts and decrypts a simple string", async () => {
    const { encrypt, decrypt } = await getModule();
    const plaintext = "hello world";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("encrypts and decrypts an empty string", async () => {
    const { encrypt, decrypt } = await getModule();
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  it("encrypts and decrypts unicode content", async () => {
    const { encrypt, decrypt } = await getModule();
    const plaintext = "日本語テスト 🎉 émojis & spëcial";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("encrypts and decrypts a long string", async () => {
    const { encrypt, decrypt } = await getModule();
    const plaintext = "x".repeat(10000);
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produces output containing iv, encrypted, and tag fields", async () => {
    const { encrypt } = await getModule();
    const encrypted = encrypt("test");
    const parsed = JSON.parse(encrypted);
    expect(parsed).toHaveProperty("iv");
    expect(parsed).toHaveProperty("encrypted");
    expect(parsed).toHaveProperty("tag");
    expect(typeof parsed.iv).toBe("string");
    expect(typeof parsed.encrypted).toBe("string");
    expect(typeof parsed.tag).toBe("string");
  });

  it("produces different ciphertexts for same plaintext (random IV)", async () => {
    const { encrypt } = await getModule();
    const a = encrypt("same input");
    const b = encrypt("same input");
    expect(a).not.toBe(b);
  });

  it("throws on tampered ciphertext", async () => {
    const { encrypt, decrypt } = await getModule();
    const encrypted = encrypt("secret");
    const parsed = JSON.parse(encrypted);
    parsed.encrypted = "00" + parsed.encrypted.slice(2);
    expect(() => decrypt(JSON.stringify(parsed))).toThrow();
  });

  it("throws on tampered tag", async () => {
    const { encrypt, decrypt } = await getModule();
    const encrypted = encrypt("secret");
    const parsed = JSON.parse(encrypted);
    parsed.tag = "00".repeat(16);
    expect(() => decrypt(JSON.stringify(parsed))).toThrow();
  });

  it("throws on invalid JSON payload", async () => {
    const { decrypt } = await getModule();
    expect(() => decrypt("not-json")).toThrow();
  });

  it("throws when ENCRYPTION_KEY is missing", async () => {
    delete process.env.ENCRYPTION_KEY;
    const { encrypt } = await getModule();
    expect(() => encrypt("test")).toThrow(
      "ENCRYPTION_KEY environment variable is not set",
    );
  });

  it("throws when ENCRYPTION_KEY is wrong length", async () => {
    process.env.ENCRYPTION_KEY = "abcd";
    const { encrypt } = await getModule();
    expect(() => encrypt("test")).toThrow("64-character hex string");
  });

  it("throws when ENCRYPTION_KEY contains non-hex chars", async () => {
    process.env.ENCRYPTION_KEY = "g".repeat(64);
    const { encrypt } = await getModule();
    expect(() => encrypt("test")).toThrow("64-character hex string");
  });
});
