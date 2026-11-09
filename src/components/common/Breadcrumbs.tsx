import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbsProps {
  items: Array<{ label: string; href?: string; onClick?: () => void }>;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav className="flex items-center space-x-1.5 text-xs text-stone-500 py-3" aria-label="Breadcrumbs">
      <button
        type="button"
        onClick={items[0]?.onClick}
        className="hover:text-[#0A6C74] flex items-center transition-colors"
      >
        <Home className="w-3.5 h-3.5 mr-1 text-stone-400" />
        <span>Home</span>
      </button>

      {items.slice(1).map((item, index) => {
        const isLast = index === items.length - 2;
        return (
          <React.Fragment key={index}>
            <ChevronRight className="w-3 h-3 text-stone-300 shrink-0" />
            {isLast ? (
              <span className="font-semibold text-[#0E1B2A] truncate max-w-[200px] sm:max-w-md">
                {item.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={item.onClick}
                className="hover:text-[#0A6C74] transition-colors whitespace-nowrap"
              >
                {item.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
