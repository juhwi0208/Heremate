// client/src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';   // ✅ 추가

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>                           {/* ✅ App을 라우터로 감싸기 */}
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
