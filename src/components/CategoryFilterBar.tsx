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
    <div className="pointer-events-none absolute inset-x-0 top-[4.2rem] z-10 px-3 pt-[env(safe-area-inset-top)]">
      <div className="no-scrollbar pointer-events-auto flex items-center gap-1.5 overflow-x-auto py-1">
        <button
          type="button"
          onClick={() => onSelectCategory('all')}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-md transition ${
            activeCategory === 'all'
              ? 'bg-emerald-800 text-white'
              : 'bg-white/90 text-slate-700 hover:bg-white'
          }`}
        >
          {t(lang, 'allCategories')}
        </button>

        <button
          type="button"
          onClick={onToggleTrails}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-md transition ${
            showTrails
              ? 'bg-amber-700 text-white'
              : 'bg-white/90 text-slate-600 hover:bg-white'
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
              className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-md transition ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'bg-white/90 text-slate-700 hover:bg-white'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{lang === 'en' ? cat.label_en : cat.label_it}</span>
              {count > 0 && (
                <span
                  className={`ml-0.5 rounded-full px-1.5 text-[10px] ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
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
