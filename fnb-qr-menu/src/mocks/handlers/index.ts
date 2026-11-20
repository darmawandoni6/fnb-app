export * from './publicMenu'
export * from './publicOrders'

const MIN_LATENCY_MS = 200
const MAX_LATENCY_MS = 500

export function sleep(ms = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS)) {
  // Tests skip the artificial latency; the browser keeps it so skeletons are visible.
  const delay = import.meta.env.MODE === 'test' ? 0 : ms
  return new Promise((resolve) => setTimeout(resolve, delay))
}
