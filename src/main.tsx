import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PromptWorkbenchApp from './prompt-workbench-app'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PromptWorkbenchApp />
  </StrictMode>,
)
