import { useState } from 'react';
import { CheckCircle2, Clock, ShoppingBasket, Soup, Users } from 'lucide-react';
import { callTool } from '../lib/mcp.js';
import { useAsync } from '../components/useAsync.js';
import { useApp } from '../components/AppContext.jsx';
import { Confirm, Empty, ErrorBox, Modal, PageHeader, Spinner } from '../components/ui.jsx';

export default function Meals() {
  const { toast } = useApp();
  const [focus, setFocus] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const list = useAsync(() => callTool('suggest_recipes', { focus, limit: 8 }), [focus]);
  const detail = useAsync(() => (openId ? callTool('get_recipe_details', { recipeId: openId }) : Promise.resolve(null)), [openId]);
  const r = detail.data?.recipe;
  const addMissing = async () => {
    setBusy(true);
    try {
      const res = await callTool('add_missing_recipe_ingredients', { recipeId: openId });
      toast(res.changed ? `Added ${res.changed} ingredient${res.changed > 1 ? 's' : ''} to your shopping list` : 'Everything is already on your shopping list');
      setConfirming(false); detail.reload();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Meal Planner" subtitle="Ranked by what you have, using soon-to-expire food first">
        <div className="inline-flex rounded-lg border border-stone-300 bg-white p-0.5 text-sm" role="group" aria-label="Filter">
          {[['all', 'All matches'], ['expiring', 'Uses expiring']].map(([v, l]) => <button key={v} aria-pressed={focus === v} onClick={() => setFocus(v)} className={`rounded-md px-3 py-1.5 ${focus === v ? 'bg-brand-600 text-white' : 'text-stone-600'}`}>{l}</button>)}</div>
      </PageHeader>
      <p className="mb-4 text-xs text-stone-500">Recipes come from a small curated list and are matched deterministically against your pantry. Not AI-generated.</p>
      {list.loading && !list.data ? <Spinner /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : list.data.recipes.length === 0 ? <Empty icon={Soup} title="No recipes to suggest">Try "All matches", add more ingredients, or relax your dietary settings.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2">{list.data.recipes.map((x) => (
          <button key={x.id} onClick={() => setOpenId(x.id)} className="card text-left transition hover:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500">
            <div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{x.title}</h2>{x.canCookNow ? <span className="flex items-center gap-1 text-xs font-medium text-brand-700"><CheckCircle2 className="h-3.5 w-3.5" />Ready</span> : <span className="text-xs text-stone-500">{x.missingIngredients.length} missing</span>}</div>
            <div className="mt-1 flex gap-3 text-xs text-stone-500"><span className="flex items-center gap-1"><Clock className="h-3 w-3" />{x.cookTimeMinutes} min</span><span className="flex items-center gap-1"><Users className="h-3 w-3" />{x.servings}</span><span>{x.cuisine}</span></div>
            <div className="mt-3 h-1.5 rounded bg-stone-100"><div className="h-1.5 rounded bg-brand-500" style={{ width: `${x.matchPercent}%` }} /></div>
            <div className="mt-1 text-xs text-stone-500">{x.matchPercent}% of ingredients in pantry</div>
            {x.expiringIngredients.length > 0 && <div className="mt-2 text-xs text-amber-700">Uses expiring: {x.expiringIngredients.join(', ')}</div>}
          </button>))}</div>)}
      <Modal open={!!openId} wide title={r?.title || 'Recipe'} onClose={() => setOpenId(null)}>
        {detail.loading && !r ? <Spinner /> : detail.error ? <ErrorBox error={detail.error} /> : r && (
          <div className="space-y-4 text-sm">
            <div className="flex gap-4 text-stone-500"><span>{r.cookTimeMinutes} min</span><span>{r.servings} servings</span><span>{r.cuisine}</span>{r.tags.map((t) => <span key={t}>{t}</span>)}</div>
            <div><h3 className="mb-1 font-semibold">Ingredients</h3><ul className="divide-y divide-stone-100">{r.ingredients.map((i) => (
              <li key={i.name} className="flex justify-between py-1.5"><span>{i.name} <span className="text-stone-500">· {i.needed} {i.unit}</span></span>
                {i.have ? <span className="text-brand-700">In pantry{i.expiringSoon ? ' (expiring)' : ''}</span> : <span className="text-red-700">Missing {i.missing} {i.unit}</span>}</li>))}</ul></div>
            <div><h3 className="mb-1 font-semibold">Instructions</h3><ol className="list-decimal space-y-1 pl-5">{r.instructions.map((s, k) => <li key={k}>{s}</li>)}</ol></div>
            {r.missingIngredients.length > 0 ? <button className="btn-primary w-full" onClick={() => setConfirming(true)}><ShoppingBasket className="h-4 w-4" />Add {r.missingIngredients.length} missing to shopping list</button> : <p className="rounded-lg bg-brand-50 p-3 text-brand-700">You have everything for this recipe.</p>}
          </div>)}
      </Modal>
      <Confirm open={confirming} busy={busy} title="Add to shopping list?" confirmLabel="Add items" message={r ? `Add ${r.missingIngredients.map((m) => `${m.quantity} ${m.unit} ${m.name}`).join(', ')} to your shopping list?` : ''} onConfirm={addMissing} onClose={() => setConfirming(false)} />
    </>
  );
}
