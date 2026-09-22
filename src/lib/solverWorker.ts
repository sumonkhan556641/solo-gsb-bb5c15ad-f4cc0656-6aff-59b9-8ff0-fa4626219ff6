/// <reference lib="webworker" />
import { solve } from './solver';
import type { StageSpec } from './solver';
import type { Fraction } from './fraction';

export interface SolveRequest {
  token: number;
  specs: StageSpec[];
  minTeethDiff: number;
  target: Fraction;
  topK: number;
}

export interface SolveResponse {
  token: number;
  result: import('./solver').SolveResult;
}

/**
 * 求解运行在 Web Worker 中，避免枚举阻塞主线程。
 * “代际令牌”机制：每次新请求替换当前令牌；被让步点检测到后旧任务直接作废，
 * 因此约束连续变化时只有最后一次请求的结果会回传。
 */
let currentToken = -1;

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async (ev: MessageEvent<SolveRequest>) => {
  const msg = ev.data;
  const myToken = msg.token;
  currentToken = myToken;

  const result = await solve(
    msg.specs,
    msg.minTeethDiff,
    msg.target,
    msg.topK,
    () => currentToken !== myToken,
  );
  if (currentToken !== myToken) return; // 已被更新的约束取代
  const response: SolveResponse = { token: myToken, result };
  scope.postMessage(response);
};
