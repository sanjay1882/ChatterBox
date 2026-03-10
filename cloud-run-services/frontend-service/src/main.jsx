import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// Import the EXACT original CSS files — no changes to styling
import './original-index.css'
// import './css/cosmic-color-fix.css'
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
