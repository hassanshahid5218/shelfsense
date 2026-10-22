import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Package, ShoppingBasket, Soup } from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { callTool } from '../lib/mcp.js';
import { useAsync } from '../components/useAsync.js';
import { Empty, ErrorBox, PageHeader, Spinner, StatusBadge } from '../components/ui.jsx';

const Stat = ({ icon: I, label, value, tone = 'text-brand-600' }) => (
  <div className="card flex items-center gap-3"><I className={`h-5 w-5 ${tone}`} /><div><div className="text-2xl font-semibold leading-none">{value}</div><div className="mt-1 text-xs text-stone-500">{label}</div></div></div>
);
const ItemRow = ({ i }) => (
  <li className="flex items-center justify-between gap-2 py-2 text-sm"><span>{i.name} <span className="text-stone-500">· {i.quantity} {i.unit}</span></span><StatusBadge status={i.status} days={i.daysUntilExpiry} /></li>
);

export default function Dashboard() {
  const { data, error, loading, reload } = useAsync(async () => {
    const [summary, shopping, recipes] = await Promise.all([callTool('get_pantry_summary'), callTool('list_shopping_items'), callTool('suggest_recipes', { focus: 'all', limit: 3 })]);
    return { summary, shopping, recipes };
  });
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { summary: s, shopping, recipes } = data;
  const chart = [{ name: 'Expired', value: s.counts.expired, c: '#dc2626' }, { name: 'Expiring soon', value: s.counts.expiringSoon, c: '#d97706' }, { name: 'Fresh', value: s.counts.fresh, c: '#4a8f5a' }];
  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Pantry overview for ${s.today}`}><Link to="/assistant" className="btn-primary">Ask the assistant</Link></PageHeader>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Package} label="Ingredients" value={s.distinctIngredients} />
        <Stat icon={Clock} label="Expiring in 3 days" value={s.counts.expiringSoon} tone="text-amber-600" />
        <Stat icon={AlertTriangle} label="Expired" value={s.counts.expired} tone="text-red-600" />
        <Stat icon={ShoppingBasket} label={`Shopping (${shopping.completed} done)`} value={shopping.open} />
      </div>
      {s.totalBatches === 0 ? <div className="mt-6"><Empty icon={Package} title="Your pantry is empty">Add ingredients on the My Pantry page, or run <code>npm run seed</code>.</Empty></div> : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="card"><h2 className="mb-1 font-semibold">Use soon</h2>
            {s.expiringSoon.length ? <ul className="divide-y divide-stone-100">{s.expiringSoon.map((i) => <ItemRow key={i.id} i={i} />)}</ul> : <p className="py-3 text-sm text-stone-500">Nothing expires in the next 3 days.</p>}</section>
          <section className="card"><h2 className="mb-1 font-semibold">Expired</h2>
            {s.expired.length ? <ul className="divide-y divide-stone-100">{s.expired.map((i) => <ItemRow key={i.id} i={i} />)}</ul> : <p className="py-3 text-sm text-stone-500">No expired items.</p>}</section>
          <section className="card"><h2 className="mb-2 font-semibold">Pantry freshness</h2>
            <div className="h-44"><ResponsiveContainer><BarChart data={chart}><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} width={28} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="value" radius={[6, 6, 0, 0]}>{chart.map((d) => <Cell key={d.name} fill={d.c} />)}</Bar></BarChart></ResponsiveContainer></div></section>
          <section className="card"><h2 className="mb-1 font-semibold">Recently added</h2>
            <ul className="divide-y divide-stone-100">{s.recentlyAdded.map((i) => <ItemRow key={i.id} i={i} />)}</ul></section>
          <section className="card lg:col-span-2"><div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Soup className="h-4 w-4" />Meal ideas</h2><Link to="/meals" className="text-sm text-brand-700 hover:underline">All recipes</Link></div>
            {recipes.recipes.length ? <div className="grid gap-3 sm:grid-cols-3">{recipes.recipes.map((r) => (
              <Link key={r.id} to="/meals" className="rounded-lg border border-stone-200 p-3 hover:border-brand-500"><div className="font-medium">{r.title}</div>
                <div className="mt-1 text-xs text-stone-500">{r.matchPercent}% in pantry · {r.cookTimeMinutes} min</div>
                {r.expiringIngredients.length > 0 && <div className="mt-1 text-xs text-amber-700">Uses expiring: {r.expiringIngredients.join(', ')}</div>}</Link>))}</div> : <p className="text-sm text-stone-500">No recipes match your preferences.</p>}</section>
        </div>)}
    </>
  );
}
