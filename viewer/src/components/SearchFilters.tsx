// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import type { ChangeEvent } from 'react';

interface SearchFiltersProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

export function SearchFilters({ selectedCategory, onCategoryChange }: SearchFiltersProps) {
  return (
    <div className="search-filters" data-testid="search-filters">
      <label htmlFor="category-filter" className="filter-label">Category:</label>
      <select
        id="category-filter"
        className="filter-select"
        value={selectedCategory}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onCategoryChange(e.target.value)}
        data-testid="category-select"
      >
        <option value="">All</option>
        <option value="adventure">Adventure</option>
        <option value="drama">Drama</option>
        <option value="folk">Folk</option>
        <option value="comedy">Comedy</option>
        <option value="action">Action</option>
      </select>
    </div>
  );
}
