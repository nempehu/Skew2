// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import Skew2 from './Skew2.jsx'
import './index.css'  // あればCSSも

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Skew2 />
  </React.StrictMode>,
)
