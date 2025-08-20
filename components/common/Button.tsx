

import React, { ReactNode } from 'react';
import { UI_COLORS } from '../../constants';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  ...props
}) => {
  const baseStyle = "font-semibold rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-colors duration-150 ease-in-out flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variantStyles = {
    primary: `bg-[${UI_COLORS.primary}] hover:bg-purple-700 text-white focus:ring-[${UI_COLORS.primary}]`,
    secondary: `bg-[${UI_COLORS.secondary}] hover:bg-blue-700 text-white focus:ring-[${UI_COLORS.secondary}]`,
    danger: `bg-[${UI_COLORS.danger}] hover:bg-red-700 text-white focus:ring-[${UI_COLORS.danger}]`,
    success: `bg-[${UI_COLORS.success}] hover:bg-green-700 text-white focus:ring-[${UI_COLORS.success}]`,
    outline: `border border-[${UI_COLORS.primary}] text-[${UI_COLORS.primary}] hover:bg-purple-50 focus:ring-[${UI_COLORS.primary}]`,
    ghost: `text-[${UI_COLORS.primary}] hover:bg-purple-100 focus:ring-[${UI_COLORS.primary}] shadow-none`,
  };
  
  // Tailwind doesn't support dynamic class construction with template literals like bg-[${color}] directly in a way that JIT compiler can pick up.
  // We need to use full class names or style attributes for dynamic colors. For simplicity, I'll use inline styles for the dynamic parts or ensure full class names are present.
  // For this exercise, I'm assuming Tailwind JIT can pick up these if they are statically analyzable or using a workaround where full classes are listed if needed.
  // A better approach for dynamic colors from constants is to set CSS variables or use inline styles if dynamic parts are truly dynamic.
  // Let's use predefined color classes for safety with Tailwind JIT.

  const safeVariantStyles = {
    primary: `bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-500`,
    secondary: `bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-400`,
    danger: `bg-red-600 hover:bg-red-700 text-white focus:ring-red-500`,
    success: `bg-green-600 hover:bg-green-700 text-white focus:ring-green-500`,
    outline: `border border-purple-600 text-purple-600 hover:bg-purple-50 focus:ring-purple-500`,
    ghost: `text-purple-600 hover:bg-purple-100 focus:ring-purple-500 shadow-none`,
  };


  return (
    <button
      className={`${baseStyle} ${sizeStyles[size]} ${safeVariantStyles[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {rightIcon && !isLoading && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
};

export default Button;