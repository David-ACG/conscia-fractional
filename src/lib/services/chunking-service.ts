export interface Chunk {
  text: string;
  index: number;
  startChar: number;
  endChar: number;
}

export interface DocumentMetadata {
  documentId: string;
  name: string;
  sourceType: string;
  crmCustomerId?: string;
  userId: string;
}

export interface PreparedChunk {
  text: string;
  index: number;
  metadata: DocumentMetadata;
}

const DEFAULT_CHUNK_SIZE = 2000;
const DEFAULT_OVERLAP = 300;

function splitAtSentenceBoundaries(text: string, maxSize: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) ?? [text];
  const parts: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (sentence.length > maxSize) {
      // Hard break on oversized sentence
      if (current) {
        parts.push(current.trimEnd());
        current = "";
      }
      for (let i = 0; i < sentence.length; i += maxSize) {
        parts.push(sentence.slice(i, i + maxSize).trimEnd());
      }
    } else if ((current + sentence).length > maxSize) {
      if (current) parts.push(current.trimEnd());
      current = sentence;
    } else {
      current += sentence;
    }
  }

  if (current.trim()) parts.push(current.trimEnd());
  return parts;
}

export function chunkText(
  text: string,
  options?: { chunkSize?: number; overlap?: number },
): Chunk[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;

  if (!text || !text.trim()) return [];

  const paragraphs = text.split(/\n\n+/);
  const chunks: Chunk[] = [];
  let currentText = "";
  let currentStart = 0;
  let charPos = 0;

  function pushChunk() {
    const trimmed = currentText.trimEnd();
    if (trimmed) {
      chunks.push({
        text: trimmed,
        index: chunks.length,
        startChar: currentStart,
        endChar: currentStart + trimmed.length,
      });
    }
  }

  function getOverlapText(text: string): string {
    if (text.length <= overlap) return text;
    // Try to break at a sentence boundary within the overlap window
    const tail = text.slice(-overlap);
    const sentenceBreak = tail.search(/[.!?]\s+\S/);
    if (sentenceBreak !== -1) {
      return tail.slice(sentenceBreak + 1).trimStart();
    }
    return tail;
  }

  for (const paragraph of paragraphs) {
    const paragraphActualStart = text.indexOf(paragraph, charPos);
    const paragraphEnd = paragraphActualStart + paragraph.length;

    if (paragraph.length > chunkSize) {
      // Flush current buffer first
      if (currentText.trim()) {
        pushChunk();
        currentText = getOverlapText(currentText);
        currentStart = currentStart + currentText.length;
      }

      // Split large paragraph at sentence boundaries
      const subParts = splitAtSentenceBoundaries(paragraph, chunkSize);
      for (const part of subParts) {
        if ((currentText + part).length > chunkSize && currentText.trim()) {
          pushChunk();
          currentText = getOverlapText(currentText);
          currentStart = paragraphActualStart;
        }
        currentText += (currentText ? " " : "") + part;
      }
    } else if (
      currentText &&
      (currentText + "\n\n" + paragraph).length > chunkSize
    ) {
      pushChunk();
      const overlapText = getOverlapText(currentText);
      currentStart = paragraphActualStart - overlapText.length;
      currentText = overlapText ? overlapText + "\n\n" + paragraph : paragraph;
    } else {
      if (!currentText) {
        currentStart = paragraphActualStart;
        currentText = paragraph;
      } else {
        currentText += "\n\n" + paragraph;
      }
    }

    charPos = paragraphEnd + 2; // account for \n\n
  }

  if (currentText.trim()) pushChunk();

  // Re-index
  return chunks.map((c, i) => ({ ...c, index: i }));
}

export function chunkDocument(
  content: string,
  metadata: DocumentMetadata,
): PreparedChunk[] {
  const chunks = chunkText(content);
  return chunks.map((chunk) => ({
    text: chunk.text,
    index: chunk.index,
    metadata,
  }));
}
