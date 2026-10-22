import { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';

export const Spinner = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-500" role="status"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>
);
export const ErrorBox = ({ error, onRetry }) => (
  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
    <div className="flex-1">{error?.message || String(error)}</div>
    {onRetry && <button className="btn-secondary !py-1" onClick={onRetry}>Retry</button>}
  </div>
);
export const Empty = ({ icon: Icon = Info, title, children }) => (
  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-white/60 px-6 py-10 text-center">
    <Icon className="h-6 w-6 text-stone-400" /><p className="font-medium text-stone-700">{title}</p>
    {children && <p className="max-w-sm text-sm text-stone-500">{children}</p>}
  </div>
);
const STATUS = {
  expired: ['bg-red-100 text-red-800', 'Expired'],
  'expiring-soon': ['bg-amber-100 text-amber-800', 'Expiring soon'],
  fresh: ['bg-brand-100 text-brand-700', 'Fresh']
};
export const StatusBadge = ({ status, days }) => {
  const [cls, label] = STATUS[status] || STATUS.fresh;
  const extra = status === 'expired' ? ` ${Math.abs(days)}d ago` : status === 'expiring-soon' ? (days === 0 ? ' today' : ` in ${days}d`) : '';
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}{extra}</span>;
};
export const PageHeader = ({ title, subtitle, children }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}</div>
    <div className="flex gap-2">{children}</div>
  </div>
);
export function Modal({ open, title, onClose, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl focus:outline-none sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2>
          <button className="rounded p-1 text-stone-500 hover:bg-stone-100" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button></div>
        {children}
      </div>
    </div>
  );
}
export const Confirm = ({ open, title, message, confirmLabel = 'Confirm', danger, busy, onConfirm, onClose }) => (
  <Modal open={open} title={title} onClose={onClose}>
    <p className="mb-5 text-sm text-stone-600">{message}</p>
    <div className="flex justify-end gap-2">
      <button className="btn-secondary" onClick={onClose}>Cancel</button>
      <button className={danger ? 'btn-danger' : 'btn-primary'} disabled={busy} onClick={onConfirm}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{confirmLabel}</button>
    </div>
  </Modal>
);
export const Toasts = ({ toasts, dismiss }) => (
  <div className="pointer-events-none fixed bottom-20 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 md:bottom-4" aria-live="polite">
    {toasts.map((t) => (
      <div key={t.id} className={`pointer-events-auto flex items-start gap-2 rounded-lg border p-3 text-sm shadow-md ${t.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-brand-100 bg-white text-stone-800'}`}>
        {t.type === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-brand-600" />}
        <span className="flex-1">{t.message}</span><button onClick={() => dismiss(t.id)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
      </div>))}
  </div>
);
