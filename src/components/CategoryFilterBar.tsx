import { CATEGORIES } from '../data/categories';
import { t } from '../i18n';
import { CategoryId, Language } from '../types';

interface CategoryFilterBarProps {
  lang: Language;
  activeCategory: CategoryId | 'all';
  onSelectCategory: (cat: CategoryId | 'all') => void;
  showTrails: boolean;
  onToggleTrails: () => void;
  counts: Record<string, number>;
}

export function CategoryFilterBar({
  lang,
  activeCategory,
  onSelectCategory,
  showTrails,
  onToggleTrails,
  counts,
}: CategoryFilterBarProps) {
  return (
    <div className="pointer-events-none relative z-10 -mx-3 px-3">
      <div className="no-scrollbar pointer-events-auto flex items-center gap-1.5 overflow-x-auto py-1">
        <button
          type="button"
          onClick={() => onSelectCategory('all')}
          className={`liquid-interactive shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
            activeCategory === 'all'
              ? 'liquid-tint-emerald text-white'
              : 'liquid-glass text-slate-800 hover:bg-white/80'
          }`}
        >
          {t(lang, 'allCategories')}
        </button>

        <button
          type="button"
          onClick={onToggleTrails}
          className={`liquid-interactive shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
            showTrails
              ? 'liquid-tint-amber text-white'
              : 'liquid-glass text-slate-700 hover:bg-white/80'
          }`}
        >
          🥾 {t(lang, 'trails')}
        </button>

        {CATEGORIES.map((cat) => {
          const count = counts[cat.id] || 0;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(isActive ? 'all' : cat.id)}
              className={`liquid-interactive flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                isActive
                  ? 'liquid-tint-dark text-white'
                  : 'liquid-glass text-slate-800 hover:bg-white/80'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{lang === 'en' ? cat.label_en : cat.label_it}</span>
              {count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-900/8 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
