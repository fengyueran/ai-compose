import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, defaultTheme } from '@xinghunm/compass-ui'
import './index.css'
import PromptWorkbenchApp from './prompt-workbench-app'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={defaultTheme}>
      <PromptWorkbenchApp />
    </ThemeProvider>
  </StrictMode>,
)
