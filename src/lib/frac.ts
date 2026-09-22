// 精确有理数（bigint 分子/分母），用于无浮点误差地累计各级传动比。

export interface Frac {
  n: bigint
  d: bigint
}

export function frac(n: bigint | number, d: bigint | number = 1n): Frac {
  const cn = typeof n === 'bigint' ? n : BigInt(n)
  const cd = typeof d === 'bigint' ? d : BigInt(d)
  if (cd === 0n) throw new Error('分母不能为 0')
  return { n: cn, d: cd }
}

export function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a
  let y = b < 0n ? -b : b
  while (y !== 0n) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

export function reduce(a: Frac): Frac {
  if (a.n === 0n) return { n: 0n, d: 1n }
  const g = gcd(a.n, a.d)
  const n = a.n / g
  const d = a.d / g
  return d < 0n ? { n: -n, d: -d } : { n, d }
}

export function mul(a: Frac, b: Frac): Frac {
  return { n: a.n * b.n, d: a.d * b.d }
}

export function div(a: Frac, b: Frac): Frac {
  return { n: a.n * b.d, d: a.d * b.n }
}

export function eq(a: Frac, b: Frac): boolean {
  return a.n * b.d === b.n * a.d
}

export function lt(a: Frac, b: Frac): boolean {
  return a.n * b.d < b.n * a.d
}

export function le(a: Frac, b: Frac): boolean {
  return a.n * b.d <= b.n * a.d
}

export function sub(a: Frac, b: Frac): Frac {
  return { n: a.n * b.d - b.n * a.d, d: a.d * b.d }
}

/** 相对误差 |a - b| / b，返回未约分分数（调用方按需比较/约分）。 */
export function relError(a: Frac, b: Frac): Frac {
  const num = a.n * b.d - b.n * a.d
  return { n: num < 0n ? -num : num, d: a.d * b.n }
}

/** 比值转浮点（仅用于展示与对数启发式排序）。 */
export function toNumber(a: Frac): number {
  return Number(a.n) / Number(a.d)
}

/** 展示用约分分数字符串，如 "24/17"；整数仅显示整数。 */
export function formatFrac(a: Frac): string {
  const r = reduce(a)
  return r.d === 1n ? `${r.n}` : `${r.n}/${r.d}`
}

/**
 * 解析目标传动比，支持：
 *   "8"、"3.5"、"0.25"、"24/17"、"8 : 2"（冒号比）、"5%"
 * 无法解析时返回 null。
 */
export function parseRatio(raw: string): Frac | null {
  const s = raw.trim().replace(/\s+/g, '')
  if (!s) return null
  let body = s
  let scale: Frac = { n: 1n, d: 1n }
  if (body.endsWith('%')) {
    body = body.slice(0, -1)
    scale = { n: 1n, d: 100n }
  }
  const parts = body.split(/[/:]/)
  if (parts.length > 2) return null
  const parseDecimal = (t: string): Frac | null => {
    if (!/^[+-]?\d*\.?\d+$/.test(t) && !/^[+-]?\d+\.?\d*$/.test(t)) return null
    const neg = t.startsWith('-')
    if (neg) t = t.slice(1)
    if (!t) return null
    const dot = t.indexOf('.')
    const intPart = dot === -1 ? t : t.slice(0, dot)
    const fracPart = dot === -1 ? '' : t.slice(dot + 1)
    const digits = (intPart || '0') + fracPart
    const n = BigInt(digits) * (neg ? -1n : 1n)
    const d = fracPart ? 10n ** BigInt(fracPart.length) : 1n
    return reduce({ n, d })
  }
  const a = parseDecimal(parts[0])
  if (!a || a.n <= 0n) return null
  if (parts.length === 1) return reduce(mul(a, scale))
  const b = parseDecimal(parts[1])
  if (!b || b.n <= 0n) return null
  return reduce(mul(div(a, b), scale))
}
