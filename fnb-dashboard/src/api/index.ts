import * as mock from '@/mocks'

import { useMocks } from '@/lib/mode'

import * as http from './http'
import * as ws from './ws'

/**
 * Swap one resource at a time. Resources already integrated live in `src/api/http/`;
 * everything else still resolves from `@/mocks`, so a page keeps working while its
 * neighbour is on the server. `VITE_USE_MOCKS=true` keeps the whole app on mocks.
 */
const integrated = { ...http, ...ws }

export const api = useMocks ? mock : { ...mock, ...integrated }

export * from './ws'
