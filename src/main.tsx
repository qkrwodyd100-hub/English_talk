import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LearningApp from './LearningApp'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LearningApp />
  </StrictMode>,
)
