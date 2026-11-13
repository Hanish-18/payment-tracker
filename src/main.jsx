import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRoot from './AppRoot.jsx'
import RecoveryGate from './Recovery'
import './ThemeToggle'
import './Accent'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RecoveryGate>
      <AppRoot />
    </RecoveryGate>
  </StrictMode>,
)
