import type { Solution } from './solver';
import { reduce, toDecimal, relErrorPct } from './fraction';

/** 单级齿数比文本，如 48/20 → 12/5 */
export function stageRatioText(z1: number, z2: number): string {
  const r = reduce({ n: BigInt(z2), d: BigInt(z1) });
  return `${r.n}/${r.d}`;
}

/** 复制单个方案到剪贴板所需的纯文本 */
export function formatSolutionText(
  solution: Solution,
  targetText: string,
  targetDecimal: string,
): string {
  const lines: string[] = [];
  lines.push('齿轮配组方案');
  lines.push(`目标传动比：${targetText}（≈ ${targetDecimal}）`);
  lines.push(`级数：${solution.path.length}`);
  lines.push('');
  solution.path.forEach(([z1, z2], i) => {
    const r = reduce({ n: BigInt(z2), d: BigInt(z1) });
    lines.push(
      `第${i + 1}级：主动 ${z1} 齿 → 从动 ${z2} 齿` +
        `（级比 ${z2}/${z1} = ${r.n}/${r.d} ≈ ${toDecimal(r, 4)}）`,
    );
  });
  lines.push('');
  lines.push(`总传动比：${solution.total.n}/${solution.total.d} ≈ ${toDecimal(solution.total, 6)}`);
  lines.push(`相对误差：${relErrorPct(solution.error, 4)}`);
  lines.push(`总齿数：${solution.totalTeeth}`);
  return lines.join('\n');
}

/** 复制前 N 个方案的汇总文本 */
export function formatAllSolutionsText(
  solutions: Solution[],
  targetText: string,
  targetDecimal: string,
): string {
  const header =
    `齿轮配组台 · 方案汇总（共 ${solutions.length} 个）\n` +
    `目标传动比：${targetText}（≈ ${targetDecimal}）\n` +
    '='.repeat(48);
  return solutions
    .map((s, i) => `\n#${i + 1}\n${formatSolutionText(s, targetText, targetDecimal)}`)
    .reduce((acc, body) => `${acc}\n${body}`, header);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 落到下面的兼容方案
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** bigint 计数加千分位 */
export function formatBigInt(n: bigint): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
