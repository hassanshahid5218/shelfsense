import { useEffect, useRef, useState } from 'react';
import { Bot, Send, ShoppingBasket, Wrench } from 'lucide-react';
import { callTool } from '../lib/mcp.js';
import { parseIntent } from '../lib/intent.js';
import { PageHeader, StatusBadge } from '../components/ui.jsx';

const SUGGESTIONS = ['What is in my pantry?', 'What expires within three days?', 'What can I cook using ingredients that will expire soon?', 'Show my shopping list', 'I used one liter of milk'];
const HELP = 'I can show your pantry, list what expires soon, suggest meals, show missing ingredients for a recipe, add them to your shopping list, show the list, and log usage ("I used 250 g of rice").';

const Trace = ({ trace }) => !trace?.length ? null : (
  <div className="mt-2 flex flex-wrap gap-1.5">{trace.map((t, k) => (
    <span key={k} title={JSON.stringify(t.args)} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] ${t.ok ? 'border-brand-100 bg-brand-50 text-brand-700' : 'border-red-200 bg-red-50 text-red-700'}`}><Wrench className="h-3 w-3" />{t.name} · {t.ok ? 'ok' : 'failed'} · {t.ms}ms</span>))}</div>
);

export default function Assistant() {
  const [msgs, setMsgs] = useState([{ id: 0, role: 'bot', text: `Hi! ${HELP}` }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const ctx = useRef({ lastRecipes: [], selectedRecipeId: null });
  const end = useRef(null);
  const nid = useRef(1);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);
  const push = (m) => setMsgs((l) => [...l, { id: nid.current++, ...m }]);

  const showMissing = async (recipeId, trace) => {
    const m = await callTool('get_missing_ingredients', { recipeId }, trace);
    ctx.current.selectedRecipeId = recipeId;
    if (!m.missing.length) return { text: `You have everything for ${m.title}.`, trace };
    return { text: `For ${m.title} (${m.servings} servings) you are missing:`, view: { type: 'missing', recipeId, title: m.title, missing: m.missing }, trace };
  };

  const handle = async (text) => {
    const it = parseIntent(text, ctx.current);
    const trace = [];
    try {
      switch (it.intent) {
        case 'pantry': { const d = await callTool('list_pantry', {}, trace); return { text: `You have ${d.count} item batch${d.count === 1 ? '' : 'es'} in your pantry:`, view: { type: 'items', items: d.items }, trace }; }
        case 'expiring': { const d = await callTool('get_expiring_items', { days: it.days }, trace); return { text: d.count ? `${d.count} item${d.count === 1 ? '' : 's'} expired or expiring within ${it.days} day${it.days === 1 ? '' : 's'}:` : `Nothing expires within ${it.days} days.`, view: d.count ? { type: 'items', items: d.items } : null, trace }; }
        case 'cook': {
          const d = await callTool('suggest_recipes', { focus: it.focus, limit: 4 }, trace);
          ctx.current.lastRecipes = d.recipes.map((r) => ({ id: r.id, title: r.title })); ctx.current.selectedRecipeId = null;
          return { text: d.count ? (it.focus === 'expiring' ? 'These meals use ingredients that are about to expire:' : 'Here are meals that fit your pantry:') : 'No recipes match right now. Try adding ingredients or relaxing your dietary settings.', view: d.count ? { type: 'recipes', recipes: d.recipes } : null, trace };
        }
        case 'missing': case 'add_missing': return await showMissing(it.recipeId, trace);
        case 'shopping': { const d = await callTool('list_shopping_items', {}, trace); return { text: d.count ? `Your shopping list has ${d.open} item${d.open === 1 ? '' : 's'} to buy (${d.completed} done):` : 'Your shopping list is empty.', view: d.count ? { type: 'shopping', items: d.items } : null, trace }; }
        case 'used': {
          const d = await callTool('mark_item_used', { name: it.name, quantity: it.quantity, unit: it.unit }, trace);
          const left = d.remainingBatches.map((b) => `${b.quantity} ${b.unit}`).join(' + ');
          return { text: `Logged: used ${it.quantity} ${it.unit}${it.assumedUnit ? ' (I assumed pieces)' : ''} of ${it.name}. ${left ? `Remaining: ${left}.` : 'None left.'}`, trace };
        }
        case 'clarify': return { text: it.message, trace };
        default: return { text: HELP, trace };
      }
    } catch (e) { return { text: `That didn't work: ${e.message}`, error: true, trace }; }
  };

  const send = async (text) => {
    if (!text.trim() || busy) return;
    setInput(''); setBusy(true); push({ role: 'user', text });
    push({ role: 'bot', ...(await handle(text)) });
    setBusy(false);
  };
  const select = async (r) => {
    setBusy(true); push({ role: 'user', text: `Select ${r.title}` });
    const trace = [];
    try { push({ role: 'bot', ...(await showMissing(r.id, trace)) }); } catch (e) { push({ role: 'bot', text: `That didn't work: ${e.message}`, error: true, trace }); }
    setBusy(false);
  };
  const addToList = async (m, msgId) => {
    setBusy(true);
    const trace = [];
    try {
      const d = await callTool('add_missing_recipe_ingredients', { recipeId: m.recipeId }, trace);
      setMsgs((l) => l.map((x) => (x.id === msgId ? { ...x, done: true } : x)));
      push({ role: 'bot', text: d.changed ? `Done. Added ${d.changed} item${d.changed === 1 ? '' : 's'} to your shopping list${d.added.length > d.changed ? ' (the rest were already listed)' : ''}.` : 'Everything was already on your shopping list.', trace });
    } catch (e) { push({ role: 'bot', text: `Could not update the shopping list: ${e.message}`, error: true, trace }); }
    setBusy(false);
  };

  const View = ({ m }) => {
    const v = m.view;
    if (!v) return null;
    if (v.type === 'items') return <ul className="mt-2 divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white px-3">{v.items.map((i) => <li key={i.id} className="flex items-center justify-between gap-2 py-1.5 text-sm"><span>{i.name} · {i.quantity} {i.unit}</span><StatusBadge status={i.status} days={i.daysUntilExpiry} /></li>)}</ul>;
    if (v.type === 'shopping') return <ul className="mt-2 divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white px-3">{v.items.map((i) => <li key={i.id} className={`py-1.5 text-sm ${i.done ? 'text-stone-400 line-through' : ''}`}>{i.name} · {i.quantity} {i.unit}</li>)}</ul>;
    if (v.type === 'recipes') return <div className="mt-2 space-y-2">{v.recipes.map((r) => (
      <div key={r.id} className="rounded-lg border border-stone-200 bg-white p-3 text-sm"><div className="flex items-center justify-between gap-2"><b>{r.title}</b><button className="btn-secondary !py-1" disabled={busy} onClick={() => select(r)}>Select</button></div>
        <div className="text-xs text-stone-500">{r.matchPercent}% in pantry · {r.cookTimeMinutes} min · {r.missingIngredients.length} missing</div>{r.expiringIngredients.length > 0 && <div className="text-xs text-amber-700">Uses expiring: {r.expiringIngredients.join(', ')}</div>}</div>))}</div>;
    if (v.type === 'missing') return (
      <div className="mt-2 rounded-lg border border-stone-200 bg-white p-3 text-sm"><ul className="list-disc pl-5">{v.missing.map((x) => <li key={x.name}>{x.quantity} {x.unit} {x.name}</li>)}</ul>
        <button className="btn-primary mt-3" disabled={busy || m.done} onClick={() => addToList(v, m.id)}><ShoppingBasket className="h-4 w-4" />{m.done ? 'Added' : `Add ${v.missing.length} to shopping list`}</button></div>);
    return null;
  };

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col md:h-[calc(100vh-5rem)]">
      <PageHeader title="Assistant" subtitle="Every answer comes from a real MCP tool call (shown as chips)" />
      <div className="card flex-1 space-y-4 overflow-y-auto" aria-live="polite">
        {msgs.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
            {m.role === 'bot' && <Bot className="mt-1 h-5 w-5 shrink-0 text-brand-600" />}
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.role === 'user' ? 'bg-brand-600 text-white' : m.error ? 'bg-red-50 text-red-800' : 'bg-stone-100'}`}>
              <p>{m.text}</p>{m.role === 'bot' && <><View m={m} /><Trace trace={m.trace} /></>}</div>
          </div>))}
        {busy && <p className="text-xs text-stone-500">Working…</p>}<div ref={end} />
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{SUGGESTIONS.map((s) => <button key={s} className="btn-secondary shrink-0 !py-1 text-xs" disabled={busy} onClick={() => send(s)}>{s}</button>)}</div>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input aria-label="Message" className="input" placeholder="Ask about your pantry…" value={input} onChange={(e) => setInput(e.target.value)} maxLength={300} />
        <button className="btn-primary" disabled={busy || !input.trim()} aria-label="Send"><Send className="h-4 w-4" /></button></form>
    </div>
  );
}
