import { NavLink, Outlet } from 'react-router-dom';
import { Bot, LayoutDashboard, Refrigerator, Settings, ShoppingBasket, Soup, Leaf } from 'lucide-react';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/pantry', label: 'My Pantry', short: 'Pantry', icon: Refrigerator },
  { to: '/meals', label: 'Meal Planner', short: 'Meals', icon: Soup },
  { to: '/shopping', label: 'Shopping List', short: 'Shop', icon: ShoppingBasket },
  { to: '/assistant', label: 'Assistant', short: 'Ask', icon: Bot },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: Settings }
];
export default function Layout() {
  const link = ({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-100 text-brand-700' : 'text-stone-600 hover:bg-stone-100'}`;
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-60 shrink-0 border-r border-stone-200 bg-white p-4 md:block">
        <div className="mb-6 flex items-center gap-2 px-2"><Leaf className="h-6 w-6 text-brand-600" /><span className="text-lg font-semibold">ShelfSense</span></div>
        <nav className="space-y-1" aria-label="Main">{NAV.map(({ to, label, icon: I, end }) => <NavLink key={to} to={to} end={end} className={link}><I className="h-4 w-4" />{label}</NavLink>)}</nav>
        <p className="mt-6 px-2 text-xs text-stone-500">Waste less food. Cook smarter. Shop only what you need.</p>
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-8"><div className="mx-auto max-w-5xl"><Outlet /></div></main>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-stone-200 bg-white md:hidden" aria-label="Main">
        {NAV.map(({ to, short, label, icon: I, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'text-brand-700' : 'text-stone-500'}`}><I className="h-5 w-5" />{short || label}</NavLink>))}
      </nav>
    </div>
  );
}
