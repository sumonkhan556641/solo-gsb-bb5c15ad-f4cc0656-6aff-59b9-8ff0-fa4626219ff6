import { useState } from 'react'
import { Frac, reduce } from '../lib/frac'
import { Solution } from '../lib/solver'
import { formatPercent, formatRatio, solutionToText } from '../lib/format'
import GearDiagram from './GearDiagram'

interface SolutionCardProps {
  index: number
  target: Frac
  solution: Solution
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 落到兼容方案
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export default function SolutionCard({ index, target, solution }: SolutionCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const ok = await copyText(solutionToText(index, target, solution))
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <article className="solution-card">
      <header className="solution-head">
        <div className="solution-rank">#{index + 1}</div>
        <div className="solution-metrics">
          <span className="metric">
            <span className="metric-label">总传动比</span>
            <strong>{formatRatio(solution.total)}</strong>
          </span>
          <span className="metric">
            <span className="metric-label">相对误差</span>
            <strong className={index === 0 ? 'metric-best' : ''}>{formatPercent(solution.error)}</strong>
          </span>
          <span className="metric">
            <span className="metric-label">总齿数</span>
            <strong>{solution.totalTeeth}</strong>
          </span>
        </div>
        <button type="button" className="copy-btn" onClick={handleCopy}>
          {copied ? '已复制 ✓' : '复制方案'}
        </button>
      </header>

      <div className="solution-body">
        <ol className="stage-rows">
          {solution.pairs.map((p, i) => (
            <li key={i} className="stage-row">
              <span className="stage-no">第{i + 1}级</span>
              <span className="gear-badge gear-badge-driver">主动 {p.driver} 齿</span>
              <span className="stage-arrow">→</span>
              <span className="gear-badge gear-badge-driven">从动 {p.driven} 齿</span>
              <span className="stage-ratio">
                级比 = {reduce(p.ratio).d === 1n ? reduce(p.ratio).n.toString() : `${reduce(p.ratio).n}/${reduce(p.ratio).d}`}
              </span>
              <span className="stage-diff">齿差 {Math.abs(p.driven - p.driver)}</span>
            </li>
          ))}
        </ol>
        <div className="diagram-wrap">
          <GearDiagram pairs={solution.pairs} />
        </div>
      </div>
    </article>
  )
}
