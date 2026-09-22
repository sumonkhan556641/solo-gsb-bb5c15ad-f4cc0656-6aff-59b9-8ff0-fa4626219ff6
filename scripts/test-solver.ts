import { solve, StageSpec } from '../src/lib/solver'
import { frac, parseRatio, toNumber, reduce } from '../src/lib/frac'

let failures = 0
const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    failures++
    console.error('  FAIL:', msg)
  } else {
    console.log('  ok:', msg)
  }
}

const baseStage = (): StageSpec => ({
  driverMin: 17, driverMax: 60, drivenMin: 17, drivenMax: 120, lockedDriver: 0, lockedDriven: 0
})

console.log('Case 1: 单级目标 60/17 应精确命中')
{
  const r = solve({ target: frac(60, 17), stages: [baseStage()], minToothDiff: 3, maxError: Infinity, nodeBudget: 1e8, limit: 20 })
  assert(r.emptyStages.length === 0, '无空级')
  assert(r.solutions.length === 20, `返回20个（实际 ${r.solutions.length}）`)
  assert(toNumber(r.solutions[0].error) === 0, '第一名误差为0')
  assert(r.solutions[0].pairs[0].driver === 17 && r.solutions[0].pairs[0].driven === 60, '第一名为 17→60')
}

console.log('Case 2: 排名单调性（误差升序，误差相同总齿数升序）')
{
  const r = solve({ target: frac(8), stages: [baseStage()], minToothDiff: 3, maxError: Infinity, nodeBudget: 1e8, limit: 20 })
  let ok = true
  for (let i = 1; i < r.solutions.length; i++) {
    const a = r.solutions[i - 1]
    const b = r.solutions[i]
    const ea = toNumber(a.error), eb = toNumber(b.error)
    if (ea > eb + 1e-12) { ok = false; break }
    if (Math.abs(ea - eb) < 1e-12 && a.totalTeeth > b.totalTeeth) { ok = false; break }
  }
  assert(ok, '误差/总齿数排序单调')
  console.log('  top3:', r.solutions.slice(0, 3).map(s => `${s.pairs[0].driver}→${s.pairs[0].driven} err=${(toNumber(s.error) * 100).toFixed(4)}% teeth=${s.totalTeeth}`).join(' | '))
}

console.log('Case 3: 两级传动目标 8')
{
  const r = solve({ target: frac(8), stages: [baseStage(), baseStage()], minToothDiff: 3, maxError: Infinity, nodeBudget: 1e8, limit: 20 })
  assert(r.solutions.length === 20, '返回20个方案')
  let ok = true
  for (let i = 1; i < r.solutions.length; i++) {
    if (toNumber(r.solutions[i - 1].error) > toNumber(r.solutions[i].error) + 1e-12) { ok = false; break }
  }
  assert(ok, '误差排序单调')
  const top = r.solutions[0]
  const total = top.pairs.reduce((acc, p) => acc * p.driven / p.driver, 1)
  assert(Math.abs(total - 8) / 8 === toNumber(top.error), '浮点总比与精确误差一致')
  console.log(`  最佳: ${top.pairs.map(p => `${p.driver}→${p.driven}`).join(', ')} i=${reduce(top.total).n}/${reduce(top.total).d} err=${(toNumber(top.error) * 100).toFixed(5)}%`)
  console.log(`  性能: nodes=${r.nodesVisited} leaves=${r.leavesVisited} ms=${r.elapsedMs}`)
}

console.log('Case 4: 三级传动目标 64，含硬误差上限 0.5%')
{
  const r = solve({ target: frac(64), stages: [baseStage(), baseStage(), baseStage()], minToothDiff: 3, maxError: 0.005, nodeBudget: 1e8, limit: 20 })
  assert(r.solutions.every(s => toNumber(s.error) <= 0.005 + 1e-12), '全部满足硬误差上限')
  assert(r.solutions.length > 0, '至少有一个方案')
  console.log(`  方案数=${r.solutions.length} nodes=${r.nodesVisited} leaves=${r.leavesVisited} ms=${r.elapsedMs}`)
  const top = r.solutions[0]
  console.log(`  最佳 err=${(toNumber(top.error) * 100).toFixed(5)}% teeth=${top.totalTeeth} ${top.pairs.map(p => `${p.driver}→${p.driven}`).join(', ')}`)
}

