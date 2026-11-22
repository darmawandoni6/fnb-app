/** Access token lives in memory only; the refresh token stays in the httpOnly cookie. */
let accessToken: string | null = null

const listeners: (() => void)[] = []

export const getAccessToken = () => accessToken

export const setAccessToken = (token: string | null) => {
  accessToken = token
}

export const onUnauthorized = (listener: () => void) => {
  listeners.push(listener)
  return () => {
    const idx = listeners.indexOf(listener)
    if (idx >= 0) listeners.splice(idx, 1)
  }
}

export const emitUnauthorized = () => {
  listeners.forEach((l) => l())
}
