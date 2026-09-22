/**
 * 齿轮配组核心求解器
 * ------------------
 * 枚举每一级 (主动齿数 z1, 从动齿数 z2) 的可行组合，深度优先累计总传动比，
 * 全程以精确分数（bigint 分子/分母）计算，并利用剩余各级传动比的可达区间
 * 做分数级剪枝；最终按 (相对误差, 总齿数, 逐级齿数字典序) 稳定排名取前 K。
 */

import {
  Fraction,
  ONE,
  cmp,
  mul,
  reduce,
  relError,
} from './fraction';

/** 一级传动的齿数以开/闭区间描述；锁定时 min === max */
export interface StageSpec {
  /** 主动轮（输入侧）齿数范围 */
  driverMin: number;
  driverMax: number;
  /** 从动轮（输出侧）齿数范围 */
  drivenMin: number;
  drivenMax: number;
  /** 锁定主动轮齿数；null 表示在范围内自由枚举 */
  lockDriver: number | null;
  /** 锁定从动轮齿数；null 表示在范围内自由枚举 */
  lockDriven: number | null;
}

/** 单枚可行齿对（未约分的级比值 z2/z1） */
export interface GearPair {
  z1: number;
  z2: number;
  teeth: number;
  r: Fraction;
}

export interface Solution {
  /** 逐级 [主动齿数, 从动齿数] */
  path: Array<[number, number]>;
  /** 约分后的总传动比 */
  total: Fraction;
  /** 相对误差（未约分分数，展示时再处理） */
  error: Fraction;
  /** 全台总齿数 */
  totalTeeth: number;
}

export interface SolveResult {
  solutions: Solution[];
  /** 访问到的可行叶节点数（通过齿差筛选的完整组合） */
  leafCount: number;
  /** DFS 内部访问的节点总数（含被剪枝的中间节点） */
  nodeCount: number;
  /** 达到枚举预算上限（结果可能不是全局最优） */
  truncated: boolean;
  /** 被更新的约束取消（结果为部分枚举，调用方应丢弃） */
  cancelled: boolean;
  /** 毫秒 */
  elapsedMs: number;
  /** 笛卡尔空间大小（所有级齿对数之积） */
  searchSpace: bigint;
}

export interface Progress {
  leafCount: number;
  nodeCount: number;
}

/** 每 2^16 次内层循环向事件循环让步一次，保证可取消且不卡住 UI */
const YIELD_EVERY = 1 << 16;
/** 可行叶节点枚举预算，防止极端参数下长时间运算 */
const DEFAULT_LEAF_BUDGET = 20_000_000;

export function buildPairs(spec: StageSpec, minTeethDiff: number): GearPair[] {
  const z1Lo = spec.lockDriver ?? spec.driverMin;
  const z1Hi = spec.lockDriver ?? spec.driverMax;
  const z2Lo = spec.lockDriven ?? spec.drivenMin;
  const z2Hi = spec.lockDriven ?? spec.drivenMax;

  const pairs: GearPair[] = [];
  for (let z1 = z1Lo; z1 <= z1Hi; z1++) {
    for (let z2 = z2Lo; z2 <= z2Hi; z2++) {
      // 排除主/从动齿数差低于阈值的组合（齿数太接近无法正常啮合配组）
      if (Math.abs(z2 - z1) < minTeethDiff) continue;
      pairs.push({ z1, z2, teeth: z1 + z2, r: { n: BigInt(z2), d: BigInt(z1) } });
    }
  }
  // 稳定顺序：先主动齿数、后从动齿数升序（字典序排名的基础）
  pairs.sort((a, b) => a.z1 - b.z1 || a.z2 - b.z2);
  return pairs;
}

interface SolveContext {
  levels: GearPair[][];
  target: Fraction;
  topK: number;
  leafBudget: number;
  cancelled: () => boolean;
  onProgress?: (p: Progress) => void;
  /** 目标是否落在全局可达区间内；在区间外时放弃比值剪枝，仅枚举找最接近的方案 */
  pruneByRatio: boolean;
}

interface SolveState {
  best: Solution[];
  leafCount: number;
  nodeCount: number;
  truncated: boolean;
  tick: number;
}

/** 比较两个候选解，返回负数表示 a 应排在 b 前面 */
function compareSolutions(a: Solution, b: Solution): number {
  // 1. 相对误差升序（精确分数比较）
  const ec = cmp(a.error, b.error);
  if (ec !== 0) return ec === -1 ? -1 : 1;
  // 2. 总齿数升序
  if (a.totalTeeth !== b.totalTeeth) return a.totalTeeth - b.totalTeeth;
  // 3. 逐级齿数字典序（(z1,z2) 依次比较）
  const pa = a.path;
  const pb = b.path;
  for (let i = 0; i < pa.length; i++) {
    if (pa[i][0] !== pb[i][0]) return pa[i][0] - pb[i][0];
    if (pa[i][1] !== pb[i][1]) return pa[i][1] - pb[i][1];
  }
  return 0;
}

/** 以有序插入维护前 K 名，返回插入后的数组 */
function insertTopK(best: Solution[], cand: Solution, k: number): Solution[] {
  const worst = best.length === k ? best[k - 1] : null;
  if (worst !== null && compareSolutions(cand, worst) >= 0) return best;

  let lo = 0;
  let hi = best.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (compareSolutions(cand, best[mid]) < 0) hi = mid;
    else lo = mid + 1;
  }
  const next = best.slice();
  next.splice(lo, 0, cand);
  if (next.length > k) next.pop();
  return next;
}