console.log('Case 5: 锁定齿轮')
{
  const locked: StageSpec = { ...baseStage(), lockedDriver: 20, lockedDriven: 40 }
  const r = solve({ target: frac(2), stages: [locked], minToothDiff: 3, maxError: Infinity, nodeBudget: 1e8, limit: 20 })
  assert(r.solutions.length === 1, '锁定后只有一个候选')
  assert(r.solutions[0].pairs[0].driver === 20 && r.solutions[0].pairs[0].driven === 40, '齿对为20→40')
  assert(toNumber(r.solutions[0].error) === 0, '误差为0')
}

console.log('Case 6: 齿差阈值剪枝')
{
  const r = solve({ target: frac(60, 17), stages: [baseStage()], minToothDiff: 50, maxError: Infinity, nodeBudget: 1e8, limit: 20 })
  assert(r.solutions.every(s => Math.abs(s.pairs[0].driven - s.pairs[0].driver) >= 50), '所有方案齿差≥50')
}

console.log('Case 7: 空级检测')
{
  const bad: StageSpec = { ...baseStage(), driverMin: 17, driverMax: 17, drivenMin: 17, drivenMax: 17 }
  const r = solve({ target: frac(1), stages: [bad], minToothDiff: 3, maxError: Infinity, nodeBudget: 1e8, limit: 20 })
  assert(r.emptyStages.length === 1 && r.emptyStages[0] === 0, '齿差约束下17/17为空级')
  const r2 = solve({ target: frac(1), stages: [bad], minToothDiff: 0, maxError: Infinity, nodeBudget: 1e8, limit: 20 })
  assert(r2.solutions.length === 1 && toNumber(r2.solutions[0].error) === 0, '齿差0时17→17命中')
}

console.log('Case 8: 字典序稳定性（同误差同总齿数时）')
{
  // 目标 1：只有比值 1 的方案误差为0；同比值下 (齿数和, z1, z2) 字典序最小者应排第一
  const r = solve({ target: frac(1), stages: [baseStage()], minToothDiff: 0, maxError: Infinity, nodeBudget: 1e8, limit: 20 })
  const p0 = r.solutions[0].pairs[0]
  assert(p0.driver === 17 && p0.driven === 17, `误差0组字典序最小齿对为17→17（实际 ${p0.driver}→${p0.driven}）`)
}

console.log('Case 9: parseRatio')
{
  assert(reduce(parseRatio('8')!) .n === 8n && reduce(parseRatio('8')!).d === 1n, '8')
  const p = reduce(parseRatio('24/17')!)
  assert(p.n === 24n && p.d === 17n, '24/17')
  const q = reduce(parseRatio('2.5')!)
  assert(q.n === 5n && q.d === 2n, '2.5')
  const u = reduce(parseRatio('0.25%')!)
  assert(u.n === 1n && u.d === 400n, '0.25%')
  assert(parseRatio('abc') === null, '非法输入为null')
}

console.log('Case 10: 结果与暴力枚举一致（两级小范围）')
{
  const small: StageSpec = { driverMin: 17, driverMax: 25, drivenMin: 30, drivenMax: 45, lockedDriver: 0, lockedDriven: 0 }
  const r = solve({ target: frac(4), stages: [small, small], minToothDiff: 3, maxError: Infinity, nodeBudget: 1e8, limit: 20 })
  // 暴力
  const brute: { pairs: [number, number, number, number]; err: number; teeth: number }[] = []
  for (let a = 17; a <= 25; a++) for (let b = 30; b <= 45; b++) {
    if (Math.abs(b - a) < 3) continue
    for (let c = 17; c <= 25; c++) for (let d = 30; d <= 45; d++) {
      if (Math.abs(d - c) < 3) continue
      const ratio = (b * d) / (a * c)
      brute.push({ pairs: [a, b, c, d], err: Math.abs(ratio - 4) / 4, teeth: a + b + c + d })
    }
  }
  brute.sort((x, y) => x.err - y.err || x.teeth - y.teeth || cmpTuple(x.pairs, y.pairs))
  function cmpTuple(a: number[], b: number[]) {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
    return 0
  }
  assert(r.solutions.length === 20, `剪枝求解给出20个（暴力共${brute.length}个候选）`)
  let match = true
  for (let i = 0; i < 20; i++) {
    const got = r.solutions[i].pairs.flatMap(p => [p.driver, p.driven])
    if (cmpTuple(got, brute[i].pairs) !== 0) { match = false; console.log('  mismatch at', i, got, brute[i].pairs); break }
  }
  assert(match, '前20与暴力枚举排名完全一致')
}

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILURES`)
if (failures > 0) process.exit(1)
