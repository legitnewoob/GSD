import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker
    .register('/sw.js', { updateViaCache: 'none' })
    .then((registration) => registration.update())
    .catch((err) => {
      console.error('Service worker registration failed:', err);
    });
}
