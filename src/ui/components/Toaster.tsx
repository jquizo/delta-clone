import { useEffect } from 'react';
import { useToastStore, type Toast } from '../../app/toastStore';

const AUTO_DISMISS_MS = 5000;

function ToastItem({ id, message, variant }: Toast) {
  const dismissToast = useToastStore((s) => s.dismissToast);

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [id, dismissToast]);

  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm shadow-sm ${
        variant === 'error' ? 'bg-negative text-white' : 'bg-positive text-white'
      }`}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={() => dismissToast(id)}
        aria-label="Dismiss notification"
        className="text-white/80 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} />
      ))}
    </div>
  );
}
