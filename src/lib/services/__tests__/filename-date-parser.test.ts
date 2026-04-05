import { describe, it, expect, vi, afterEach } from "vitest";
import { parseMeetingDateFromFilename } from "../filename-date-parser";

describe("parseMeetingDateFromFilename", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function fakeNow(dateStr: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(dateStr));
  }

  it('parses "Conscia - 1 Apr at 17-06.m4a"', () => {
    fakeNow("2026-04-03T12:00:00");
    const result = parseMeetingDateFromFilename("Conscia - 1 Apr at 17-06.m4a");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(3); // April
    expect(result!.getDate()).toBe(1);
    expect(result!.getHours()).toBe(17);
    expect(result!.getMinutes()).toBe(6);
  });

  it('parses "Conscia - Laurel - 1 Apr at 17-40.m4a"', () => {
    fakeNow("2026-04-03T12:00:00");
    const result = parseMeetingDateFromFilename(
      "Conscia - Laurel - 1 Apr at 17-40.m4a",
    );
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(3);
    expect(result!.getDate()).toBe(1);
    expect(result!.getHours()).toBe(17);
    expect(result!.getMinutes()).toBe(40);
  });

  it('parses "Conscia - lovesac - 27 Mar at 15-31.m4a"', () => {
    fakeNow("2026-04-03T12:00:00");
    const result = parseMeetingDateFromFilename(
      "Conscia - lovesac - 27 Mar at 15-31.m4a",
    );
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(2); // March
    expect(result!.getDate()).toBe(27);
    expect(result!.getHours()).toBe(15);
    expect(result!.getMinutes()).toBe(31);
  });

  it('parses "Conscia 30 Mar at 16-32.m4a" (no dash separator)', () => {
    fakeNow("2026-04-03T12:00:00");
    const result = parseMeetingDateFromFilename("Conscia 30 Mar at 16-32.m4a");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(30);
    expect(result!.getHours()).toBe(16);
    expect(result!.getMinutes()).toBe(32);
  });

  it("returns null for filename with no date pattern", () => {
    const result = parseMeetingDateFromFilename("random-audio.m4a");
    expect(result).toBeNull();
  });

  it("works with different file extensions (.mp3, .wav, .m4a)", () => {
    fakeNow("2026-04-03T12:00:00");
    for (const ext of [".mp3", ".wav", ".m4a"]) {
      const result = parseMeetingDateFromFilename(
        `Conscia - 1 Apr at 17-06${ext}`,
      );
      expect(result).not.toBeNull();
      expect(result!.getHours()).toBe(17);
      expect(result!.getMinutes()).toBe(6);
    }
  });

  it("uses previous year when parsed month is in the future", () => {
    // Simulate January 2027 — a "Dec" filename should resolve to Dec 2026
    fakeNow("2027-01-15T12:00:00");
    const result = parseMeetingDateFromFilename("Conscia - 5 Dec at 10-30.m4a");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(11); // December
    expect(result!.getDate()).toBe(5);
  });

  it("returns null for partial match without month", () => {
    const result = parseMeetingDateFromFilename("Meeting at 5-30.m4a");
    expect(result).toBeNull();
  });
});
