import { Frac, parseRatio } from './frac'
import { SolveRequest, StageSpec } from './solver'
import { StationState } from '../types'

export interface BuildResult {
  request?: SolveRequest
  target?: Frac
  errors: string[]
}

const parseTooth = (raw: string, label: string, errors: string[]): number | null => {
  if (!/^\d+$/.test(raw.trim())) {
    errors.push(`${label}必须是正整数`)
    return null
  }
  const v = parseInt(raw, 10)
  if (v < 8 || v > 1000) {
    errors.push(`${label}应在 8～1000 之间`)
    return null
  }
  return v
}

export function buildRequest(state: StationState): BuildResult {
  const errors: string[] = []

  const target = parseRatio(state.target)
  if (!target) {
    errors.push('目标传动比无效，可填整数、小数（如 8、3.5）或分数（如 24/17）')
  }

  let minDiff = 0
  if (!/^\d+$/.test(state.minToothDiff.trim())) {
    errors.push('最小齿差必须是非负整数')
  } else {
    minDiff = parseInt(state.minToothDiff, 10)
  }

  let maxError = Infinity
  if (state.maxErrorEnabled) {
    const v = parseFloat(state.maxError)
    if (!Number.isFinite(v) || v <= 0) {
      errors.push('误差上限必须是正数（百分比，如 1 表示 1%）')
    } else {
      maxError = v / 100
    }
  }

  const stages: StageSpec[] = []
  state.stages.slice(0, state.stageCount).forEach((s, i) => {
    const tag = `第 ${i + 1} 级`
    const dMin = parseTooth(s.driverMin, `${tag}主动齿数下限`, errors)
    const dMax = parseTooth(s.driverMax, `${tag}主动齿数上限`, errors)
    const nMin = parseTooth(s.drivenMin, `${tag}从动齿数下限`, errors)
    const nMax = parseTooth(s.drivenMax, `${tag}从动齿数上限`, errors)
    let lockD = 0
    let lockN = 0
    if (s.lockedDriver.trim()) {
      lockD = parseTooth(s.lockedDriver, `${tag}锁定主动齿`, errors) ?? 0
    }
    if (s.lockedDriven.trim()) {
      lockN = parseTooth(s.lockedDriven, `${tag}锁定从动齿`, errors) ?? 0
    }
    if (dMin !== null && dMax !== null && dMin > dMax) {
      errors.push(`${tag}主动齿数范围颠倒`)
    }
    if (nMin !== null && nMax !== null && nMin > nMax) {
      errors.push(`${tag}从动齿数范围颠倒`)
    }
    if (lockD && dMin !== null && dMax !== null && (lockD < dMin || lockD > dMax)) {
      errors.push(`${tag}锁定主动齿 ${lockD} 不在范围 [${dMin}, ${dMax}] 内`)
    }
    if (lockN && nMin !== null && nMax !== null && (lockN < nMin || lockN > nMax)) {
      errors.push(`${tag}锁定从动齿 ${lockN} 不在范围 [${nMin}, ${nMax}] 内`)
    }
    stages.push({
      driverMin: dMin ?? 0,
      driverMax: dMax ?? 0,
      drivenMin: nMin ?? 0,
      drivenMax: nMax ?? 0,
      lockedDriver: lockD,
      lockedDriven: lockN
    })
  })

  if (errors.length > 0 || !target) {
    return { errors }
  }

  return {
    errors: [],
    target,
    request: {
      target,
      stages,
      minToothDiff: minDiff,
      maxError,
      nodeBudget: 20_000_000,
      limit: 20
    }
  }
}
