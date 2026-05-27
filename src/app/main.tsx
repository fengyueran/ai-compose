import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, defaultTheme } from '@xinghunm/compass-ui'
import './styles/index.css'
import { App } from './app'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={defaultTheme}>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
