export interface DeepgramTranscriptWord {
  word: string;
  start: number; // seconds
  end: number; // seconds
  confidence: number;
  speaker?: number;
  punctuated_word?: string;
}

export interface DeepgramTranscriptAlternative {
  transcript: string;
  confidence: number;
  words: DeepgramTranscriptWord[];
}

export interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
  speaker: string;
  confidence: number;
}

export interface TranscriptionConfig {
  model?: string; // default: 'nova-3'
  language?: string; // default: 'en'
  smart_format?: boolean;
  diarize?: boolean;
  punctuate?: boolean;
  utterances?: boolean;
}
