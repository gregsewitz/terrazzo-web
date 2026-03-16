/**
 * Smart sentence-aware truncation.
 *
 * Returns as many complete sentences as fit within `maxChars`.
 * If even the first sentence is too long, falls back to word-boundary truncation with "…".
 * If the full text fits, returns it unchanged.
 */
export function smartTruncate(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text;

  // Split into sentences — handles ". ", "! ", "? ", and "… " as delimiters.
  // We keep the delimiter attached to the sentence that precedes it.
  const sentencePattern = /[^.!?…]+[.!?…]+[\s]*/g;
  const sentences: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = sentencePattern.exec(text)) !== null) {
    sentences.push(match[0]);
  }

  // If regex didn't capture anything (e.g. text has no sentence-ending punctuation),
  // treat the whole text as one "sentence" and fall through to word truncation.
  if (sentences.length === 0) {
    return truncateAtWord(text, maxChars);
  }

  // Accumulate complete sentences up to the budget
  let result = '';
  for (const sentence of sentences) {
    if ((result + sentence).trimEnd().length <= maxChars) {
      result += sentence;
    } else {
      break;
    }
  }

  // If we got at least one sentence, return it trimmed
  if (result.length > 0) {
    return result.trimEnd();
  }

  // First sentence alone exceeds maxChars — fall back to word truncation
  return truncateAtWord(text, maxChars);
}

/** Truncate at the last word boundary before maxChars, append "…" */
function truncateAtWord(text: string, maxChars: number): string {
  const trimmed = text.slice(0, maxChars);
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.4) {
    return trimmed.slice(0, lastSpace).replace(/[,;:\s]+$/, '') + '…';
  }
  return trimmed.replace(/[,;:\s]+$/, '') + '…';
}
