import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';

// Validate environment variables at startup
import { validateEnvVars, displayEnvErrors } from './utils/envValidation.js';

const envValidation = validateEnvVars();
if (displayEnvErrors(envValidation)) {
  console.error(
    '⚠️  Some environment variables are missing or invalid. The app may not work correctly.'
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
