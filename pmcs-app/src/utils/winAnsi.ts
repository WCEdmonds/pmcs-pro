// pdf-lib's standard fonts (Helvetica) use WinAnsi encoding and throw on any
// character outside it, which used to make DA 2404 generation fail for names
// like "Nguyễn", check marks or emoji.

const REPLACEMENTS: Record<string, string> = {
  '‘': "'", '’': "'", '‚': "'", '‛': "'", '′': "'",
  '“': '"', '”': '"', '„': '"', '‟': '"', '″': '"',
  '‐': '-', '‑': '-', '‒': '-', '–': '-', '—': '-', '―': '-', '−': '-',
  '…': '...', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', '​': '',
  '•': '*', '·': '.', '✓': 'OK', '✔': 'OK', '✗': 'X', '✘': 'X',
  '←': '<-', '→': '->', '≤': '<=', '≥': '>=', '½': '1/2', '¼': '1/4', '¾': '3/4',
  'Đ': 'D', 'đ': 'd', 'Ł': 'L', 'ł': 'l', 'Ø': 'O', 'ø': 'o', 'ı': 'i',
  'ß': 'ss', 'Æ': 'AE', 'æ': 'ae', 'Œ': 'OE', 'œ': 'oe',
  '\t': ' ', '\r': ' ',
};

/** Printable ASCII plus newline. Everything else is mapped or replaced with '?'. */
function isSafe(code: number): boolean {
  return code === 10 || (code >= 0x20 && code <= 0x7e);
}

export function sanitizeWinAnsi(input: string | null | undefined): string {
  if (!input) return '';
  let out = '';
  for (const ch of input.normalize('NFKD')) {
    const code = ch.codePointAt(0)!;
    // Combining diacritical marks (left over from NFKD decomposition)
    if ((code >= 0x0300 && code <= 0x036f) || (code >= 0x1ab0 && code <= 0x1aff) || (code >= 0x1dc0 && code <= 0x1dff) || (code >= 0x20d0 && code <= 0x20ff) || (code >= 0xfe20 && code <= 0xfe2f)) {
      continue;
    }
    // Variation selectors / zero-width joiners (emoji sequences)
    if ((code >= 0xfe00 && code <= 0xfe0f) || code === 0x200d) continue;
    if (isSafe(code)) {
      out += ch;
    } else if (REPLACEMENTS[ch] !== undefined) {
      out += REPLACEMENTS[ch];
    } else {
      out += '?';
    }
  }
  return out;
}

/** Single-line variant for form text fields. */
export function sanitizeLine(input: string | null | undefined): string {
  return sanitizeWinAnsi(input).replace(/\n+/g, ' ').trim();
}
