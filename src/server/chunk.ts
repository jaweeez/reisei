// Split scraped page text into ~600-token passages for embedding. Voyage's
// contextualized model sees a page's sibling chunks as context, so we pack whole
// paragraphs and skip overlap — clean, non-duplicated passages. Server/script-only.

export interface TextChunk {
  content: string;
  index: number;
}

const MAX_CHARS = 2200; // ~550 tokens at ~4 chars/token
const MIN_CHARS = 160; // drop nav scraps / tiny fragments

/** Light cleanup of Tavily markdown: drop images, cookie/nav boilerplate, collapse blank runs. */
export function cleanMarkdown(md: string): string {
  const kept: string[] = [];
  for (const raw of md.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const t = line.trim();
    if (!t) {
      kept.push('');
      continue;
    }
    if (/^!\[/.test(t) || /^\[!\[/.test(t)) continue;
    if (
      t.length < 130 &&
      /(cookie|skip to (main )?content|toggle navigation|breadcrumb|back to top|©\s*\d{4}|all rights reserved|privacy policy|terms of use)/i.test(t)
    )
      continue;
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Cleaned text → ~600-token passages on paragraph boundaries. */
export function chunkText(text: string): TextChunk[] {
  const clean = cleanMarkdown(text);
  if (!clean) return [];
  const paras = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: TextChunk[] = [];
  let buf = '';
  const push = () => {
    const c = buf.trim();
    if (c.length >= MIN_CHARS) chunks.push({ content: c, index: chunks.length });
    buf = '';
  };
  for (const p of paras) {
    if (p.length > MAX_CHARS) {
      push();
      for (let i = 0; i < p.length; i += MAX_CHARS) {
        const piece = p.slice(i, i + MAX_CHARS).trim();
        if (piece.length >= MIN_CHARS) chunks.push({ content: piece, index: chunks.length });
      }
      continue;
    }
    if (buf && buf.length + p.length + 2 > MAX_CHARS) push();
    buf = buf ? `${buf}\n\n${p}` : p;
  }
  push();
  if (chunks.length === 0 && clean.length >= 60) chunks.push({ content: clean, index: 0 });
  return chunks;
}
