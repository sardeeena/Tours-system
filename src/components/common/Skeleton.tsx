import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rectangular' | 'circular' | 'badge' | 'button';
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  animation?: 'shimmer' | 'pulse' | 'wave' | 'none';
  staggerIndex?: number;
  className?: string;
}

/**
 * Premium Skeleton Primitive for Awesome Adventure Tours
 * - Supports synchronized shimmer, soft breathing pulse, and luxury Red Sea palette.
 * - Perfectly adapts to both Light and Dark themes with WCAG AA contrast.
 * - Hardware accelerated with 60fps/120fps CSS transforms.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  width,
  height,
  rounded,
  animation = 'shimmer',
  staggerIndex,
  className = '',
  style,
  ...props
}) => {
  // Determine border-radius based on variant or explicit prop
  let radiusClass = 'rounded-md';
  if (rounded) {
    radiusClass = {
      none: 'rounded-none',
      xs: 'rounded-xs',
      sm: 'rounded-sm',
      md: 'rounded-md',
      lg: 'rounded-lg',
      xl: 'rounded-xl',
      '2xl': 'rounded-2xl',
      full: 'rounded-full',
    }[rounded];
  } else if (variant === 'circular') {
    radiusClass = 'rounded-full';
  } else if (variant === 'badge' || variant === 'button') {
    radiusClass = 'rounded-xl';
  } else if (variant === 'text') {
    radiusClass = 'rounded-sm';
  }

  // Animation class
  let animationClass = '';
  if (animation === 'shimmer') {
    animationClass = 'animate-shimmer';
  } else if (animation === 'pulse') {
    animationClass = 'animate-skeleton-pulse';
  } else if (animation === 'wave') {
    animationClass = 'animate-shimmer animate-skeleton-pulse';
  }

  // Stagger delays for grid items (0.15s per index)
  const staggerClass = staggerIndex !== undefined ? `skeleton-delay-${(staggerIndex % 5) + 1}` : '';

  // Default heights based on variant if height not specified
  let defaultHeightClass = '';
  if (!height) {
    if (variant === 'text') defaultHeightClass = 'h-3.5';
    else if (variant === 'badge') defaultHeightClass = 'h-5';
    else if (variant === 'button') defaultHeightClass = 'h-10';
  }

  // Base background palette matching luxury stone in light mode and deep marine obsidian in dark mode
  const baseBgClass = 'bg-stone-200/80 dark:bg-slate-800/80';

  const inlineStyles: React.CSSProperties = {
    ...style,
    width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
  };

  return (
    <div
      role="status"
      aria-hidden="true"
      className={`relative overflow-hidden select-none shrink-0 ${baseBgClass} ${radiusClass} ${animationClass} ${staggerClass} ${defaultHeightClass} ${className}`}
      style={inlineStyles}
      {...props}
    />
  );
};

export default Skeleton;
