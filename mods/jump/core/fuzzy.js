// Fuzzy matching, as fzf does it: each word typed is found in one of the fields, its letters in
// order but not always together ("shpdr" finds "Shepherdr"). Letters together, at the start of
// a word or a camelCase hump score higher; long gaps score lower. A word of 4 letters or more
// also matches with one slip (a letter extra, missing or wrong, or two letters swapped), for
// less. score() is null when any word is not found, else higher is better.
const SCORE_MATCH = 16, GAP_START = -3, GAP_EXTEND = -1, BONUS_BOUNDARY = 8, BONUS_START = 10,
  BONUS_CAMEL = 7, BONUS_CONSECUTIVE = 4;
const SEPARATORS = " -_/.#:·,()[]@";
// A match spread wider than this over the text is a coincidence, not a hit.
const spanMax = (n) => Math.max(n * 3, n + 8);
// Slips are looked for only in short fields (names, titles, ids), not in summaries.
const SLIP_FIELD_MAX = 120, SLIP_MIN = 4, SLIP_FACTOR = 0.6;

function bonusAt(text, p) {
  if (p === 0) return BONUS_START;
  const prev = text[p - 1], cur = text[p];
  if (SEPARATORS.includes(prev)) return BONUS_BOUNDARY;
  if (/[a-z]/.test(prev) && /[A-Z]/.test(cur)) return BONUS_CAMEL;
  if (/[A-Za-z]/.test(prev) && /[0-9]/.test(cur)) return BONUS_CAMEL;
  return 0;
}

function scorePositions(text, pos) {
  // A run of letters together keeps the bonus its first letter had (fzf's rule), so a whole
  // word scores above the same letters split over two words.
  let sc = 0, prev = -2, run = 0;
  for (let k = 0; k < pos.length; k++) {
    const p = pos[k], b = bonusAt(text, p);
    sc += SCORE_MATCH;
    if (k === 0) { sc += 2 * b; run = b; }
    else if (p === prev + 1) sc += Math.max(b, run, BONUS_CONSECUTIVE);
    else { sc += GAP_START + GAP_EXTEND * (p - prev - 2) + b; run = b; }
    prev = p;
  }
  return sc;
}

// The best place for word w (lower case) in text: whole, else its letters in order.
function fieldScore(w, text, lower) {
  let best = null;
  for (let i = lower.indexOf(w), n = 0; i >= 0 && n < 8; i = lower.indexOf(w, i + 1), n++) {
    const sc = scorePositions(text, Array.from(w, (_, k) => i + k));
    if (best === null || sc > best) best = sc;
  }
  if (best !== null) return best;
  // Forward to the first place all letters fit, then back from its end for the tightest start.
  // A window spread too wide is skipped and the search goes on after its start.
  for (let from = 0; from < lower.length;) {
    let j = 0, end = -1;
    for (let i = from; i < lower.length; i++) if (lower[i] === w[j] && ++j === w.length) { end = i; break; }
    if (end < 0) return null;
    let start = end;
    for (let k = w.length - 1, i = end; i >= from; i--) if (lower[i] === w[k] && --k < 0) { start = i; break; }
    if (end - start + 1 <= spanMax(w.length)) {
      const pos = [];
      for (let i = start, k = 0; k < w.length; i++) if (lower[i] === w[k]) { pos.push(i); k++; }
      return scorePositions(text, pos);
    }
    from = start + 1;
  }
  return null;
}

// Word w with one slip undone: each letter left out, each neighbouring pair swapped.
function slips(w) {
  const out = new Set();
  for (let i = 0; i < w.length; i++) out.add(w.slice(0, i) + w.slice(i + 1));
  for (let i = 0; i + 1 < w.length; i++) out.add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
  out.delete(w);
  return [...out].filter((v) => v.length >= 3);
}

function wordScore(w, fields) {
  let best = null;
  fields.forEach((f, i) => {
    const sc = fieldScore(w, f.text, f.lower);
    // The first field is what the row is called: a hit there counts a little more.
    if (sc !== null) { const v = i === 0 ? sc * 1.25 : sc; if (best === null || v > best) best = v; }
  });
  if (best !== null || w.length < SLIP_MIN) return best;
  const short = fields.filter((f) => f.text.length <= SLIP_FIELD_MAX);
  for (const v of slips(w)) for (const f of short) {
    const sc = fieldScore(v, f.text, f.lower);
    if (sc !== null) { const s = sc * SLIP_FACTOR; if (best === null || s > best) best = s; }
  }
  return best;
}

export function fuzzyScore(q, ...fields) {
  const fs = fields.filter((f) => f !== undefined && f !== null && f !== "").map((f) => { const text = String(f); return { text, lower: text.toLowerCase() }; });
  let total = 0;
  for (const w of q.toLowerCase().split(/\s+/).filter(Boolean)) {
    const sc = wordScore(w, fs);
    if (sc === null) return null;
    total += sc;
  }
  return total;
}
