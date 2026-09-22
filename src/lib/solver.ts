import {
  Frac,
  frac,
  mul,
  div,
  lt,
  le,
  eq,
  relError,
  toNumber,
  reduce
} from './frac'

/** 单级约束：主动轮齿数范围、从动轮齿数范围、可选的锁定齿数。 */
export interface StageSpec {
  driverMin: number
  driverMax: number
  drivenMin: number
  drivenMax: number
  /** 锁定的主动轮齿数（含），0 表示不锁定。 */
  lockedDriver: number
  /** 锁定的从动轮齿数（含），0 表示不锁定。 */
  lockedDriven: number
}

export interface SolveRequest {
  target: Frac
  stages: StageSpec[]
  /** 该级主动/从动最小允许齿数差（|z2 - z1|），低于此值的组合直接排除。 */
  minToothDiff: number
  /** 硬误差上限（相对误差），如 0.01 表示 1%；Infinity 表示不限。 */
  maxError: number
  /** 求解节点预算，防止极端参数下长时间占用。 */
  nodeBudget: number
  /** 返回方案数上限。 */
  limit: number
}

export interface StagePair {
  driver: number
  driven: number
  ratio: Frac
}

export interface Solution {
  pairs: StagePair[]
  total: Frac
  /** 相对误差（精确分数）。 */
  error: Frac
  totalTeeth: number
}

export interface SolveResult {
  solutions: Solution[]
  truncated: boolean
  nodesVisited: number
  leavesVisited: number
  elapsedMs: number
  /** 为空的级（无可行齿对）索引，用于界面提示。 */
  emptyStages: number[]
}

interface RatioGroup {
  ratio: Frac
  /** 同一比值下按（齿数和、主动齿、从动齿）字典序最优的齿对。 */
  best: StagePair
}

const comparePair = (a: StagePair, b: StagePair): number => {
  const sum = a.driver + a.driven - (b.driver + b.driven)
  if (sum !== 0) return sum
  if (a.driver !== b.driver) return a.driver - b.driver
  return a.driven - b.driven
}

/**
 * 生成某一级的可行比值分组：
 * 枚举所有 (z1, z2)，应用齿数范围、锁定与齿差阈值；
 * 同一约分比值只保留 (齿数和, z1, z2) 字典序最小的齿对。
 */
function buildGroups(spec: StageSpec, minDiff: number): { groups: RatioGroup[]; empty: boolean } {
  const byRatio = new Map<string, RatioGroup>()
  const z1Start = spec.lockedDriver || spec.driverMin
  const z1End = spec.lockedDriver || spec.driverMax
  const z2Start = spec.lockedDriven || spec.drivenMin
  const z2End = spec.lockedDriven || spec.drivenMax
  if (z1Start > z1End || z2Start > z2End) return { groups: [], empty: true }

  for (let z1 = z1Start; z1 <= z1End; z1++) {
    for (let z2 = z2Start; z2 <= z2End; z2++) {
      if (Math.abs(z2 - z1) < minDiff) continue
      const r = reduce(frac(z2, z1))
      const pair: StagePair = { driver: z1, driven: z2, ratio: r }
      const key = `${r.n}/${r.d}`
      const existing = byRatio.get(key)
      if (!existing || comparePair(pair, existing.best) < 0) {
        byRatio.set(key, { ratio: r, best: pair })
      }
    }
  }
  const groups = [...byRatio.values()].sort((a, b) =>
    a.ratio.n * b.ratio.d < b.ratio.n * a.ratio.d ? -1 : 1
  )
  return { groups, empty: groups.length === 0 }
}

