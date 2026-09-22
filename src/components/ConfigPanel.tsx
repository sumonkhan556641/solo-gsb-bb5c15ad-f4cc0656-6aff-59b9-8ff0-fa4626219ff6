import { StageForm, StationState } from '../types'

interface ConfigPanelProps {
  state: StationState
  onChange: (next: StationState) => void
}

const ToothInput = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
  locked
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  ariaLabel: string
  locked?: boolean
}) => (
  <input
    className={`num-input ${locked ? 'num-input-locked' : ''}`}
    type="text"
    inputMode="numeric"
    value={value}
    placeholder={placeholder}
    aria-label={ariaLabel}
    onChange={(e) => onChange(e.target.value)}
  />
)

export default function ConfigPanel({ state, onChange }: ConfigPanelProps) {
  const update = (patch: Partial<StationState>) => onChange({ ...state, ...patch })

  const updateStage = (i: number, patch: Partial<StageForm>) => {
    const stages = state.stages.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    onChange({ ...state, stages })
  }

  const setStageCount = (count: number) => {
    update({ stageCount: Math.min(3, Math.max(1, count)) })
  }

  return (
    <section className="panel config-panel">
      <h2 className="panel-title">约束设置</h2>

      <div className="form-grid">
        <label className="field field-wide">
          <span className="field-label">目标传动比</span>
          <input
            className="num-input"
            type="text"
            value={state.target}
            placeholder="如 8、3.5、24/17"
            onChange={(e) => update({ target: e.target.value })}
          />
          <span className="field-hint">支持整数 / 小数 / 分数（从动齿数 ÷ 主动齿数 的逐级乘积）</span>
        </label>

        <label className="field">
          <span className="field-label">传动级数</span>
          <div className="segmented">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                className={state.stageCount === n ? 'seg seg-active' : 'seg'}
                onClick={() => setStageCount(n)}
              >
                {n} 级
              </button>
            ))}
          </div>
        </label>

        <label className="field">
          <span className="field-label">每级最小齿差 |z从动 − z主动|</span>
          <input
            className="num-input"
            type="text"
            inputMode="numeric"
            value={state.minToothDiff}
            onChange={(e) => update({ minToothDiff: e.target.value })}
          />
          <span className="field-hint">低于该齿差的组合将被剪枝排除</span>
        </label>

        <label className="field field-wide field-check">
          <input
            type="checkbox"
            checked={state.maxErrorEnabled}
            onChange={(e) => update({ maxErrorEnabled: e.target.checked })}
          />
          <span className="field-label">硬误差上限（%）</span>
          <input
            className="num-input"
            type="text"
            inputMode="decimal"
            value={state.maxError}
            disabled={!state.maxErrorEnabled}
            onChange={(e) => update({ maxError: e.target.value })}
          />
        </label>
      </div>

      <div className="stages">
        {state.stages.slice(0, state.stageCount).map((s, i) => (
          <div className="stage-card" key={i}>
            <h3 className="stage-card-title">第 {i + 1} 级</h3>
            <div className="stage-card-body">
              <div className="tooth-group">
                <span className="tooth-group-label gear-badge gear-badge-driver">主动轮</span>
                <div className="range-inputs">
                  <ToothInput
                    ariaLabel={`第${i + 1}级主动齿数下限`}
                    value={s.driverMin}
                    onChange={(v) => updateStage(i, { driverMin: v })}
                  />
                  <span className="range-sep">～</span>
                  <ToothInput
                    ariaLabel={`第${i + 1}级主动齿数上限`}
                    value={s.driverMax}
                    onChange={(v) => updateStage(i, { driverMax: v })}
                  />
                </div>
                <div className="lock-row">
                  <span className="lock-label">锁定</span>
                  <ToothInput
                    ariaLabel={`第${i + 1}级锁定主动齿数`}
                    value={s.lockedDriver}
                    placeholder="可选"
                    locked={!!s.lockedDriver.trim()}
                    onChange={(v) => updateStage(i, { lockedDriver: v.replace(/[^\d]/g, '') })}
                  />
                </div>
              </div>

              <div className="stage-connector" aria-hidden>
                啮合
              </div>

              <div className="tooth-group">
                <span className="tooth-group-label gear-badge gear-badge-driven">从动轮</span>
                <div className="range-inputs">
                  <ToothInput
                    ariaLabel={`第${i + 1}级从动齿数下限`}
                    value={s.drivenMin}
                    onChange={(v) => updateStage(i, { drivenMin: v })}
                  />
                  <span className="range-sep">～</span>
                  <ToothInput
                    ariaLabel={`第${i + 1}级从动齿数上限`}
                    value={s.drivenMax}
                    onChange={(v) => updateStage(i, { drivenMax: v })}
                  />
                </div>
                <div className="lock-row">
                  <span className="lock-label">锁定</span>
                  <ToothInput
                    ariaLabel={`第${i + 1}级锁定从动齿数`}
                    value={s.lockedDriven}
                    placeholder="可选"
                    locked={!!s.lockedDriven.trim()}
                    onChange={(v) => updateStage(i, { lockedDriven: v.replace(/[^\d]/g, '') })}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
