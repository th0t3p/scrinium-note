import { createRoot } from 'react-dom/client';
import App from './App';
import './upstream.css';
import './style.css';

createRoot(document.getElementById('root')!).render(window.isSecureContext ? <App /> :
  <main className="gate"><h1>Use HTTPS or localhost</h1><p>This local vault needs a secure browser context to create and protect its keys.</p></main>);
