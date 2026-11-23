import type { Settings } from '@/types'

import { request } from '../client'

export const getSettings = () => request<Settings>({ method: 'GET', url: '/settings' })

export const updateSettings = (body: Partial<Settings>) =>
  request<Settings>({ method: 'PATCH', url: '/settings', data: body })

export const closeStore = () => request<Settings>({ method: 'POST', url: '/settings/close' })
