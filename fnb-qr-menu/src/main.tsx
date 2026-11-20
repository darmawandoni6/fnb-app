import { StrictMode } from 'react'

import { createRoot } from 'react-dom/client'

import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-serif/400.css'
import '@fontsource/ibm-plex-serif/600.css'

import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
