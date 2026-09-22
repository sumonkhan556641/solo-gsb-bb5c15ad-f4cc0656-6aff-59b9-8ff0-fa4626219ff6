import { useEffect, useRef, useState } from 'react';
import type { SolveResult, StageSpec } from '../lib/solver';
import type { Fraction } from '../lib/fraction';
import type { SolveRequest, SolveResponse } from '../lib/solverWorker';

export interface SolveInput {
  specs: StageSpec[];
  minTeethDiff: number;
  target: Fraction;
}

export type SolverStatus = 'idle' | 'computing' | 'done';

const TOP_K = 20;
/** 约束停止变化后多久发起重算 */
const DEBOUNCE_MS = 120;

/**
 * 将求解器封装为 React Hook：
 * - Worker 全生命周期只创建一次；
 * - 输入引用变化（约束变更）后防抖重算；
 * - 令牌机制丢弃过期结果，状态变化即时反映到 UI。
 */
export function useGearSolver(input: SolveInput | null) {
  const [result, setResult] = useState<SolveResult | null>(null);
  const [status, setStatus] = useState<SolverStatus>('idle');
  const workerRef = useRef<Worker | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    const worker = new Worker(new URL('../lib/solverWorker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
    worker.onmessage = (ev: MessageEvent<SolveResponse>) => {
      const { token, result: r } = ev.data;
      if (token !== tokenRef.current) return;
      setResult(r);
      setStatus('done');
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!input) {
      setStatus('idle');
      return;
    }
    const token = ++tokenRef.current;
    setStatus('computing');

    const handle = window.setTimeout(() => {
      const req: SolveRequest = { token, ...input, topK: TOP_K };
      workerRef.current?.postMessage(req);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [input]);

  return { result, status, topK: TOP_K };
}
