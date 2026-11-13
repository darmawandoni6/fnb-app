import { StrictMode } from 'react'

import { createRoot } from 'react-dom/client'

import { runMockSelfCheck } from '@/mocks/selfcheck'

import { useMocks } from '@/lib/mode'

import App from './App.tsx'
import './index.css'

if (useMocks) void runMockSelfCheck()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