/**
 * 异步求解。约束变化后由调用方以“代际令牌”保证旧任务的结果被丢弃；
 * 每个让步点检查 cancelled()，实现即时取消。
 */
export function solve(
  specs: StageSpec[],
  minTeethDiff: number,
  target: Fraction,
  topK: number,
  cancelled: () => boolean,
  onProgress?: (p: Progress) => void,
  leafBudget: number = DEFAULT_LEAF_BUDGET,
): Promise<SolveResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const levels = specs.map((s) => buildPairs(s, minTeethDiff));
    const empty: SolveResult = {
      solutions: [],
      leafCount: 0,
      nodeCount: 0,
      truncated: false,
      cancelled: false,
      elapsedMs: 0,
      searchSpace: 1n,
    };
    if (levels.some((l) => l.length === 0)) {
      resolve({ ...empty, elapsedMs: Date.now() - startedAt });
      return;
    }

    let searchSpace = 1n;
    for (const lvl of levels) searchSpace *= BigInt(lvl.length);

    // 后缀可达区间：suffixMin[i] = 第 i 级起各级最小比值之积
    const suffixMin: Fraction[] = new Array(levels.length + 1);
    const suffixMax: Fraction[] = new Array(levels.length + 1);
    suffixMin[levels.length] = ONE;
    suffixMax[levels.length] = ONE;
    for (let i = levels.length - 1; i >= 0; i--) {
      let lo = levels[i][0].r;
      let hi = levels[i][0].r;
      for (const p of levels[i]) {
        if (cmp(p.r, lo) < 0) lo = p.r;
        if (cmp(p.r, hi) > 0) hi = p.r;
      }
      suffixMin[i] = mul(suffixMin[i + 1], lo);
      suffixMax[i] = mul(suffixMax[i + 1], hi);
    }

    // 目标在全局可达区间之外时，比值剪枝会剪掉一切，退化为纯枚举找最接近解
    const pruneByRatio =
      cmp(target, suffixMin[0]) >= 0 && cmp(target, suffixMax[0]) <= 0;

    const ctx: SolveContext = {
      levels,
      target,
      topK,
      leafBudget,
      cancelled,
      onProgress,
      pruneByRatio,
    };
    const state: SolveState = {
      best: [],
      leafCount: 0,
      nodeCount: 0,
      truncated: false,
      tick: 0,
    };
    const path: Array<[number, number]> = specs.map(() => [0, 0]);

    const finish = (cancelled: boolean) => {
      resolve({
        solutions: state.best,
        leafCount: state.leafCount,
        nodeCount: state.nodeCount,
        truncated: state.truncated,
        cancelled,
        elapsedMs: Date.now() - startedAt,
        searchSpace,
      });
    };

    dfs(ctx, state, path, 0, ONE, suffixMin, suffixMax).then((done) => {
      // done=false 表示被新约束取消：仍要 resolve（Worker 侧按令牌丢弃结果）
      finish(!done);
    });
  });
}

/**
 * 深度优先枚举。
 * @returns true 表示正常完成；false 表示已被取消（结果作废）
 */
async function dfs(
  ctx: SolveContext,
  st: SolveState,
  path: Array<[number, number]>,
  depth: number,
  acc: Fraction,
  suffixMin: Fraction[],
  suffixMax: Fraction[],
): Promise<boolean> {
  // 根节点也计入节点数
  st.nodeCount++;
  // 每节点廉价检查一次取消标志（仅读布尔），保证约束变化后即时中止
  if (ctx.cancelled()) return false;

  if (depth === ctx.levels.length) {
    // —— 叶节点：完整组合，齿差阈值在 buildPairs 中已逐级过滤 ——
    st.leafCount++;
    const total = reduce(acc);
    const cand: Solution = {
      path: path.map(([a, b]) => [a, b] as [number, number]),
      total,
      error: relError(total, ctx.target),
      totalTeeth: path.reduce((s, [a, b]) => s + a + b, 0),
    };
    st.best = insertTopK(st.best, cand, ctx.topK);

    if ((st.leafCount & 0x3fff) === 0) ctx.onProgress?.({ ...st });
    st.tick++;
    if (st.tick >= YIELD_EVERY) {
      st.tick = 0;
      await new Promise((r) => setTimeout(r, 0));
      if (ctx.cancelled()) return false;
    }
    return true;
  }
  const pairs = ctx.levels[depth];
  const remainingMin = suffixMin[depth + 1];
  const remainingMax = suffixMax[depth + 1];

  for (const p of pairs) {
    const next = mul(acc, p.r);

    if (ctx.pruneByRatio) {
      // 分数级剪枝：乘上剩余各级可达区间后仍不可能覆盖目标值
      // 若 next * remainingMin > target，则本支所有叶节点都偏大
      if (cmp(mul(next, remainingMin), ctx.target) > 0) continue;
      // 若 next * remainingMax < target，则本支所有叶节点都偏小
      if (cmp(mul(next, remainingMax), ctx.target) < 0) continue;
    }

    path[depth] = [p.z1, p.z2];
    const ok = await dfs(ctx, st, path, depth + 1, next, suffixMin, suffixMax);
    if (!ok) return false;

    if (st.leafCount >= ctx.leafBudget) {
      st.truncated = true;
      return true;
    }
  }
  return true;
}
