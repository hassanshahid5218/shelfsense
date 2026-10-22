import { useState } from 'react';
import { KeyRound, Leaf, Loader2 } from 'lucide-react';
import { useApp } from './AppContext.jsx';
import { ErrorBox } from './ui.jsx';
import { MCP_URL } from '../lib/mcp.js';

export default function AccessGate() {
  const { status, error, unlock, retry } = useApp();
  const [code, setCode] = useState('');
  if (status === 'connecting') return <div className="flex min-h-screen items-center justify-center gap-2 text-stone-500"><Loader2 className="h-4 w-4 animate-spin" />Connecting to MCP server…</div>;
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2"><Leaf className="h-6 w-6 text-brand-600" /><h1 className="text-xl font-semibold">ShelfSense</h1></div>
        {status === 'error' ? (<><ErrorBox error={error} /><p className="text-xs text-stone-500">Is the server running at {MCP_URL}?</p><button className="btn-primary w-full" onClick={retry}>Try again</button></>) : (
          <form onSubmit={(e) => { e.preventDefault(); code.trim() && unlock(code.trim()); }} className="space-y-3">
            <p className="text-sm text-stone-600">This demo server is protected. Enter the demo access code configured as <code>DEMO_ACCESS_TOKEN</code> on the server.</p>
            {error && <ErrorBox error={error} />}
            <div><label className="label" htmlFor="code">Access code</label><input id="code" type="password" autoComplete="off" className="input" value={code} onChange={(e) => setCode(e.target.value)} autoFocus /></div>
            <button className="btn-primary w-full" disabled={!code.trim()}><KeyRound className="h-4 w-4" />Connect</button>
            <p className="text-xs text-stone-500">The code is kept only for this browser tab session.</p>
          </form>)}
      </div>
    </div>
  );
}
