import React from 'react';

export const GeminiIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z"
      fill="url(#gemini_grad)"
    />
    <defs>
      <linearGradient id="gemini_grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4285F4" />
        <stop offset="0.5" stopColor="#9B51E0" />
        <stop offset="1" stopColor="#E91E63" />
      </linearGradient>
    </defs>
  </svg>
);

export const OpenRouterIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect width="24" height="24" rx="6" fill="#18181B" />
    <path
      d="M6 12L12 6L18 12L12 18L6 12Z"
      stroke="#FACC15"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="2" fill="#FACC15" />
  </svg>
);

export const InstagramBrandIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect width="24" height="24" rx="7" fill="url(#ig_grad)" />
    <rect x="5" y="5" width="14" height="14" rx="4" stroke="white" strokeWidth="2" />
    <circle cx="12" cy="12" r="3.5" stroke="white" strokeWidth="2" />
    <circle cx="16.5" cy="7.5" r="1" fill="white" />
    <defs>
      <linearGradient id="ig_grad" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FEE440" />
        <stop offset="0.3" stopColor="#F72585" />
        <stop offset="0.6" stopColor="#7209B7" />
        <stop offset="1" stopColor="#4CC9F0" />
      </linearGradient>
    </defs>
  </svg>
);