/** 在升序分组中二分查找首个 ratio >= x 的下标。 */
function lowerBound(groups: RatioGroup[], x: Frac): number {
  let lo = 0
  let hi = groups.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (lt(groups[mid].ratio, x)) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * 单级内可取到的离 x 最近的相对误差下界（精确比较）。
 * 用相邻比值取最近者，不存在满足硬上限的候选时返回 Infinity（以 1n/0n 哨兵表达）。
 */
function nearestError(groups: RatioGroup[], x: Frac): Frac {
  const idx = lowerBound(groups, x)
  const INF: Frac = { n: 1n, d: 0n }
  let best: Frac = INF
  const consider = (i: number) => {
    if (i < 0 || i >= groups.length) return
    const e = relError(groups[i].ratio, x)
    if (best.d === 0n || lt(e, best)) best = e
  }
  consider(idx)
  consider(idx - 1)
  return best
}

function errorLess(a: Frac, b: Frac): boolean {
  return a.n * b.d < b.n * a.d
}

function compareSolutions(a: Solution, b: Solution): number {
  // 1) 相对误差升序
  const ec = a.error.n * b.error.d - b.error.n * a.error.d
  if (ec !== 0n) return ec < 0n ? -1 : 1
  // 2) 总齿数升序
  if (a.totalTeeth !== b.totalTeeth) return a.totalTeeth - b.totalTeeth
  // 3) 齿数组合字典序：逐级 (z1, z2)
  for (let i = 0; i < a.pairs.length; i++) {
    const pa = a.pairs[i]
    const pb = b.pairs[i]
    if (pa.driver !== pb.driver) return pa.driver - pb.driver
    if (pa.driven !== pb.driven) return pa.driven - pb.driven
  }
  return 0
}

/** 固定容量的有序 Top-K（按 compareSolutions 升序）。 */
class TopK {
  items: Solution[] = []
  constructor(private readonly cap: number) {}

  get worst(): Solution | undefined {
    return this.items[this.items.length - 1]
  }

  /** 当前截断相对误差；未满员或为空时返回 null。 */
  cutoff(): Frac | null {
    return this.items.length === this.cap ? this.items[this.cap - 1].error : null
  }

  add(s: Solution): boolean {
    const worst = this.worst
    if (worst && compareSolutions(s, worst) >= 0 && this.items.length >= this.cap) return false
    let pos = this.items.length
    for (let i = 0; i < this.items.length; i++) {
      if (compareSolutions(s, this.items[i]) < 0) {
        pos = i
        break
      }
    }
    this.items.splice(pos, 0, s)
    if (this.items.length > this.cap) this.items.pop()
    return true
  }
}

/** 主求解入口：枚举 + 剪枝，返回稳定排名的前 limit 个方案。 */
export function solve(req: SolveRequest): SolveResult {
  const started =
    typeof performance !== 'undefined' ? performance.now() : Date.now()

  const emptyStages: number[] = []
  const stageGroups: RatioGroup[][] = req.stages.map((spec, i) => {
    const { groups, empty } = buildGroups(spec, req.minToothDiff)
    if (empty) emptyStages.push(i)
    return groups
  })
  if (emptyStages.length > 0) {
    return {
      solutions: [],
      truncated: false,
      nodesVisited: 0,
      leavesVisited: 0,
      elapsedMs: elapsed(started),
      emptyStages
    }
  }

  const k = req.stages.length
  const target = req.target
  const hardLimit: Frac | null = Number.isFinite(req.maxError)
    ? { n: BigInt(Math.round(req.maxError * 1e9)), d: 1000000000n }
    : null

  // 每级按“理想级比值的对数距离”启发式排序，尽早命中优质方案以收紧截断。
  const logTarget = Math.log(toNumber(target)) / k
  const ordered: RatioGroup[][] = stageGroups.map((groups) =>
    [...groups].sort(
      (a, b) =>
        Math.abs(Math.log(toNumber(a.ratio)) - logTarget) -
        Math.abs(Math.log(toNumber(b.ratio)) - logTarget)
    )
  )

  // 后缀乘积区间（基于按比值升序的原始分组），供内部级区间剪枝。
  const sufLo: Frac[] = new Array(k + 1)
  const sufHi: Frac[] = new Array(k + 1)
  sufLo[k] = frac(1)
  sufHi[k] = frac(1)
  for (let i = k - 1; i >= 0; i--) {
    sufLo[i] = mul(stageGroups[i][0].ratio, sufLo[i + 1])
    sufHi[i] = mul(stageGroups[i][stageGroups[i].length - 1].ratio, sufHi[i + 1])
  }

  // 截断误差为 0 时的精确可达集合（以约分分数字符串为键）。
  // 末级：可达比值集合；倒数第二级：两级乘积集合（数量受预算保护）。
  const lastRatios: Set<string> | null =
    k >= 1 ? new Set(stageGroups[k - 1].map((g) => `${g.ratio.n}/${g.ratio.d}`)) : null
  let pairProducts: Set<string> | null = null
  if (k >= 2) {
    const aGroups = stageGroups[k - 2]
    const bGroups = stageGroups[k - 1]
    if (aGroups.length * bGroups.length <= 1_000_000) {
      pairProducts = new Set<string>()
      for (const a of aGroups) {
        for (const b of bGroups) {
          const p = reduce(mul(a.ratio, b.ratio))
          pairProducts.add(`${p.n}/${p.d}`)
        }
      }
    }
  }

  const top = new TopK(req.limit)
  let nodesVisited = 0
  let leavesVisited = 0
  let truncated = false
  let budget = req.nodeBudget

  /** 当前解前缀下，截断误差是否已经严格劣于 e（相等时保留，交由次级排名键裁决）。 */
  const dominated = (e: Frac): boolean => {
    const c = top.cutoff()
    if (c === null) return false
    return errorLess(c, e)
  }

  const acceptPair = (path: StagePair[], prod: Frac, pair: StagePair) => {
    const total = mul(prod, pair.ratio)
    const err = reduce(relError(total, target))
    if (hardLimit !== null && !le(err, hardLimit)) return
    if (dominated(err)) return
    const pairs = [...path, pair]
    top.add({
      pairs,
      total: reduce(total),
      error: err,
      totalTeeth: pairs.reduce((s, p) => s + p.driver + p.driven, 0)
    })
  }

  const dfs = (depth: number, path: StagePair[], prod: Frac) => {
    if (truncated) return
    if (depth === k) {
      // 理论上叶子在 depth === k - 1 处理，这里兜底。
      return
    }

    const isLast = depth === k - 1
    const remainingTarget = div(target, prod)

    if (isLast) {
      // —— 末级：只枚举可能进入 Top-K 的比值窗口 ——
      // 窗口在按比值升序的分组上关于目标点连续。
      const groups = stageGroups[depth]
      const c = top.cutoff()
      if (c === null) {
        // 冷启动：仅用硬上限确定窗口；没有硬上限则按最近的前 cap 个候选启动。
        if (hardLimit !== null) {
          const loT = div(target, mul(prod, addOne(hardLimit)))
          const hiT = div(mul(target, addOne(hardLimit)), prod)
          const l = lowerBound(groups, loT)
          const r = lowerBound(groups, hiT)
          for (let i = l; i <= r && i < groups.length; i++) {
            leavesVisited++
            acceptPair(path, prod, groups[i].best)
          }
        } else {
          const start = lowerBound(groups, remainingTarget)
          const cap = topCap(req.limit)
          let taken = 0
          for (let i = 0; taken < cap && i < groups.length; i++) {
            const a = start - 1 - i
            const b = start + i
            if (a >= 0) {
              leavesVisited++
              acceptPair(path, prod, groups[a].best)
              taken++
            }
            if (taken < cap && b < groups.length) {
              leavesVisited++
              acceptPair(path, prod, groups[b].best)
              taken++
            }
          }
        }
      } else {
        // (1 - c) * T/prod <= r <= (1 + c) * T/prod
        const oneMinusC = subOne(c)
        const loT = oneMinusC.n <= 0n ? groups[0].ratio : div(target, mul(prod, addOne(c)))
        const hiT = div(mul(target, addOne(c)), prod)
        const l = lowerBound(groups, loT)
        const r = lowerBound(groups, hiT)
        for (let i = l; i <= r && i < groups.length; i++) {
          leavesVisited++
          acceptPair(path, prod, groups[i].best)
        }
      }
      return
    }

    // —— 内部级：区间下界剪枝 ——
    // 完成本级后，整体可达区间为 prod*r*sufLo[depth+1] ... prod*r*sufHi[depth+1]。
    // 离散级（倒数第二级）额外用“最近邻比值”得到更强的精确下界。
    const discrete = depth === k - 2
    for (const g of ordered[depth]) {
      if (truncated) return
      nodesVisited++
      if (--budget <= 0) {
        truncated = true
        return
      }
      const nextProd = mul(prod, g.ratio)
      let bound: Frac
      if (discrete) {
        const need = div(target, nextProd)
        const e = nearestError(stageGroups[depth + 1], need)
        if (e.d === 0n) continue
        bound = e
      } else {
        const lo = mul(nextProd, sufLo[depth + 1])
        const hi = mul(nextProd, sufHi[depth + 1])
        bound = intervalRelError(lo, hi, target)
      }
      if (hardLimit !== null) {
        if (errorLess(hardLimit, bound)) continue
      }
      const c = top.cutoff()
      if (c !== null && errorLess(c, bound)) continue
      path.push(g.best)
      dfs(depth + 1, path, nextProd)
      path.pop()
    }
  }

  dfs(0, [], frac(1))

  return {
    solutions: top.items.sort(compareSolutions),
    truncated,
    nodesVisited,
    leavesVisited,
    elapsedMs: elapsed(started),
    emptyStages
  }
}

function topCap(limit: number): number {
  return Math.max(limit, 20)
}

function elapsed(started: number): number {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  return Math.round(now - started)
}

/** 区间 [lo, hi] 与目标 t 之间的最小相对误差。 */
function intervalRelError(lo: Frac, hi: Frac, t: Frac): Frac {
  if (le(lo, t) && le(t, hi)) return { n: 0n, d: 1n }
  if (lt(hi, t)) return relError(hi, t)
  return relError(lo, t)
}

function addOne(e: Frac): Frac {
  return reduce({ n: e.n + e.d, d: e.d })
}

function subOne(e: Frac): Frac {
  return reduce({ n: e.d - e.n, d: e.d })
}

/** 供界面/测试使用：判断误差是否满足硬上限（浮点）。 */
export function errorWithin(error: Frac, maxError: number): boolean {
  return toNumber(error) <= maxError
}

export { eq as fracEq }
