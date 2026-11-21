import { StrictMode } from 'react'

import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import './index.css'

// Opt-in mock contract check: `VITE_RUN_MOCK_SELFCHECK=true npm run dev`, then read the console.
if (import.meta.env.VITE_RUN_MOCK_SELFCHECK === 'true') {
  void import('@/mocks/selfcheck').then(({ runMockSelfCheck }) => runMockSelfCheck())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
