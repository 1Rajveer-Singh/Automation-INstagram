import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StickerCardProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: 'pink' | 'yellow' | 'mint' | 'violet';
  icon?: LucideIcon;
  iconBgColor?: string;
  shadowColor?: 'dark' | 'pink' | 'yellow' | 'mint' | 'violet';
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export const StickerCard: React.FC<StickerCardProps> = ({
  title,
  subtitle,
  badge,
  badgeColor = 'yellow',
  icon: Icon,
  iconBgColor = 'bg-violetBrand text-white',
  shadowColor = 'dark',
  children,
  className = '',
  headerAction,
}) => {
  let shadowStyle = 'shadow-pop';
  if (shadowColor === 'pink') shadowStyle = 'shadow-pop-pink';
  if (shadowColor === 'yellow') shadowStyle = 'shadow-pop-yellow';
  if (shadowColor === 'mint') shadowStyle = 'shadow-pop-mint';
  if (shadowColor === 'violet') shadowStyle = 'shadow-pop-violet';

  let badgeBg = 'bg-yellowPop text-slateDark';
  if (badgeColor === 'pink') badgeBg = 'bg-pinkPop text-slateDark';
  if (badgeColor === 'mint') badgeBg = 'bg-mintPop text-slateDark';
  if (badgeColor === 'violet') badgeBg = 'bg-violetBrand text-white';

  return (
    <div
      className={`relative bg-white border-2 border-slateDark rounded-2xl p-4 sm:p-6 ${shadowStyle} transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1 hover:rotate-[-0.5deg] ${className}`}
    >
      {badge && (
        <span
          className={`absolute -top-3 right-4 sm:right-6 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-heading font-extrabold tracking-wide uppercase border-2 border-slateDark rounded-full shadow-pop-sm rotate-2 ${badgeBg}`}
        >
          {badge}
        </span>
      )}

      {(title || Icon || headerAction) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b-2 border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-slateDark flex items-center justify-center shadow-pop-sm shrink-0 ${iconBgColor}`}
              >
                <Icon size={18} className="sm:w-5 sm:h-5" strokeWidth={2.5} />
              </div>
            )}
            <div className="min-w-0">
              {title && <h3 className="font-heading text-base sm:text-xl font-bold text-slateDark leading-tight break-words">{title}</h3>}
              {subtitle && <p className="text-[11px] sm:text-xs font-medium text-slate-500 mt-0.5 break-words">{subtitle}</p>}
            </div>
          </div>
          {headerAction && <div className="shrink-0 w-full sm:w-auto flex items-center justify-start sm:justify-end">{headerAction}</div>}
        </div>
      )}

      {children}
    </div>
  );
};
