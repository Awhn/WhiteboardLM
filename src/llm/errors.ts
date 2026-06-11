/** AI가 스스로 판단할 수 없는 상황 — 러너가 [blocking] 예외 항목을 자동 생성한다 (M13) */
export class BlockedError extends Error {
  readonly reason: string

  constructor(reason: string) {
    super(reason)
    this.name = 'BlockedError'
    this.reason = reason
  }
}
