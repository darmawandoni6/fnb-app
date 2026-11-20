export const browseState: {
  cat: string
  q: string
  restore: boolean
  scrollY: number
  lastOpen: string | null
  notice: string | null
} = {
  cat: 'all',
  q: '',
  restore: false,
  scrollY: 0,
  lastOpen: null,
  notice: null,
}

export function patchBrowseState(patch: Partial<typeof browseState>) {
  Object.assign(browseState, patch)
}
