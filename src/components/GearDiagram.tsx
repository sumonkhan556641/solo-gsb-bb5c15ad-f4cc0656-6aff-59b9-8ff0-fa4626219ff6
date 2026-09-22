import { StagePair } from '../lib/solver'
import { formatFrac, reduce } from '../lib/frac'

interface GearDiagramProps {
  pairs: StagePair[]
}

const radiusOf = (z: number) => 10 + z * 0.55
const COMPOUND_GAP = 40
const PAD_X = 30
const TOP = 34
const BOTTOM = 40

interface GearNode {
  x: number
  r: number
  z: number
  kind: 'driver' | 'driven'
  stageIndex: number
}

function layout(pairs: StagePair[]): { nodes: GearNode[]; width: number } {
  const nodes: GearNode[] = []
  let lastEnd = 0
  pairs.forEach((p, si) => {
    const r1 = radiusOf(p.driver)
    const r2 = radiusOf(p.driven)
    const c1x = lastEnd === 0 ? r1 : lastEnd + COMPOUND_GAP / 2 + r1
    nodes.push({ x: c1x, r: r1, z: p.driver, kind: 'driver', stageIndex: si })
    nodes.push({ x: c1x + r1 + r2, r: r2, z: p.driven, kind: 'driven', stageIndex: si })
    lastEnd = c1x + r1 + r2
  })
  return { nodes, width: lastEnd }
}

function Teeth({ r, z, kind }: { r: number; z: number; kind: 'driver' | 'driven' }) {
  const step = Math.max(1, Math.round(z / 16))
  const ticks: { x1: number; y1: number; x2: number; y2: number }[] = []
  const flip = kind === 'driven' ? Math.PI / z : 0
  for (let i = 0; i < z; i += step) {
    const a = flip + (i / z) * Math.PI * 2
    ticks.push({
      x1: Math.cos(a) * (r - 3.2),
      y1: Math.sin(a) * (r - 3.2),
      x2: Math.cos(a) * (r + 1.4),
      y2: Math.sin(a) * (r + 1.4)
    })
  }
  return (
    <g stroke="rgba(15, 23, 42, 0.4)" strokeWidth={1}>
      {ticks.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
      ))}
    </g>
  )
}

/** 简化的定轴齿轮啮合示意：啮合对节圆相切，级间以“同轴联动”连接。 */
export default function GearDiagram({ pairs }: GearDiagramProps) {
  const { nodes, width: contentWidth } = layout(pairs)
  const maxR = Math.max(...nodes.map((n) => n.r))
  const cy = maxR + 14
  const width = contentWidth + PAD_X * 2
  const height = cy * 2 + TOP + BOTTOM

  return (
    <svg
      className="gear-diagram"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="齿轮啮合示意图"
    >
      <g transform={`translate(${PAD_X}, ${TOP})`}>
        {/* 贯穿轴线 */}
        <line
          x1={-6}
          y1={cy}
          x2={contentWidth + 6}
          y2={cy}
          stroke="#cbd5e1"
          strokeWidth={1.5}
          strokeDasharray="2 6"
        />

        {/* 啮合点、级比与级标签 */}
        {pairs.map((p, si) => {
          const a = nodes[si * 2]
          const b = nodes[si * 2 + 1]
          const tangentX = a.x + a.r
          return (
            <g key={si}>
              <circle cx={tangentX} cy={cy} r={2.4} fill="#0f172a" />
              <text x={tangentX} y={cy - a.r - 6} textAnchor="middle" className="diagram-ratio">
                i{si + 1} = {formatFrac(reduce(p.ratio))}
              </text>
              <text
                x={(a.x + b.x) / 2}
                y={cy + maxR + 24}
                textAnchor="middle"
                className="diagram-stage"
              >
                第{si + 1}级
              </text>
            </g>
          )
        })}

        {/* 级间同轴联动连接 */}
        {pairs.slice(0, -1).map((_, si) => {
          const driven = nodes[si * 2 + 1]
          const nextDriver = nodes[si * 2 + 2]
          const x1 = driven.x + driven.r
          const x2 = nextDriver.x - nextDriver.r
          return (
            <g key={`link-${si}`}>
              <line x1={x1} y1={cy} x2={x2} y2={cy} stroke="#64748b" strokeWidth={2.5} />
              <line x1={x1} y1={cy - 6} x2={x1} y2={cy + 6} stroke="#64748b" strokeWidth={2.5} />
              <line x1={x2} y1={cy - 6} x2={x2} y2={cy + 6} stroke="#64748b" strokeWidth={2.5} />
              <text x={(x1 + x2) / 2} y={cy - 9} textAnchor="middle" className="diagram-shaft">
                同轴联动
              </text>
            </g>
          )
        })}

        {/* 齿轮 */}
        {nodes.map((n, i) => (
          <g key={i} transform={`translate(${n.x}, ${cy})`}>
            <circle r={n.r} className={n.kind === 'driver' ? 'gear gear-driver' : 'gear gear-driven'} />
            <Teeth r={n.r} z={n.z} kind={n.kind} />
            <circle r={2.6} fill="#0f172a" />
            <text textAnchor="middle" dy="0.35em" className="diagram-teeth">
              {n.z}
            </text>
          </g>
        ))}

        {/* 输入 / 输出标注 */}
        <text x={0} y={-TOP + 18} className="diagram-io">
          ↻ 输入
        </text>
        <text x={contentWidth} y={-TOP + 18} textAnchor="end" className="diagram-io">
          输出 ↺
        </text>
      </g>
    </svg>
  )
}
