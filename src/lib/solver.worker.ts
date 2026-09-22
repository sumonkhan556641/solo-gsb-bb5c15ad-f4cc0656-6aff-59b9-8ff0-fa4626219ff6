import { solve } from './solver'
import { SolveMessage, SolveResponse } from './workerProtocol'

self.onmessage = (ev: MessageEvent<SolveMessage>) => {
  const { nonce, request } = ev.data
  try {
    const result = solve(request)
    const response: SolveResponse = { nonce, status: 'ok', result }
    ;(self as unknown as Worker).postMessage(response)
  } catch (err) {
    const response: SolveResponse = {
      nonce,
      status: 'error',
      message: err instanceof Error ? err.message : String(err)
    }
    ;(self as unknown as Worker).postMessage(response)
  }
}
