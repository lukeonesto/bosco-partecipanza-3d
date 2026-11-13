import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { t } from '../i18n';
import { Language } from '../types';
import { verifyAdminPin } from '../utils/adminAuth';

interface AdminPinModalProps {
  open: boolean;
  lang: Language;
  onClose: () => void;
  onUnlocked: () => void;
}

export function AdminPinModal({
  open,
  lang,
  onClose,
  onUnlocked,
}: AdminPinModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError(false);
    const ok = await verifyAdminPin(pin);
    setChecking(false);
    if (ok) {
      setPin('');
      onUnlocked();
    } else {
      setError(true);
    }
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-emerald-800" />
            <h2 className="text-base font-bold text-slate-900">
              {t(lang, 'adminModalTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(lang, 'close')}
            className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-600">{t(lang, 'adminModalDesc')}</p>

        <input
          type="password"
          autoFocus
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError(false);
          }}
          placeholder={t(lang, 'adminPinPlaceholder')}
          className="mt-3 w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-700 focus:outline-none"
        />

        {error && (
          <p className="mt-2 text-xs font-medium text-red-600">
            {t(lang, 'adminWrongPin')}
          </p>
        )}

        <button
          type="submit"
          disabled={checking || !pin.trim()}
          className="mt-4 w-full rounded-2xl bg-emerald-800 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
        >
          {t(lang, 'adminUnlockBtn')}
        </button>
      </form>
    </div>
  );
}
