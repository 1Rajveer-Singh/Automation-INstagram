import React from 'react';
import { LucideIcon } from 'lucide-react';

interface CandyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'pink' | 'yellow' | 'mint' | 'danger';
  icon?: LucideIcon;
  iconBgColor?: string;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const CandyButton: React.FC<CandyButtonProps> = ({
  variant = 'primary',
  icon: Icon,
  iconBgColor,
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}) => {
  let variantStyles = 'bg-violetBrand text-white hover:bg-violet-600';
  let defaultIconBg = 'bg-white text-slateDark';

  if (variant === 'secondary') {
    variantStyles = 'bg-white text-slateDark border-2 border-slateDark hover:bg-yellowPop hover:text-slateDark';
    defaultIconBg = 'bg-slateDark text-white';
  } else if (variant === 'pink') {
    variantStyles = 'bg-pinkPop text-slateDark hover:bg-pink-400';
    defaultIconBg = 'bg-white text-slateDark';
  } else if (variant === 'yellow') {
    variantStyles = 'bg-yellowPop text-slateDark hover:bg-yellow-400';
    defaultIconBg = 'bg-slateDark text-white';
  } else if (variant === 'mint') {
    variantStyles = 'bg-mintPop text-slateDark hover:bg-emerald-400';
    defaultIconBg = 'bg-white text-slateDark';
  } else if (variant === 'danger') {
    variantStyles = 'bg-rose-500 text-white hover:bg-rose-600';
    defaultIconBg = 'bg-white text-rose-600';
  }

  let sizeStyles = 'px-5 py-2.5 text-base';
  let iconSize = 18;
  let circleSize = 'w-7 h-7';

  if (size === 'sm') {
    sizeStyles = 'px-3.5 py-1.5 text-sm';
    iconSize = 14;
    circleSize = 'w-5 h-5';
  } else if (size === 'lg') {
    sizeStyles = 'px-7 py-3.5 text-lg';
    iconSize = 22;
    circleSize = 'w-9 h-9';
  }

  return (
    <button
      disabled={disabled}
      className={`candy-btn ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    >
      <span className="flex items-center gap-2.5">
        {children}
        {Icon && (
          <span
            className={`inline-flex items-center justify-center rounded-full ${
              iconBgColor || defaultIconBg
            } ${circleSize} transition-transform duration-200 group-hover:scale-110 shadow-sm border border-slateDark/20`}
          >
            <Icon size={iconSize} strokeWidth={2.5} />
          </span>
        )}
      </span>
    </button>
  );
};
