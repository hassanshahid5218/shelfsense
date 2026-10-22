import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { connect, disconnect, isAuthError } from '../lib/mcp.js';
import { Toasts } from './ui.jsx';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);
const KEY = 'shelfsense.token';

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(KEY) || '');
  const [status, setStatus] = useState(token ? 'connecting' : 'locked'); // locked | connecting | ready | error
  const [tools, setTools] = useState([]);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (!token) { setStatus('locked'); return; }
    let cancelled = false;
    setStatus('connecting');
    connect(token).then((t) => { if (!cancelled) { setTools(t); setStatus('ready'); setError(null); } })
      .catch((e) => { if (cancelled) return; if (isAuthError(e)) { sessionStorage.removeItem(KEY); setToken(''); setError(new Error('That access code was not accepted.')); } else { setError(e); setStatus('error'); } });
    return () => { cancelled = true; };
  }, [token]);

  const unlock = useCallback((t) => { sessionStorage.setItem(KEY, t); setError(null); setToken(t); }, []);
  const lock = useCallback(async () => { sessionStorage.removeItem(KEY); await disconnect(); setTools([]); setToken(''); }, []);
  const retry = useCallback(() => { setToken((t) => `${t}`); setStatus('connecting'); connect(token).then((x) => { setTools(x); setStatus('ready'); setError(null); }).catch((e) => { setError(e); setStatus('error'); }); }, [token]);
  const toast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((l) => [...l, { id, message, type }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 4500);
  }, []);
  const value = useMemo(() => ({ status, tools, error, unlock, lock, retry, toast }), [status, tools, error, unlock, lock, retry, toast]);
  return <Ctx.Provider value={value}>{children}<Toasts toasts={toasts} dismiss={(id) => setToasts((l) => l.filter((x) => x.id !== id))} /></Ctx.Provider>;
}
