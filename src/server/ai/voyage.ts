// Voyage AI embeddings — the CONTEXTUALIZED endpoint (voyage-context-4), mirroring
// the MuWorks house pattern. Each item is embedded as a one-chunk document, so
// document and query vectors share the same space (cosine similarity is valid).
// pgvector columns are vector(1024) to match EMBED_DIMS.

export const EMBED_MODEL = 'voyage-context-4';
export const EMBED_DIMS = 1024;

const VOYAGE_CONTEXTUALIZED_URL = 'https://api.voyageai.com/v1/contextualizedembeddings';

type CtxChunk = { embedding?: unknown; index?: unknown };
type CtxGroup = { data?: unknown; index?: unknown };
const idxOf = (x: unknown): number => (typeof x === 'number' ? x : 0);

/** Parse + strict-validate a /v1/contextualizedembeddings response into [input][chunk][dim]. */
export function parseContextualizedResponse(json: unknown, inputs: string[][], dims: number): number[][][] {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data) || data.length !== inputs.length) {
    throw new Error(
      `Voyage contextualized response: expected ${inputs.length} input group(s), got ${Array.isArray(data) ? data.length : typeof data}`,
    );
  }
  const groups = ([...data] as CtxGroup[]).sort((a, b) => idxOf(a?.index) - idxOf(b?.index));
  return groups.map((group, i) => {
    const chunks = group?.data;
    if (!Array.isArray(chunks) || chunks.length !== inputs[i]!.length) {
      throw new Error(
        `Voyage contextualized response: input ${i} expected ${inputs[i]!.length} chunk(s), got ${Array.isArray(chunks) ? chunks.length : typeof chunks}`,
      );
    }
    const ordered = ([...chunks] as CtxChunk[]).sort((a, b) => idxOf(a?.index) - idxOf(b?.index));
    return ordered.map((c) => {
      const e = c?.embedding;
      if (!Array.isArray(e) || e.length !== dims || typeof e[0] !== 'number') {
        throw new Error(`Voyage contextualized response: embedding dimension ${Array.isArray(e) ? e.length : typeof e} != ${dims}`);
      }
      return e as number[];
    });
  });
}

/** Embed a list of DOCUMENTS (each a list of chunks). Retries 429/5xx + network (3x). */
export async function contextualizedEmbed(inputs: string[][], inputType: 'query' | 'document' = 'document'): Promise<number[][][]> {
  const apiKey = process.env.VOYAGE_API_KEY || process.env.VOYAGE_AI_API_KEY;
  if (!apiKey) throw new Error('VOYAGE_API_KEY / VOYAGE_AI_API_KEY is not set');
  if (!inputs.length) return [];

  const body = JSON.stringify({ model: EMBED_MODEL, inputs, input_type: inputType, output_dimension: EMBED_DIMS });
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(VOYAGE_CONTEXTUALIZED_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body,
      });
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`Voyage ${res.status}`);
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Voyage contextualized embed failed: ${res.status} ${detail.slice(0, 300)}`);
    }
    return parseContextualizedResponse(await res.json(), inputs, EMBED_DIMS);
  }
  throw lastErr instanceof Error ? lastErr : new Error('Voyage contextualized embed failed after retries');
}

/** One text → one 1024-dim vector (as a one-chunk document). */
export async function generateEmbedding(text: string, inputType: 'query' | 'document' = 'document'): Promise<number[]> {
  const [doc] = await contextualizedEmbed([[text]], inputType);
  return doc![0]!;
}

/** Many independent texts → one vector each. Batched at 100. */
export async function generateEmbeddings(texts: string[], inputType: 'query' | 'document' = 'document'): Promise<number[][]> {
  if (texts.length === 0) return [];
  const MAX_PER_CALL = 100;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_PER_CALL) {
    const slice = texts.slice(i, i + MAX_PER_CALL);
    const result = await contextualizedEmbed(slice.map((t) => [t]), inputType);
    out.push(...result.map((doc) => doc[0]!));
  }
  return out;
}

/** Embed many DOCUMENTS (each a list of chunks) with contextualization. Batched by chunk count. */
export async function embedDocuments(docs: string[][], inputType: 'query' | 'document' = 'document', maxChunksPerCall = 120): Promise<number[][][]> {
  const out: number[][][] = [];
  let batch: string[][] = [];
  let count = 0;
  const flush = async () => {
    if (!batch.length) return;
    const res = await contextualizedEmbed(batch, inputType);
    out.push(...res);
    batch = [];
    count = 0;
  };
  for (const doc of docs) {
    const size = Math.max(1, doc.length);
    if (batch.length && count + size > maxChunksPerCall) await flush();
    batch.push(doc);
    count += size;
    if (count >= maxChunksPerCall) await flush();
  }
  await flush();
  return out;
}

export function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}
