import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';   // Tailwind v4 + tokens shadcn (importé AVANT styles.css)
import './styles.css';  // CSS vanilla de l'app (gagne sur les conflits éventuels)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
