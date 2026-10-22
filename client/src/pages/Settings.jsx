import { useEffect, useState } from 'react';
import { callTool, MCP_URL } from '../lib/mcp.js';
import { useAsync } from '../components/useAsync.js';
import { useApp } from '../components/AppContext.jsx';
import { ErrorBox, PageHeader, Spinner } from '../components/ui.jsx';

const CUISINES = ['', 'American', 'Asian', 'French', 'Italian', 'Mediterranean'];
export default function SettingsPage() {
  const { toast, tools, lock } = useApp();
  const { data, error, loading, reload } = useAsync(() => callTool('get_preferences'));
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setP(data); }, [data]);
  if (loading && !p) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!p) return null;
  const diet = (v) => setP({ ...p, dietary: v === 'none' ? [] : v === 'vegan' ? ['vegetarian', 'vegan'] : ['vegetarian'] });
  const save = async (e) => {
    e.preventDefault();
    const servings = Number(p.servings);
    if (!Number.isInteger(servings) || servings < 1 || servings > 24) return toast('Servings must be a whole number from 1 to 24', 'error');
    setBusy(true);
    try { await callTool('update_preferences', { dietary: p.dietary, cuisine: p.cuisine, servings }); toast('Preferences saved'); } catch (e2) { toast(e2.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Settings" subtitle="Preferences are shared by everyone using this demo (no accounts)" />
      <form onSubmit={save} className="card max-w-lg space-y-4">
        <div><label className="label" htmlFor="diet">Dietary restriction</label>
          <select id="diet" className="input" value={p.dietary.includes('vegan') ? 'vegan' : p.dietary.includes('vegetarian') ? 'vegetarian' : 'none'} onChange={(e) => diet(e.target.value)}><option value="none">None</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option></select></div>
        <div><label className="label" htmlFor="cu">Preferred cuisine (ranking tie-breaker)</label>
          <select id="cu" className="input" value={p.cuisine} onChange={(e) => setP({ ...p, cuisine: e.target.value })}>{CUISINES.map((c) => <option key={c} value={c}>{c || 'No preference'}</option>)}</select></div>
        <div><label className="label" htmlFor="sv">Default servings</label><input id="sv" type="number" min="1" max="24" className="input" value={p.servings} onChange={(e) => setP({ ...p, servings: e.target.value })} /></div>
        <button className="btn-primary" disabled={busy}>Save preferences</button>
      </form>
      <section className="card mt-4 max-w-lg space-y-2 text-sm"><h2 className="font-semibold">Connection</h2>
        <p className="text-stone-600">MCP endpoint: <code>{MCP_URL}</code></p><p className="text-stone-600">{tools.length} tools discovered via <code>tools/list</code>.</p>
        <button className="btn-secondary" onClick={lock}>Disconnect &amp; forget access code</button></section>
    </>
  );
}
