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
        className="liquid-glass-elevated animate-liquid-sheet w-full max-w-sm rounded-[32px] p-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="liquid-tint-emerald flex h-9 w-9 items-center justify-center rounded-2xl text-white">
              <Lock className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold tracking-tight text-slate-900">
              {t(lang, 'adminModalTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(lang, 'close')}
            className="liquid-interactive rounded-full bg-slate-900/8 p-2 text-slate-600 hover:bg-slate-900/14 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2.5 text-xs leading-relaxed text-slate-600">
          {t(lang, 'adminModalDesc')}
        </p>

        <input
          type="password"
          autoFocus
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError(false);
          }}
          placeholder={t(lang, 'adminPinPlaceholder')}
          className="liquid-input mt-3.5 w-full rounded-2xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
        />

        {error && (
          <p className="mt-2 text-xs font-semibold text-red-600">
            {t(lang, 'adminWrongPin')}
          </p>
        )}

        <button
          type="submit"
          disabled={checking || !pin.trim()}
          className="liquid-tint-emerald liquid-interactive mt-4 w-full rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {t(lang, 'adminUnlockBtn')}
        </button>
      </form>
    </div>
  );
}
