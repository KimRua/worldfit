import React from 'react';
import ReactDOM from 'react-dom/client';
import { MiniKitProvider } from '@worldcoin/minikit-js/minikit-provider';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MiniKitProvider
      props={{
        appId: import.meta.env.VITE_WORLD_MINI_APP_ID,
      }}
    >
      <App />
    </MiniKitProvider>
  </React.StrictMode>,
);
