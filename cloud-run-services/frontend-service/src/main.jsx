import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// Import the global design system
import './index.css'
// Removed broken imports
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
