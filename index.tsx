/**
 * Fix: The original content of this file was placeholder text "full contents of index.tsx",
 * which is not valid code. It has been replaced with a standard React 18 entry point
 * to render the main App component.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
