/**
 * Parses SRT-format meeting transcripts with speaker labels.
 *
 * Expected format per block:
 *   HH:MM:SS,mmm --> HH:MM:SS,mmm [Speaker]
 *   Text content
 *   (blank line)
 */

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  speaker: string;
  text: string;
}

export interface TranscriptMetadata {
  durationMinutes: number;
  speakers: string[];
  segments: TranscriptSegment[];
  fullText: string;
}

function parseTimestamp(ts: string): number {
  // "00:12:34,567" → milliseconds
  const match = ts.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  if (!match) return 0;
  const [, h, m, s, ms] = match;
  return (
    parseInt(h!) * 3600000 +
    parseInt(m!) * 60000 +
    parseInt(s!) * 1000 +
    parseInt(ms!)
  );
}

export function parseTranscript(raw: string): TranscriptMetadata {
  const lines = raw.split("\n");
  const segments: TranscriptSegment[] = [];
  const speakerSet = new Set<string>();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!.trim();

    // Match timestamp line with speaker: "00:00:00,240 --> 00:00:02,540 [Sana]"
    const tsMatch = line.match(
      /^(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})\s*\[([^\]]+)\]$/,
    );

    if (tsMatch) {
      const startMs = parseTimestamp(tsMatch[1]!);
      const endMs = parseTimestamp(tsMatch[2]!);
      const speaker = tsMatch[3]!.trim();
      speakerSet.add(speaker);

      // Collect text lines until blank line or next timestamp
      i++;
      const textLines: string[] = [];
      while (i < lines.length) {
        const textLine = lines[i]!.trim();
        if (textLine === "" || textLine.match(/^\d{2}:\d{2}:\d{2},\d{3}/)) {
          break;
        }
        textLines.push(textLine);
        i++;
      }

      if (textLines.length > 0) {
        segments.push({
          startMs,
          endMs,
          speaker,
          text: textLines.join(" "),
        });
      }
    } else {
      i++;
    }
  }

  // Calculate duration from last segment
  const lastSegment = segments[segments.length - 1];
  const durationMs = lastSegment ? lastSegment.endMs : 0;
  const durationMinutes = Math.round(durationMs / 60000);

  // Build full text with speaker labels
  const fullText = segments.map((s) => `[${s.speaker}]: ${s.text}`).join("\n");

  return {
    durationMinutes,
    speakers: Array.from(speakerSet),
    segments,
    fullText,
  };
}

/**
 * Extract meeting date from filename pattern: "Client_-_topic_-_DD_Mon_at_HH-MM_lang.txt"
 * e.g. "Conscia_-_lovesac_-_27_Mar_at_15-31_eng.txt"
 */
export function parseDateFromFilename(filename: string): string | null {
  const match = filename.match(/(\d{1,2})_([A-Za-z]{3})_at_(\d{1,2})-(\d{2})/);
  if (!match) return null;

  const [, day, monthStr, hour, minute] = match;
  const months: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };
  const month = months[monthStr!];
  if (!month) return null;

  // Assume current year
  const year = new Date().getFullYear();
  return `${year}-${month}-${day!.padStart(2, "0")}T${hour!.padStart(2, "0")}:${minute}:00Z`;
}
