import { Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './components/AppContext.jsx';
import AccessGate from './components/AccessGate.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Pantry from './pages/Pantry.jsx';
import Meals from './pages/Meals.jsx';
import Shopping from './pages/Shopping.jsx';
import Assistant from './pages/Assistant.jsx';
import SettingsPage from './pages/Settings.jsx';

function Shell() {
  const { status } = useApp();
  if (status !== 'ready') return <AccessGate />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="pantry" element={<Pantry />} />
        <Route path="meals" element={<Meals />} />
        <Route path="shopping" element={<Shopping />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<p className="py-10 text-center text-stone-500">Page not found.</p>} />
      </Route>
    </Routes>
  );
}
export default function App() { return <AppProvider><Shell /></AppProvider>; }
