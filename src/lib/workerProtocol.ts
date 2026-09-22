import { SolveRequest, SolveResult } from './solver'

export interface SolveMessage {
  nonce: number
  request: SolveRequest
}

export type SolveResponse =
  | { nonce: number; status: 'ok'; result: SolveResult }
  | { nonce: number; status: 'error'; message: string }
