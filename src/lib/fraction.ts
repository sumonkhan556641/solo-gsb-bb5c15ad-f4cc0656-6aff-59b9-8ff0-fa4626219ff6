/**
 * 精确分数运算 —— 全部基于 bigint，避免多级传动比连乘时的浮点误差。
 */

export interface Fraction {
  /** 分子（正数） */
  readonly n: bigint;
  /** 分母（正数） */
  readonly d: bigint;
}

export const ONE: Fraction = { n: 1n, d: 1n };

export function frac(n: bigint | number, d: bigint | number): Fraction {
  return { n: BigInt(n), d: BigInt(d) };
}

function gcdBig(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

export function reduce(f: Fraction): Fraction {
  if (f.n === 0n) return { n: 0n, d: 1n };
  const g = gcdBig(f.n, f.d);
  return { n: f.n / g, d: f.d / g };
}

export function mul(a: Fraction, b: Fraction): Fraction {
  return { n: a.n * b.n, d: a.d * b.d };
}

export function cmp(a: Fraction, b: Fraction): -1 | 0 | 1 {
  // 交叉相乘比较，无需约分
  const lhs = a.n * b.d;
  const rhs = b.n * a.d;
  if (lhs < rhs) return -1;
  if (lhs > rhs) return 1;
  return 0;
}

/** 相对误差 |total - target| / target，返回分数（未约分） */
export function relError(total: Fraction, target: Fraction): Fraction {
  // |n/d - tn/td| / (tn/td) = |n*td - tn*d| / (d*tn)
  const diff = total.n * target.d - target.n * total.d;
  return { n: diff < 0n ? -diff : diff, d: total.d * target.n };
}

/**
 * 解析目标传动比输入。
 * 支持：整数 / 小数（如 6、6.5）、分数（如 12/7、12:7、1+2/3）。
 */
export function parseFraction(input: string): Fraction | null {
  const s = input.trim();
  if (!s) return null;

  // 形如 1+2/3 的带分数
  const mixed = /^(\d+)\s*\+\s*(\d+)\s*[\/:]\s*(\d+)$/.exec(s);
  if (mixed) {
    const whole = BigInt(mixed[1]);
    const num = BigInt(mixed[2]);
    const den = BigInt(mixed[3]);
    if (den === 0n) return null;
    return reduce({ n: whole * den + num, d: den });
  }

  // 形如 12/7 或 12:7
  const ratio = /^(\d+)\s*[\/:]\s*(\d+)$/.exec(s);
  if (ratio) {
    const num = BigInt(ratio[1]);
    const den = BigInt(ratio[2]);
    if (den === 0n) return null;
    return reduce({ n: num, d: den });
  }

  // 形如 6.25 的小数
  const decimal = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (decimal) {
    const intPart = decimal[1];
    const fracPart = decimal[2] ?? '';
    const trimmed = fracPart.replace(/0+$/, '');
    if (trimmed.length > 12) return null;
    const den = 10n ** BigInt(trimmed.length);
    const num = BigInt(intPart) * den + (trimmed ? BigInt(trimmed) : 0n);
    return reduce({ n: num, d: trimmed.length ? den : 1n });
  }

  return null;
}

/** 分数转小数字符串（固定小数位） */
export function toDecimal(f: Fraction, digits = 6): string {
  const scale = 10n ** BigInt(digits);
  const scaled = (f.n * scale * 10n) / f.d; // 多取一位用于四舍五入
  const rounded = (scaled + 5n) / 10n;
  const int = rounded / scale;
  const dec = rounded % scale;
  if (digits === 0) return int.toString();
  return `${int}.${dec.toString().padStart(digits, '0')}`;
}

/** 相对误差转百分比字符串 */
export function relErrorPct(err: Fraction, digits = 4): string {
  const pctScale = 100n;
  const scale = 10n ** BigInt(digits + 2); // 多两位用于百分号换算
  const scaled = (err.n * pctScale * scale * 10n) / err.d;
  const rounded = (scaled + 5n) / 10n;
  const int = rounded / scale;
  const dec = rounded % scale;
  if (digits === 0) return `${int.toString()}%`;
  return `${int}.${dec.toString().padStart(digits, '0')}%`;
}
