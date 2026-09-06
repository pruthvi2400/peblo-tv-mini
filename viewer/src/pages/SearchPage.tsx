// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import { useState } from 'react';
import { useSearch } from '../hooks/useSearch';
import { SearchFilters } from '../components/SearchFilters';
import { ShowCard } from '../components/ShowCard';
import type { CatalogShow } from '../types/catalog';

export function SearchPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const { data, isLoading, error } = useSearch({
    q: search || null,
    category: selectedCategory || null,
  });

  if (isLoading) return <div data-testid="search-loading">Loading...</div>;
  if (error) return <div data-testid="search-error">Error: {error.message}</div>;

  return (
    <div className="search-page" data-testid="search-page">
      <h1>Search</h1>
      <input
        type="text"
        placeholder="Search shows..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="search-input"
        data-testid="search-input"
      />
      <SearchFilters
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />
      <div className="search-results" data-testid="search-results">
        {data?.results.map((show: CatalogShow) => (
          <ShowCard key={show.slug} show={show} />
        ))}
      </div>
    </div>
  );
}
