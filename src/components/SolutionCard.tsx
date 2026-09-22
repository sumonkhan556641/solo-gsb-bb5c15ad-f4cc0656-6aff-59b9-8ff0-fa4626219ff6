import { useState } from 'react';
import type { Solution } from '../lib/solver';
import { relErrorPct, toDecimal } from '../lib/fraction';
import { stageRatioText } from '../lib/format';
import GearDiagram from './GearDiagram';

interface SolutionCardProps {
  rank: number;
  solution: Solution;
  onCopy: () => void;
}

/** 单个配组方案：逐级比值表 + 总误差指标 + 可折叠啮合示意 */
export default function SolutionCard({ rank, solution, onCopy }: SolutionCardProps) {
  const [showDiagram, setShowDiagram] = useState(rank <= 3);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article className="solution-card">
      <header className="solution-head">
        <span className={`rank-badge rank-${Math.min(rank, 4)}`}>#{rank}</span>
        <div className="solution-summary">
          <div className="summary-line">
            <span className="summary-main">
              {solution.total.n.toString()}/{solution.total.d.toString()}
            </span>
            <span className="summary-sub">≈ {toDecimal(solution.total, 6)}</span>
          </div>
          <div className="summary-metrics">
            <span className="metric">
              相对误差 <b>{relErrorPct(solution.error, 4)}</b>
            </span>
            <span className="metric">
              总齿数 <b>{solution.totalTeeth}</b>
            </span>
            <span className="metric">
              {solution.path.length} 级传动
            </span>
          </div>
        </div>
        <div className="solution-buttons">
          <button type="button" className="btn small" onClick={handleCopy}>
            {copied ? '✓ 已复制' : '复制方案'}
          </button>
          <button
            type="button"
            className="btn ghost small"
            onClick={() => setShowDiagram((v) => !v)}
          >
            {showDiagram ? '收起示意图' : '啮合示意'}
          </button>
        </div>
      </header>

      <div className="stage-ratio-row">
        {solution.path.map(([z1, z2], i) => (
          <div className="stage-ratio-chip" key={i}>
            <span className="chip-index">L{i + 1}</span>
            <span className="chip-gears">
              {z1} ⇢ {z2}
            </span>
            <span className="chip-ratio">
              {z2}/{z1} = {stageRatioText(z1, z2)}
            </span>
          </div>
        ))}
      </div>

      {showDiagram && (
        <div className="diagram-wrap">
          <GearDiagram solution={solution} />
        </div>
      )}
    </article>
  );
}
