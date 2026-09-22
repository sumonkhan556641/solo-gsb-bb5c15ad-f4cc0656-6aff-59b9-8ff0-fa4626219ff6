import { useEffect, useMemo, useRef, useState } from 'react'
import ConfigPanel from './components/ConfigPanel'
import SolutionCard from './components/SolutionCard'
import { DEFAULT_STATE, StationState } from './types'
import { buildRequest } from './lib/validate'
import { SolveResult } from './lib/solver'
import { SolveMessage, SolveResponse } from './lib/workerProtocol'
import { Frac, formatFrac, reduce } from './lib/frac'
import { allSolutionsToText } from './lib/format'

import SolverWorker from './lib/solver.worker?worker'

interface ComputedView {
  result: SolveResult
  target: Frac
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
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
}

export default function App() {
  const [state, setState] = useState<StationState>(DEFAULT_STATE)
  const [view, setView] = useState<ComputedView | null>(null)
  const [computing, setComputing] = useState(false)
  const [copyHint, setCopyHint] = useState<string | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const nonceRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const targetRef = useRef<Frac | null>(null)

  const built = useMemo(() => buildRequest(state), [state])
  targetRef.current = built.request?.target ?? null

  useEffect(() => {
    const worker = new SolverWorker()
    workerRef.current = worker
    worker.onmessage = (ev: MessageEvent<SolveResponse>) => {
      const msg = ev.data
      if (msg.nonce !== nonceRef.current) return
      setComputing(false)
      if (msg.status === 'ok') {
        const target = targetRef.current
        if (target) setView({ result: msg.result, target })
      }
    }
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  // 约束变化后即时重算（150ms 防抖合并连续输入）
  useEffect(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    if (built.errors.length > 0 || !built.request) {
      setComputing(false)
      setView(null)
      return
    }
    setComputing(true)
    const request = built.request
    timerRef.current = window.setTimeout(() => {
      nonceRef.current += 1
      const message: SolveMessage = { nonce: nonceRef.current, request }
      workerRef.current?.postMessage(message)
    }, 150)
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [built])

  const handleCopyAll = async () => {
    if (!view || view.result.solutions.length === 0) return
    const ok = await copyText(allSolutionsToText(view.target, view.result.solutions))
    setCopyHint(ok ? '已复制全部方案 ✓' : '复制失败，请手动选择文本')
    window.setTimeout(() => setCopyHint(null), 1800)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>齿轮传动配组台</h1>
        <p className="subtitle">
          多级定轴齿轮配组 · 精确分数枚举剪枝 · 按相对误差 / 总齿数 / 字典序稳定排名（前 20 个方案）
        </p>
      </header>

      <ConfigPanel state={state} onChange={setState} />

      {built.errors.length > 0 && (
        <section className="panel error-panel">
          <h2 className="panel-title">输入有误</h2>
          <ul className="error-list">
            {built.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </section>
      )}

      {built.errors.length === 0 && built.target && (
        <section className="panel results-panel">
          <div className="results-head">
            <h2 className="panel-title">
              配组方案
              <span className="target-chip">
                目标 i = {formatFrac(reduce(built.target))}
              </span>
              {computing && <span className="status-pill">计算中…</span>}
            </h2>
            <div className="results-actions">
              {copyHint && <span className="copy-hint">{copyHint}</span>}
              <button
                type="button"
                className="copy-btn"
                disabled={!view || view.result.solutions.length === 0}
                onClick={handleCopyAll}
              >
                复制全部方案
              </button>
            </div>
          </div>

          {view && <ResultStats result={view.result} />}

          {view && view.result.emptyStages.length > 0 && (
            <p className="empty-warn">
              第 {view.result.emptyStages.map((i) => i + 1).join('、')} 级在给定范围与齿差阈值下没有可行齿对，请放宽约束。
            </p>
          )}

          {view && view.result.emptyStages.length === 0 && view.result.solutions.length === 0 && (
            <p className="empty-warn">
              没有满足硬误差上限的方案，请放宽误差限制或齿数范围。
            </p>
          )}

          <div className="solution-list">
            {view?.result.solutions.map((s, i) => (
              <SolutionCard key={i} index={i} target={view.target} solution={s} />
            ))}
          </div>
        </section>
      )}

      <footer className="app-footer">
        传动比约定：级比 = 从动齿数 ÷ 主动齿数；总传动比 = 各级级比之乘积（精确分数累计，排名无浮点抖动）。
      </footer>
    </div>
  )
}

function ResultStats({ result }: { result: SolveResult }) {
  if (result.emptyStages.length > 0) return null
  return (
    <p className="stats-line">
      共展示 {result.solutions.length} 个方案 · 枚举内部节点 {result.nodesVisited.toLocaleString()} ·
      末级候选 {result.leavesVisited.toLocaleString()} · 耗时 {result.elapsedMs} ms
      {result.truncated && <span className="truncated-warn">（已达节点预算，结果可能被截断）</span>}
    </p>
  )
}
