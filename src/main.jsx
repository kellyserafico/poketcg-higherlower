import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Suppress Chrome extension errors in console
const originalError = console.error;
console.error = (...args) => {
	// Filter out Chrome extension errors
	const errorString = args.join(' ');
	if (
		errorString.includes('chrome-extension://') ||
		errorString.includes('userReportLinkedCandidate.json') ||
		errorString.includes('hook.js')
	) {
		return; // Suppress extension errors
	}
	originalError.apply(console, args);
};

// Suppress Chrome extension resource loading errors
window.addEventListener('error', (event) => {
	if (
		event.filename?.includes('chrome-extension://') ||
		event.message?.includes('chrome-extension://') ||
		event.message?.includes('userReportLinkedCandidate.json')
	) {
		event.preventDefault(); // Prevent error from showing in console
		return false;
	}
}, true);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
