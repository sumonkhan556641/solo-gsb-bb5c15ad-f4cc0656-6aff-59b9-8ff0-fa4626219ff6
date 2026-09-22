import { useMemo, useState } from 'react';
import type { StageSpec } from './lib/solver';
import { parseFraction, toDecimal } from './lib/fraction';
import { useGearSolver, type SolveInput } from './hooks/useGearSolver';
import {
  DEFAULT_MIN_DIFF,
  DEFAULT_TARGET,
  MAX_SPAN,
  MAX_TEETH,
  MIN_TEETH,
  makeDefaultStages,
  makeStage,
  type StageForm,
} from './types';
import StageCard from './components/StageCard';
import SolutionCard from './components/SolutionCard';
import {
  copyText,
  formatAllSolutionsText,
  formatBigInt,
  formatSolutionText,
} from './lib/format';

interface ParsedStage {
  spec: StageSpec;
  errors: string[];
  pairCount: number;
}

function parseInt10(s: string): number | null {
  if (!/^\d+$/.test(s.trim())) return null;
  const n = Number(s.trim());
  return Number.isSafeInteger(n) ? n : null;
}

/** 校验并解析一级配置，顺带按齿差阈值统计齿对数 */
function parseStage(form: StageForm, minDiff: number): ParsedStage {
  const errors: string[] = [];
  const nums = {
    driverMin: parseInt10(form.driverMin),
    driverMax: parseInt10(form.driverMax),
    drivenMin: parseInt10(form.drivenMin),
    drivenMax: parseInt10(form.drivenMax),
  };

  const checkRange = (lo: number | null, hi: number | null, name: string) => {
    if (lo === null || hi === null) {
      errors.push(`${name}齿数需填写整数`);
      return;
    }
    if (lo < MIN_TEETH || hi > MAX_TEETH || lo < 1 || hi < 1) {
      errors.push(`${name}齿数需在 ${MIN_TEETH}–${MAX_TEETH} 之间`);
      return;
    }
    if (lo > hi) errors.push(`${name}齿数范围的最小值不能大于最大值`);
    else if (hi - lo > MAX_SPAN)
      errors.push(`${name}齿数范围过宽（跨度最大 ${MAX_SPAN}，当前 ${hi - lo}）`);
  };
  checkRange(nums.driverMin, nums.driverMax, '主动轮');
  checkRange(nums.drivenMin, nums.drivenMax, '从动轮');

  const lockDriver = form.lockDriver ? nums.driverMin : null;
  const lockDriven = form.lockDriven ? nums.drivenMin : null;

  let pairCount = 0;
  if (errors.length === 0) {
    const z1Lo = nums.driverMin as number;
    const z1Hi = form.lockDriver ? z1Lo : (nums.driverMax as number);
    const z2Lo = nums.drivenMin as number;
    const z2Hi = form.lockDriven ? z2Lo : (nums.drivenMax as number);
    for (let z1 = z1Lo; z1 <= z1Hi; z1++) {
      for (let z2 = z2Lo; z2 <= z2Hi; z2++) {
        if (Math.abs(z2 - z1) >= minDiff) pairCount++;
      }
    }
    if (pairCount === 0) errors.push('该级在当前范围与齿差阈值下没有任何可行齿对');
  }

  return {
    spec: {
      driverMin: nums.driverMin ?? MIN_TEETH,
      driverMax: nums.driverMax ?? MIN_TEETH,
      drivenMin: nums.drivenMin ?? MIN_TEETH,
      drivenMax: nums.drivenMax ?? MIN_TEETH,
      lockDriver,
      lockDriven,
    },
    errors,
    pairCount,
  };
}

