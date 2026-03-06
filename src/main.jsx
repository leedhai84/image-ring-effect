import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import CylinderGallery from './CylinderGallery.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CylinderGallery />
  </StrictMode>,
)
