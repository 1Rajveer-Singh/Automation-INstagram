import React from 'react';

interface PatternBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export const PatternBackground: React.FC<PatternBackgroundProps> = ({ 
  children, 
  className = 'h-screen w-screen overflow-hidden' 
}) => {
  return (
    <div className={`relative bg-[#FFFDF8] text-slateDark ${className}`}>
      {/* Subtle neo-brutalist dot pattern */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: 'radial-gradient(#1E293B 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px'
        }}
      />
      <div className="relative z-10 w-full min-h-full">
        {children}
      </div>
    </div>
  );
};
