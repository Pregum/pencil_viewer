import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from './i18n/I18nContext';
import { GitHubProvider } from './github/GitHubContext';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <GitHubProvider>
        <App />
      </GitHubProvider>
    </I18nProvider>
  </StrictMode>,
);
