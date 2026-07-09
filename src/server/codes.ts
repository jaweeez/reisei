import { randomBytes } from 'node:crypto';

/** 8-char share code from an unambiguous alphabet (no 0/O/1/I). Used for Corner and
 *  org invites alike — one code language across the product. */
export function makeCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}
