import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@/styles/popup.css'

const root = document.getElementById('app')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
