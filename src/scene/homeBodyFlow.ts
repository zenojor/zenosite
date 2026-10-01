/** Pick a sentence boundary in the original copy, never in a wrapped line. */
export function completeSentencePrefix(text: string, end: number): string {
  let boundary = 0
  for (const match of text.matchAll(/[.!?](?=\s|$)/g)) {
    const next = match.index + 1
    if (next > end) break
    boundary = next
  }
  return text.slice(0, boundary)
}
