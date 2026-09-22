import type { ReactNode } from 'react';
import type { Solution } from '../lib/solver';
import { stageRatioText } from '../lib/format';

interface GearDiagramProps {
  solution: Solution;
}

/**
 * 简化啮合示意图（展开式定轴轮系画法）：
 * - 全台共 n+1 根水平轴；第 i 级主动轮在第 i 轴、从动轮在第 i+1 轴，两轮竖向啮合；
 * - 相邻级之间：上一级从动轮与下一级主动轮位于同一根中间轴上，并排布置（同轴联动）；
 * - 圆半径按全台齿数比例缩放；啮合点标 ⊙，并以一对反向弧线表示两轮转向相反。
 */
export default function GearDiagram({ solution }: GearDiagramProps) {
  const stages = solution.path;
  const n = stages.length;

  const rMin = 12;
  const rMax = 26;
  const shaftGap = 74; // 相邻两根轴的垂直间距
  const colW = 122; // 每一级的水平步距
  const marginX = 26;
  const marginY = 30;
  const shaftOverhang = 14;

  const allTeeth = stages.flatMap(([z1, z2]) => [z1, z2]);
  const maxTeeth = Math.max(...allTeeth);
  const minTeeth = Math.min(...allTeeth);
  const radiusFor = (teeth: number) => {
    if (maxTeeth === minTeeth) return 19;
    const t = (teeth - minTeeth) / (maxTeeth - minTeeth);
    return rMin + t * (rMax - rMin);
  };

  const cx = (stage: number) => marginX + rMax + stage * colW;
  const cy = (shaft: number) => marginY + rMax + shaft * shaftGap;

  const width = marginX * 2 + rMax * 2 + (n - 1) * colW + 132;
  const height = marginY * 2 + rMax * 2 + n * shaftGap;

  const gearColor = (isDriver: boolean) => (isDriver ? '#2f6fb0' : '#c47b2c');

  const gearTicks = (x: number, y: number, r: number, teeth: number, color: string) => {
    const count = Math.max(10, Math.min(26, Math.round(teeth / 3)));
    const ticks: ReactNode[] = [];
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count;
      ticks.push(
        <line
          key={i}
          x1={x + Math.cos(a) * (r + 1)}
          y1={y + Math.sin(a) * (r + 1)}
          x2={x + Math.cos(a) * (r + 4)}
          y2={y + Math.sin(a) * (r + 4)}
          stroke={color}
          strokeWidth={1.5}
        />,
      );
    }
    return ticks;
  };

  const shaftRows: ReactNode[] = [];
  // 输入轴（仅第 1 级主动轮）
  shaftRows.push(
    <line
      key="shaft-in"
      x1={cx(0) - rMax - shaftOverhang}
      y1={cy(0)}
      x2={cx(0) + rMax + 4}
      y2={cy(0)}
      className="shaft-line"
    />,
  );
  // 中间轴 s：第 s 级从动轮 与 第 s+1 级主动轮 同轴
  for (let s = 1; s <= n - 1; s++) {
    shaftRows.push(
      <line
        key={`shaft-mid-${s}`}
        x1={cx(s - 1) - rMax - 4}
        y1={cy(s)}
        x2={cx(s) + rMax + 4}
        y2={cy(s)}
        className="shaft-line"
      />,
    );
  }
  // 输出轴（仅最后一级从动轮）
  shaftRows.push(
    <line
      key="shaft-out"
      x1={cx(n - 1) - rMax - 4}
      y1={cy(n)}
      x2={cx(n - 1) + rMax + shaftOverhang}
      y2={cy(n)}
      className="shaft-line"
    />,
  );

  return (
    <svg className="gear-diagram" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="齿轮啮合示意图">
      <defs>
        <marker id="arrowhead" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="#64748b" />
        </marker>
      </defs>

      {shaftRows}

      {stages.map(([z1, z2], i) => {
        const x = cx(i);
        const yTop = cy(i);
        const yBot = cy(i + 1);
        const r1 = radiusFor(z1);
        const r2 = radiusFor(z2);
        const yMid = (yTop + yBot) / 2;
        const labelX = x + rMax + 10;
        return (
          <g key={i}>
            {/* 第 i 级：主动轮在上轴，从动轮在下轴，竖向啮合 */}
            {gearTicks(x, yTop, r1, z1, gearColor(true))}
            <circle cx={x} cy={yTop} r={r1} className="gear driver" />
            <text x={x} y={yTop + 4} className="gear-label">{z1}</text>

            {gearTicks(x, yBot, r2, z2, gearColor(false))}
            <circle cx={x} cy={yBot} r={r2} className="gear driven" />
            <text x={x} y={yBot + 4} className="gear-label">{z2}</text>

            {/* 啮合点 + 一对反向转向弧 */}
            <text x={x - 4} y={yMid + 4} className="mesh-dot">⊙</text>
            <path
              d={`M ${x + 8} ${yMid - 13} a 11 11 0 0 1 14 0`}
              stroke="#64748b"
              strokeWidth={1.3}
              fill="none"
              markerEnd="url(#arrowhead)"
            />
            <path
              d={`M ${x - 8} ${yMid + 13} a 11 11 0 0 0 -14 0`}
              stroke="#64748b"
              strokeWidth={1.3}
              fill="none"
              markerEnd="url(#arrowhead)"
            />

            {/* 级标注 */}
            <text x={labelX} y={yTop - 2} className="stage-tag">第{i + 1}级 · 主动</text>
            <text x={labelX} y={yTop + 13} className="stage-tag-sub">{z1} 齿</text>
            <text x={labelX} y={yBot - 2} className="stage-tag">第{i + 1}级 · 从动</text>
            <text x={labelX} y={yBot + 13} className="stage-tag-sub">{z2} 齿</text>
            <text x={labelX} y={yMid + 4} className="ratio-tag">
              级比 {stageRatioText(z1, z2)}
            </text>
          </g>
        );
      })}

      {/* 同轴联动标记（各中间轴的两齿轮之间） */}
      {stages.slice(0, -1).map((_, i) => {
        const s = i + 1; // 中间轴编号
        const y = cy(s);
        const x = (cx(s - 1) + cx(s)) / 2;
        return (
          <g key={`couple-${s}`}>
            <rect x={x - 28} y={y - 9} width={56} height={18} rx={9} className="couple-badge" />
            <text x={x} y={y + 4} className="couple-text">同轴联动</text>
          </g>
        );
      })}

      {/* 输入 / 输出标注 */}
      <text x={cx(0) - rMax - shaftOverhang} y={cy(0) - 10} className="io-tag" textAnchor="end">
        输入
      </text>
      <text x={cx(n - 1) + rMax + shaftOverhang + 2} y={cy(n) - 10} className="io-tag">
        输出
      </text>
    </svg>
  );
}
