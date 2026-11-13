import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  HardDrive,
  RefreshCw,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import { t } from '../i18n';
import { Language } from '../types';
import {
  clearOfflinePack,
  downloadOfflinePack,
  getOfflineStatus,
  OFFLINE_TOTAL_TILES,
  OfflineProgress,
  OfflineStatus,
} from '../utils/offlineManager';

interface OfflineModalProps {
  open: boolean;
  lang: Language;
  isOnline: boolean;
  onClose: () => void;
  onStatusChange?: (isReady: boolean) => void;
}

export function OfflineModal({
  open,
  lang,
  isOnline,
  onClose,
  onStatusChange,
}: OfflineModalProps) {
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<OfflineProgress | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const refreshStatus = async () => {
    const s = await getOfflineStatus();
    setStatus(s);
    onStatusChange?.(s.isComplete);
  };

  useEffect(() => {
    if (open) {
      refreshStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleDownload = async () => {
    if (!isOnline || downloading) return;
    setFailedCount(0);
    setDownloading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await downloadOfflinePack(
        (p) => setProgress(p),
        controller.signal
      );
      setFailedCount(res.failed);
    } finally {
      setDownloading(false);
      abortRef.current = null;
      await refreshStatus();
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleClear = async () => {
    await clearOfflinePack();
    setProgress(null);
    setFailedCount(0);
    await refreshStatus();
  };

  const pct = progress
    ? Math.round((progress.done / Math.max(1, progress.total)) * 100)
    : status
      ? Math.round((status.cachedCount / Math.max(1, status.totalCount)) * 100)
      : 0;

  const statusLabel = status?.isComplete
    ? t(lang, 'offlineReady')
    : (status?.cachedCount ?? 0) > 0
      ? t(lang, 'offlinePartial')
      : t(lang, 'offlineNotDownloaded');

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-3 backdrop-blur-xs sm:items-center">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                status?.isComplete
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {status?.isComplete ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <HardDrive className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {t(lang, 'offlineModeTitle')}
              </h2>
              <p
                className={`text-xs font-semibold ${
                  status?.isComplete
                    ? 'text-emerald-700'
                    : (status?.cachedCount ?? 0) > 0
                      ? 'text-amber-600'
                      : 'text-slate-500'
                }`}
              >
                {downloading ? t(lang, 'offlineDownloading') : statusLabel}
              </p>
            </div>
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

        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          {t(lang, 'offlineModeDesc')}
        </p>

        {/* Stats & Progress */}
        <div className="mt-4 rounded-2xl bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-700">
            <span>{t(lang, 'offlineTilesLabel')}</span>
            <span className="font-bold text-slate-900">
              {downloading && progress
                ? `${progress.done} / ${progress.total}`
                : `${status?.cachedCount ?? 0} / ${status?.totalCount ?? OFFLINE_TOTAL_TILES}`}{' '}
              ({pct}%)
            </span>
          </div>

          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                status?.isComplete ? 'bg-emerald-600' : 'bg-blue-600'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {status?.updatedAt && (
            <div className="mt-2 text-[11px] text-slate-500">
              {t(lang, 'offlineLastUpdated')}:{' '}
              {new Date(status.updatedAt).toLocaleDateString(
                lang === 'it' ? 'it-IT' : 'en-US',
                {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }
              )}
            </div>
          )}
        </div>

        {!isOnline && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>{t(lang, 'offlineNeedOnline')}</span>
          </div>
        )}

        {failedCount > 0 && (
          <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {t(lang, 'offlineFailedNote')} ({failedCount})
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {downloading ? (
            <button
              type="button"
              onClick={handleCancel}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-300"
            >
              <X className="h-4 w-4" />
              <span>{t(lang, 'offlineCancelBtn')}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!isOnline}
              onClick={handleDownload}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-emerald-800 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status?.isComplete ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>
                {status?.isComplete
                  ? t(lang, 'offlineUpdateBtn')
                  : t(lang, 'offlineDownloadBtn')}
              </span>
            </button>
          )}

          {!downloading && (status?.cachedCount ?? 0) > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
              <span>{t(lang, 'offlineClearBtn')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
