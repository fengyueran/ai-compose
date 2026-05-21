import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, defaultTheme } from '@xinghunm/compass-ui'
import './index.css'
import AiComposeApp from './ai-compose-app'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={defaultTheme}>
      <AiComposeApp />
    </ThemeProvider>
  </StrictMode>,
)
