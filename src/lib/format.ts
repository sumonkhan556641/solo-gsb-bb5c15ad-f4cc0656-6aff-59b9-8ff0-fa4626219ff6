import { Frac, formatFrac, reduce, toNumber } from './frac'
import { Solution } from './solver'

/** 传动比展示：约分分数 + 六位以内小数。 */
export function formatRatio(r: Frac): string {
  const reduced = reduce(r)
  const v = toNumber(reduced)
  const rounded = Math.abs(v - Math.round(v)) < 1e-10 ? String(Math.round(v)) : v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  return reduced.d === 1n ? `${reduced.n}（≈${rounded}）` : `${formatFrac(reduced)}（≈${rounded}）`
}

/** 相对误差百分比展示。 */
export function formatPercent(error: Frac): string {
  const pct = toNumber(error) * 100
  if (pct === 0) return '0%'
  if (pct < 0.0001) return '<0.0001%'
  return `${pct.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%`
}

/** 单方案复制文本。 */
export function solutionToText(index: number, target: Frac, s: Solution): string {
  const lines = s.pairs.map((p, i) => {
    return `  第${i + 1}级：主动 ${p.driver} 齿 → 从动 ${p.driven} 齿，级比 ${formatFrac(reduce(p.ratio))}`
  })
  return [
    `方案 #${index + 1}`,
    `目标传动比：${formatFrac(reduce(target))}`,
    `配齿：`,
    ...lines,
    `总传动比：${formatFrac(s.total)}`,
    `总齿数：${s.totalTeeth}`,
    `相对误差：${formatPercent(s.error)}`
  ].join('\n')
}

/** 全部方案复制文本。 */
export function allSolutionsToText(target: Frac, solutions: Solution[]): string {
  return solutions.map((s, i) => solutionToText(i, target, s)).join('\n——————\n')
}
