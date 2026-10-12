// pdf-lib's standard fonts (Helvetica) only encode WinAnsi (Windows-1252) and
// throw on anything else, e.g. 'Nguyễn', '✓' or emoji. Everything drawn or filled
// into a PDF goes through toWinAnsi() first.

// The Windows-1252 characters outside Latin-1 (0x80–0x9F block).
const CP1252_EXTRAS = new Set(
  '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''),
);

function encodable(ch: string): boolean {
  const cp = ch.codePointAt(0)!;
  return (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || CP1252_EXTRAS.has(ch);
}

/**
 * Returns `s` with every character pdf-lib's WinAnsi fonts can encode kept as is,
 * accented letters transliterated (NFKD, combining marks stripped: 'ễ' → 'e'),
 * whitespace/control characters turned into spaces, and anything else replaced with '?'.
 */
export function toWinAnsi(s: string | null | undefined): string {
  if (s == null) return '';
  let out = '';
  for (const ch of String(s)) {
    if (encodable(ch)) { out += ch; continue; }
    const cp = ch.codePointAt(0)!;
    if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0) || /\s/u.test(ch)) { out += ' '; continue; }
    const base = ch.normalize('NFKD').replace(/\p{M}/gu, '');
    const kept = [...base].filter(encodable).join('');
    out += kept && kept.length === [...base].length ? kept : '?';
  }
  return out;
}
