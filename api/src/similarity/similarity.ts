// Deteksi kemiripan kode ala MOSS: normalisasi token (nama variabel/angka
// diseragamkan) -> k-gram -> winnowing fingerprint -> overlap coefficient.
// Tahan terhadap ganti nama variabel & reformatting, bukan sekadar cocok teks.

const PY_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
  'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for',
  'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not',
  'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
  'print', 'range', 'input', 'int', 'str', 'len', 'map', 'list', 'dict', 'set',
]);

function stripComments(code: string): string {
  return code
    .split('\n')
    .map((line) => {
      const i = line.indexOf('#');
      return i >= 0 ? line.slice(0, i) : line;
    })
    .join('\n');
}

function tokenize(code: string): string[] {
  const cleaned = stripComments(code);
  const tokens: string[] = [];
  const re = /[A-Za-z_]\w*|\d+(?:\.\d+)?|[^\s\w]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    const tok = m[0];
    if (/^[A-Za-z_]\w*$/.test(tok)) {
      tokens.push(PY_KEYWORDS.has(tok) ? tok : 'V'); // seragamkan identifier
    } else if (/^\d/.test(tok)) {
      tokens.push('N'); // seragamkan angka
    } else {
      tokens.push(tok);
    }
  }
  return tokens;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function fingerprints(tokens: string[], k = 5, w = 4): Set<number> {
  if (tokens.length < k) {
    return new Set(tokens.length ? [hashStr(tokens.join(' '))] : []);
  }
  const hashes: number[] = [];
  for (let i = 0; i + k <= tokens.length; i++) {
    hashes.push(hashStr(tokens.slice(i, i + k).join(' ')));
  }
  const fp = new Set<number>();
  for (let i = 0; i + w <= hashes.length; i++) {
    let min = hashes[i];
    for (let j = i + 1; j < i + w; j++) if (hashes[j] < min) min = hashes[j];
    fp.add(min);
  }
  if (fp.size === 0) fp.add(Math.min(...hashes));
  return fp;
}

export function codeFingerprint(code: string): Set<number> {
  return fingerprints(tokenize(code));
}

export function similarity(a: Set<number>, b: Set<number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const x of small) if (large.has(x)) inter += 1;
  return inter / Math.min(a.size, b.size);
}
