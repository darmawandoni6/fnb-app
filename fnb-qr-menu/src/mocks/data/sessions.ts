export type MockScenario = 'open' | 'closed' | 'outOfStock'

export type MockSession = {
  sessionToken: string
  tableNumber: string
  scenario: MockScenario
}

export const MOCK_SESSION_STORE = {
  byToken: new Map<string, MockSession>(),
  tokenByQr: new Map<string, string>(),
  nextSeq: 1,
}

export function findMockSession(sessionToken: string): MockSession | undefined {
  return MOCK_SESSION_STORE.byToken.get(sessionToken)
}
