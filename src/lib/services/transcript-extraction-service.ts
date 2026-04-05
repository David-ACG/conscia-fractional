import { callClaude } from "./claude-cli";
import {
  parseTranscript,
  parseDateFromFilename,
} from "@/lib/transcript-parser";

const SYSTEM_PROMPT = `You are a meeting notes assistant for a fractional executive (consultant).
You will receive a meeting transcript and must produce structured JSON output.

Rules:
- Only include WORK-RELATED topics. Exclude all social conversation, small talk, personal stories, jokes.
- Notes should be detailed and actionable, written in third person.
- Tasks must be specific and actionable with clear owners where possible.
- For each task, set confidence: "explicit" if directly stated, "inferred" if implied, "tentative" if uncertain.
- Include source_quote for each task (the relevant quote from the transcript).
- Suggest priority: "high" for time-sensitive or blocking items, "medium" for normal work, "low" for nice-to-haves.
- Suggest assignee_type: "self" if assigned to the consultant (David), "client_team" if assigned to the client's team, "external" if someone else.

Return ONLY valid JSON with this exact structure:
{
  "title": "Brief meeting title",
  "summary": "Detailed work-only meeting notes in markdown format. Use ## headings for major topics, bullet points for details.",
  "tasks": [
    {
      "title": "Task title",
      "description": "Detailed description",
      "priority": "high" | "medium" | "low",
      "assignee": "Person name or null",
      "assignee_type": "self" | "client_team" | "external",
      "confidence": "explicit" | "inferred" | "tentative",
      "source_quote": "Relevant quote from transcript"
    }
  ]
}`;

export interface ExtractionTask {
  title: string;
  description: string;
  priority: string;
  assignee: string | null;
  assignee_type: string;
  confidence: string;
  source_quote: string;
}

export interface ExtractionResult {
  title: string;
  summary: string;
  tasks: ExtractionTask[];
  metadata: {
    durationMinutes: number;
    speakers: string[];
    meetingDate: string | null;
  };
}

export async function extractMeetingData(
  transcript: string,
  filename?: string,
): Promise<ExtractionResult> {
  const metadata = parseTranscript(transcript);
  const meetingDate = filename ? parseDateFromFilename(filename) : null;

  const prompt = `${SYSTEM_PROMPT}\n\nHere is the meeting transcript. Speakers: ${metadata.speakers.join(", ")}. Duration: ${metadata.durationMinutes} minutes.\n\n${metadata.fullText}`;

  const result = await callClaude(prompt, { timeout: 120_000 });

  let rawJson = result.text.trim();
  const codeBlockMatch = rawJson.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    rawJson = codeBlockMatch[1]!.trim();
  }

  let parsed: {
    title: string;
    summary: string;
    tasks: ExtractionTask[];
  };

  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error(`Failed to parse AI response: ${rawJson}`);
  }

  return {
    title: parsed.title,
    summary: parsed.summary,
    tasks: parsed.tasks ?? [],
    metadata: {
      durationMinutes: metadata.durationMinutes,
      speakers: metadata.speakers,
      meetingDate,
    },
  };
}