export default function App() {
  const [targetText, setTargetText] = useState(DEFAULT_TARGET);
  const [minDiffText, setMinDiffText] = useState(DEFAULT_MIN_DIFF);
  const [stages, setStages] = useState<StageForm[]>(makeDefaultStages);
  const [toast, setToast] = useState<string | null>(null);

  const target = useMemo(() => parseFraction(targetText), [targetText]);
  const minDiff = parseInt10(minDiffText);
  const minDiffValid = minDiff !== null && minDiff >= 0 && minDiff <= 100;

  const parsedStages = useMemo(
    () => stages.map((s) => parseStage(s, minDiffValid ? (minDiff as number) : 0)),
    [stages, minDiff, minDiffValid],
  );

  const formErrors: string[] = [];
  if (!target) formErrors.push('目标传动比无效：请输入正数，如 6、6.25、12/7、1+2/3');
  if (!minDiffValid) formErrors.push('最小齿差需为 0–100 的整数');
  parsedStages.forEach((p, i) => p.errors.forEach((e) => formErrors.push(`第${i + 1}级：${e}`)));

  const searchSpace = useMemo(() => {
    if (formErrors.length > 0) return 0n;
    return parsedStages.reduce((acc, p) => acc * BigInt(p.pairCount), 1n);
  }, [parsedStages, formErrors.length]);

  // 仅当全部约束合法时才发起求解 —— 约束一改即生成新输入，Hook 内防抖即时重算
  const solveInput: SolveInput | null = useMemo(() => {
    if (formErrors.length > 0 || !target) return null;
    return {
      specs: parsedStages.map((p) => p.spec),
      minTeethDiff: minDiff as number,
      target,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, minDiff, JSON.stringify(parsedStages.map((p) => p.spec))]);

  const { result, status, topK } = useGearSolver(solveInput);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  };

  const updateStage = (i: number, next: StageForm) =>
    setStages((prev) => prev.map((s, idx) => (idx === i ? next : s)));
  const addStage = (i: number) =>
    setStages((prev) => (prev.length >= 3 ? prev : [...prev.slice(0, i + 1), makeStage(), ...prev.slice(i + 1)]));
  const removeStage = (i: number) =>
    setStages((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const targetDecimal = target ? toDecimal(target, 6) : '—';

  const handleCopyOne = async (idx: number) => {
    if (!result || !target) return;
    const ok = await copyText(formatSolutionText(result.solutions[idx], targetText, targetDecimal));
    showToast(ok ? `方案 #${idx + 1} 已复制到剪贴板` : '复制失败，请检查浏览器权限');
  };
  const handleCopyAll = async () => {
    if (!result || !target || result.solutions.length === 0) return;
    const ok = await copyText(formatAllSolutionsText(result.solutions, targetText, targetDecimal));
    showToast(ok ? `已复制全部 ${result.solutions.length} 个方案` : '复制失败，请检查浏览器权限');
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="title-block">
          <h1>⚙ 齿轮传动配组台</h1>
          <p>
            设置目标传动比与各级齿数范围，枚举剪枝全部可行组合，以精确分数累计总传动比，
            按相对误差稳定排名取前 {topK} 个方案。
          </p>
        </div>
        <a
          className="header-link"
          href="https://github.com"
          onClick={(e) => e.preventDefault()}
          title="多级定轴轮系配组"
        >
          多级定轴轮系
        </a>
      </header>

      <main className="layout">
        {/* ————— 左侧：约束面板 ————— */}
        <aside className="panel controls">
          <h2 className="panel-title">配组约束</h2>

          <div className="global-row">
            <label className="text-field">
              <span>目标传动比</span>
              <input
                type="text"
                value={targetText}
                spellCheck={false}
                placeholder="如 6、6.25、12/7"
                className={target ? '' : 'invalid'}
                onChange={(e) => setTargetText(e.target.value)}
              />
            </label>
            <label className="text-field small">
              <span>最小齿差</span>
              <input
                type="number"
                min={0}
                max={100}
                value={minDiffText}
                className={minDiffValid ? '' : 'invalid'}
                onChange={(e) => setMinDiffText(e.target.value)}
              />
            </label>
          </div>
          <div className="global-hint">
            目标支持整数、小数或分数（12/7、12:7、1+2/3）；当前解析为{' '}
            {target ? (
              <>
                <b>{target.n.toString()}/{target.d.toString()}</b> ≈ {targetDecimal}
              </>
            ) : (
              <b className="danger-text">无效输入</b>
            )}
            ；最小齿差指每级 |从动齿 − 主动齿| 的下限，低于该值的齿对将被剔除。
          </div>

          <div className="stages-list">
            {stages.map((s, i) => (
              <StageCard
                key={s.id}
                index={i}
                stage={s}
                canRemove={stages.length > 1}
                canAdd={stages.length < 3}
                errors={parsedStages[i]?.errors ?? []}
                onChange={(next) => updateStage(i, next)}
                onRemove={() => removeStage(i)}
                onAdd={() => addStage(i)}
              />
            ))}
          </div>
          <div className="panel-footer">
            <button
              type="button"
              className="btn"
              disabled={stages.length >= 3}
              onClick={() => setStages((p) => [...p, makeStage()])}
            >
              + 追加一级（当前 {stages.length} 级，最多 3 级）
            </button>
          </div>
        </aside>

        {/* ————— 右侧：结果 ————— */}
        <section className="panel results">
          <div className="results-head">
            <h2 className="panel-title">配组方案（前 {topK}）</h2>
            {result && result.solutions.length > 0 && (
              <button type="button" className="btn ghost small" onClick={handleCopyAll}>
                复制全部
              </button>
            )}
          </div>

          {formErrors.length > 0 ? (
            <div className="banner error">
              <b>约束存在问题，暂不求解：</b>
              <ul>
                {formErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="status-line">
              {status === 'computing' && <span className="badge computing">计算中…</span>}
              {status === 'done' && result && (
                <>
                  <span className="badge ok">已完成</span>
                  <span>
                    可行组合（叶节点） <b>{formatBigInt(BigInt(result.leafCount))}</b>
                  </span>
                  <span className="dim">枚举空间 {formatBigInt(searchSpace)}</span>
                  <span className="dim">搜索节点 {formatBigInt(BigInt(result.nodeCount))}</span>
                  <span className="dim">耗时 {result.elapsedMs} ms</span>
                  {result.truncated && (
                    <span className="badge warn" title="达到枚举预算上限，展示的是已枚举范围内的最优方案">
                      已达枚举上限，结果可能非全局最优
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          <div className="solutions-list">
            {status === 'done' && result && result.solutions.length === 0 && (
              <div className="banner warn">
                枚举空间为 0：请放宽齿数范围或减小最小齿差后重试。
              </div>
            )}
            {result?.solutions.map((sol, i) => (
              <SolutionCard key={i} rank={i + 1} solution={sol} onCopy={() => handleCopyOne(i)} />
            ))}
            {status === 'computing' && (!result || result.solutions.length === 0) && (
              <div className="banner muted">正在枚举可行齿对组合并剪枝，请稍候…</div>
            )}
          </div>
        </section>
      </main>

      {toast && <div className="toast">{toast}</div>}

      <footer className="app-footer">
        排名规则：① 相对误差升序（精确分数比较）→ ② 总齿数升序 → ③ 逐级 (主动齿, 从动齿) 字典序
      </footer>
    </div>
  );
}
