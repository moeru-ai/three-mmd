import { Routes } from '@generouted/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './main.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Routes />
  </StrictMode>,
)
