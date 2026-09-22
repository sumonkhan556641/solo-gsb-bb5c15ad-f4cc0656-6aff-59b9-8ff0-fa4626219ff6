import type { StageForm } from '../types';
import { MAX_TEETH, MIN_TEETH } from '../types';
import NumberField from './NumberField';

interface StageCardProps {
  index: number;
  stage: StageForm;
  canRemove: boolean;
  canAdd: boolean;
  errors: string[];
  onChange: (next: StageForm) => void;
  onRemove: () => void;
  onAdd: () => void;
}

/**
 * 单级传动配置：
 * 勾选“锁定”后范围收敛为单个齿数（直接以最小值为准），输入框随之禁用。
 */
export default function StageCard({
  index,
  stage,
  canRemove,
  canAdd,
  errors,
  onChange,
  onRemove,
  onAdd,
}: StageCardProps) {
  const set = (patch: Partial<StageForm>) => onChange({ ...stage, ...patch });

  const lockRow = (which: 'driver' | 'driven') => {
    const locked = which === 'driver' ? stage.lockDriver : stage.lockDriven;
    const min = which === 'driver' ? stage.driverMin : stage.drivenMin;
    const max = which === 'driver' ? stage.driverMax : stage.drivenMax;
    return (
      <div className="lock-row">
        <label className="lock-check">
          <input
            type="checkbox"
            checked={locked}
            onChange={(e) =>
              set(which === 'driver' ? { lockDriver: e.target.checked } : { lockDriven: e.target.checked })
            }
          />
          锁定
        </label>
        {locked && <span className="locked-chip">固定 {min} 齿</span>}
        {!locked && min === max && <span className="range-note">范围宽度为 0</span>}
      </div>
    );
  };

  return (
    <section className="stage-card">
      <header className="stage-card-head">
        <h3>第 {index + 1} 级</h3>
        <div className="stage-actions">
          <button type="button" className="btn ghost small" onClick={onAdd} disabled={!canAdd} title="在此级之后添加一级">
            + 加一级
          </button>
          <button
            type="button"
            className="btn ghost small danger"
            onClick={onRemove}
            disabled={!canRemove}
            title="删除本级"
          >
            删除
          </button>
        </div>
      </header>

      <div className="stage-grid">
        <div className="stage-gear-group">
          <div className="stage-gear-title">主动轮（输入）</div>
          <div className="stage-fields">
            <NumberField
              label="最少齿"
              value={stage.driverMin}
              disabled={stage.lockDriver}
              onChange={(v) => set({ driverMin: v })}
            />
            <NumberField
              label="最多齿"
              value={stage.driverMax}
              disabled={stage.lockDriver}
              onChange={(v) => set({ driverMax: v })}
            />
          </div>
          {lockRow('driver')}
        </div>

        <div className="stage-arrow" aria-hidden>
          ⇢
        </div>

        <div className="stage-gear-group">
          <div className="stage-gear-title">从动轮（输出）</div>
          <div className="stage-fields">
            <NumberField
              label="最少齿"
              value={stage.drivenMin}
              disabled={stage.lockDriven}
              onChange={(v) => set({ drivenMin: v })}
            />
            <NumberField
              label="最多齿"
              value={stage.drivenMax}
              disabled={stage.lockDriven}
              onChange={(v) => set({ drivenMax: v })}
            />
          </div>
          {lockRow('driven')}
        </div>
      </div>

      <div className="stage-hint">
        齿数合法范围 {MIN_TEETH}–{MAX_TEETH}；锁定后该齿轮固定取“最少齿”的值参与配组。
      </div>

      {errors.length > 0 && (
        <ul className="error-list">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
