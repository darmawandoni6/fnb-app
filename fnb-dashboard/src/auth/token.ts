/** Access token lives in memory only; the refresh token stays in the httpOnly cookie. */
let accessToken: string | null = null

export const getAccessToken = () => accessToken

export const setAccessToken = (token: string | null) => {
  accessToken = token
}
