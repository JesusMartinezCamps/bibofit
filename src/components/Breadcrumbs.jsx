import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils'; // Import cn utility

const Breadcrumbs = ({ items, shouldRemovePadding }) => (
  <nav aria-label="Breadcrumb" className={cn("flex items-center space-x-1 text-sm text-gray-400 mt-4", shouldRemovePadding ? "px-4 pt-0" : "px-4 sm:px-6 pt-0")}>
    {items.map((item, index) => (
      <React.Fragment key={index}>
        {index > 0 && <ChevronRight className="h-4 w-4 text-gray-500" />}
        {item.href ? (
          <Link to={item.href} className="py-1 rounded-md hover:bg-white/10 transition-colors">
            {item.label}
          </Link>
        ) : (
          <span className="font-semibold text-white py-1">{item.label}</span>
        )}
      </React.Fragment>
    ))}
  </nav>
);

export default Breadcrumbs;