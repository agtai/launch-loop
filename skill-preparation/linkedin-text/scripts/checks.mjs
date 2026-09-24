// Candidate evaluation helpers. Return new values only; never mutate content or persist drafts.
import { sha256 } from './compile.mjs';
export function countText(body) {
  if (typeof body !== 'string') throw new TypeError('Body must be a string');
  return {codePoints:[...body].length,utf16:body.length,withinLocalLimit:body.length <= 3000};
}
export function applySelection({body,expectedBodyHash,sourceRevision,currentRevision,start,end,selectedText,replacement}) {
  if (typeof body !== 'string' || typeof replacement !== 'string' || typeof selectedText !== 'string') throw new TypeError('Text required');
  if (!Number.isInteger(sourceRevision) || !Number.isInteger(currentRevision) || sourceRevision < 0 || sourceRevision !== currentRevision || sha256(body) !== expectedBodyHash) throw new Error('stale_source');
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > body.length || body.slice(start,end) !== selectedText) throw new Error('selection_mismatch');
  const splitsSurrogate = i => i > 0 && i < body.length && /[\uD800-\uDBFF]/.test(body[i-1]) && /[\uDC00-\uDFFF]/.test(body[i]);
  if (splitsSurrogate(start) || splitsSurrogate(end)) throw new Error('surrogate_boundary');
  return body.slice(0,start) + replacement + body.slice(end);
}
