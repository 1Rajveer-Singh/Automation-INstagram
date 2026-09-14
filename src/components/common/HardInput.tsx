import React from 'react';

interface HardInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  badge?: string;
}

export const HardInput: React.FC<HardInputProps> = ({
  label,
  error,
  helperText,
  badge,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor={inputId} className="font-heading text-xs font-bold uppercase tracking-wider text-slateDark flex items-center gap-1.5">
            {label}
          </label>
          {badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellowPop text-slateDark border border-slateDark">
              {badge}
            </span>
          )}
        </div>
      )}
      <input
        id={inputId}
        className={`hard-input ${error ? 'border-rose-500 focus:border-rose-500 focus:shadow-pop-pink' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs font-bold text-rose-500 mt-1">{error}</p>}
      {helperText && !error && <p className="text-xs text-slate-500 mt-1">{helperText}</p>}
    </div>
  );
};
