import { useState } from 'react';
import { Pencil, Plus, Refrigerator, Search, Trash2 } from 'lucide-react';
import { callTool } from '../lib/mcp.js';
import { useAsync } from '../components/useAsync.js';
import { useApp } from '../components/AppContext.jsx';
import { Confirm, Empty, ErrorBox, Modal, PageHeader, Spinner, StatusBadge } from '../components/ui.jsx';

const CATEGORIES = ['produce', 'dairy', 'meat', 'grains', 'pantry', 'bakery', 'frozen', 'beverages', 'other'];
const UNITS = ['g', 'kg', 'ml', 'l', 'pcs', 'tbsp', 'tsp', 'cup', 'can', 'pack'];
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function ItemForm({ item, onSaved, onCancel }) {
  const { toast } = useApp();
  const [f, setF] = useState(item ? { name: item.name, category: item.category, quantity: String(item.quantity), unit: item.unit, expiryDate: item.expiryDate } : { name: '', category: 'produce', quantity: '1', unit: 'pcs', expiryDate: inDays(7) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const quantity = Number(f.quantity);
    if (!f.name.trim()) return setErr('Name is required.');
    if (!(quantity > 0)) return setErr('Quantity must be greater than zero.');
    if (!f.expiryDate) return setErr('Expiry date is required.');
    setBusy(true); setErr('');
    try {
      const args = { name: f.name.trim(), category: f.category, quantity, unit: f.unit, expiryDate: f.expiryDate };
      await (item ? callTool('update_pantry_item', { id: item.id, ...args }) : callTool('add_pantry_item', args));
      toast(item ? 'Item updated' : 'Item added'); onSaved();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <ErrorBox error={new Error(err)} />}
      <div><label className="label" htmlFor="n">Name</label><input id="n" className="input" value={f.name} onChange={set('name')} maxLength={80} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="q">Quantity</label><input id="q" type="number" min="0" step="any" className="input" value={f.quantity} onChange={set('quantity')} /></div>
        <div><label className="label" htmlFor="u">Unit</label><select id="u" className="input" value={f.unit} onChange={set('unit')}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></div>
        <div><label className="label" htmlFor="c">Category</label><select id="c" className="input" value={f.category} onChange={set('category')}>{CATEGORIES.map((u) => <option key={u}>{u}</option>)}</select></div>
        <div><label className="label" htmlFor="d">Expiry date</label><input id="d" type="date" className="input" value={f.expiryDate} onChange={set('expiryDate')} /></div>
      </div>
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button><button className="btn-primary" disabled={busy}>{item ? 'Save changes' : 'Add item'}</button></div>
    </form>
  );
}

export default function Pantry() {
  const { toast } = useApp();
  const [q, setQ] = useState({ search: '', category: '', status: '', sortBy: 'expiryDate', sortDir: 'asc' });
  const [editing, setEditing] = useState(null); // null | 'new' | item
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useAsync(() => callTool('list_pantry', Object.fromEntries(Object.entries(q).filter(([, v]) => v))), [q]);
  const set = (k) => (e) => setQ({ ...q, [k]: e.target.value });
  const del = async () => {
    setBusy(true);
    try { await callTool('delete_pantry_item', { id: deleting.id }); toast(`Deleted ${deleting.name}`); setDeleting(null); reload(); }
    catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const filtered = q.search || q.category || q.status;
  return (
    <>
      <PageHeader title="My Pantry" subtitle="Every batch, with its own expiry date"><button className="btn-primary" onClick={() => setEditing('new')}><Plus className="h-4 w-4" />Add item</button></PageHeader>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" /><input aria-label="Search" placeholder="Search ingredients" className="input pl-9" value={q.search} onChange={set('search')} /></div>
        <select aria-label="Category" className="input" value={q.category} onChange={set('category')}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <select aria-label="Status" className="input" value={q.status} onChange={set('status')}><option value="">All statuses</option><option value="expired">Expired</option><option value="expiring-soon">Expiring soon</option><option value="fresh">Fresh</option></select>
        <select aria-label="Sort" className="input" value={`${q.sortBy}:${q.sortDir}`} onChange={(e) => { const [sortBy, sortDir] = e.target.value.split(':'); setQ({ ...q, sortBy, sortDir }); }}>
          <option value="expiryDate:asc">Expiry (soonest)</option><option value="expiryDate:desc">Expiry (latest)</option><option value="name:asc">Name A–Z</option><option value="quantity:desc">Quantity (high)</option><option value="createdAt:desc">Recently added</option></select>
      </div>
      {loading && !data ? <Spinner /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.items.length === 0 ? (
        <Empty icon={Refrigerator} title={filtered ? 'No matching items' : 'Your pantry is empty'}>{filtered ? 'Try clearing your filters.' : 'Add your first ingredient to start tracking expiry dates.'}</Empty>) : (
        <ul className="space-y-2">{data.items.map((i) => (
          <li key={i.id} className="card flex flex-wrap items-center justify-between gap-2 !p-3">
            <div><div className="font-medium">{i.name}</div><div className="text-xs text-stone-500">{i.quantity} {i.unit} · {i.category} · expires {i.expiryDate}</div></div>
            <div className="flex items-center gap-2"><StatusBadge status={i.status} days={i.daysUntilExpiry} />
              <button className="rounded p-1.5 text-stone-500 hover:bg-stone-100" aria-label={`Edit ${i.name}`} onClick={() => setEditing(i)}><Pencil className="h-4 w-4" /></button>
              <button className="rounded p-1.5 text-red-600 hover:bg-red-50" aria-label={`Delete ${i.name}`} onClick={() => setDeleting(i)}><Trash2 className="h-4 w-4" /></button></div>
          </li>))}</ul>)}
      <Modal open={!!editing} title={editing === 'new' ? 'Add pantry item' : 'Edit pantry item'} onClose={() => setEditing(null)}>
        {editing && <ItemForm item={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}</Modal>
      <Confirm open={!!deleting} danger busy={busy} title="Delete item?" confirmLabel="Delete" message={`Permanently delete ${deleting?.name} (${deleting?.quantity} ${deleting?.unit}, expires ${deleting?.expiryDate})?`} onConfirm={del} onClose={() => setDeleting(null)} />
    </>
  );
}
