import { useState } from 'react';
import { Plus, ShoppingBasket, Trash2 } from 'lucide-react';
import { callTool } from '../lib/mcp.js';
import { useAsync } from '../components/useAsync.js';
import { useApp } from '../components/AppContext.jsx';
import { Confirm, Empty, ErrorBox, PageHeader, Spinner } from '../components/ui.jsx';

const UNITS = ['pcs', 'g', 'kg', 'ml', 'l', 'tbsp', 'tsp', 'cup', 'can', 'pack'];
export default function Shopping() {
  const { toast } = useApp();
  const { data, error, loading, reload } = useAsync(() => callTool('list_shopping_items'));
  const [f, setF] = useState({ name: '', quantity: '1', unit: 'pcs' });
  const [clearing, setClearing] = useState(false);
  const act = async (fn, okMsg) => { try { await fn(); if (okMsg) toast(okMsg); reload(); } catch (e) { toast(e.message, 'error'); } };
  const add = (e) => {
    e.preventDefault();
    const quantity = Number(f.quantity);
    if (!f.name.trim()) return toast('Enter an item name', 'error');
    if (!(quantity > 0)) return toast('Quantity must be greater than zero', 'error');
    act(() => callTool('add_shopping_item', { name: f.name.trim(), quantity, unit: f.unit }), 'Added to shopping list').then(() => setF({ ...f, name: '' }));
  };
  return (
    <>
      <PageHeader title="Shopping List" subtitle={data ? `${data.open} to buy · ${data.completed} done` : ''}>
        <button className="btn-secondary" disabled={!data?.completed} onClick={() => setClearing(true)}><Trash2 className="h-4 w-4" />Clear completed</button></PageHeader>
      <form onSubmit={add} className="card mb-4 grid gap-2 sm:grid-cols-[1fr_6rem_6rem_auto]">
        <input aria-label="Item name" className="input" placeholder="Add an item…" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} />
        <input aria-label="Quantity" type="number" min="0" step="any" className="input" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />
        <select aria-label="Unit" className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
        <button className="btn-primary"><Plus className="h-4 w-4" />Add</button>
      </form>
      {loading && !data ? <Spinner /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.items.length === 0 ? <Empty icon={ShoppingBasket} title="Your list is empty">Add items above, or add missing ingredients from a recipe.</Empty> : (
        <ul className="space-y-2">{data.items.map((i) => (
          <li key={i.id} className="card flex items-center gap-3 !p-3">
            <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={i.done} onChange={() => act(() => callTool('toggle_shopping_item', { id: i.id }))} aria-label={`Mark ${i.name} ${i.done ? 'not done' : 'done'}`} />
            <div className={`flex-1 ${i.done ? 'text-stone-400 line-through' : ''}`}>{i.name} <span className="text-sm text-stone-500">· {i.quantity} {i.unit}</span>{i.source.startsWith('recipe:') && <span className="ml-2 text-xs text-brand-700 no-underline">from recipe</span>}</div>
            <button className="rounded p-1.5 text-red-600 hover:bg-red-50" aria-label={`Remove ${i.name}`} onClick={() => act(() => callTool('remove_shopping_item', { id: i.id }), 'Removed')}><Trash2 className="h-4 w-4" /></button>
          </li>))}</ul>)}
      <Confirm open={clearing} danger title="Clear completed items?" confirmLabel="Clear" message={`Remove ${data?.completed || 0} completed item(s) from the list?`} onConfirm={() => act(() => callTool('clear_completed_shopping_items'), 'Cleared completed items').then(() => setClearing(false))} onClose={() => setClearing(false)} />
    </>
  );
}
