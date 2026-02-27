import type { ButtonHTMLAttributes, ReactNode } from 'react';

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function PrimaryButton({ children, ...props }: PrimaryButtonProps) {
  return (
    <button
      {...props}
      style={{
        border: '1px solid #1f2937',
        background: '#111827',
        color: '#f9fafb',
        borderRadius: 8,
        padding: '10px 14px',
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  );
}
