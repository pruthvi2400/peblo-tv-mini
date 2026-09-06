// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSearch } from '../hooks/useSearch';
import { SearchFilters } from '../components/SearchFilters';
import { ShowCard } from '../components/ShowCard';
import type { CatalogShow } from '../types/catalog';

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedLanguage, setSelectedLanguage] = useState(searchParams.get('language') || '');
  const [selectedSection, setSelectedSection] = useState(searchParams.get('section') || '');

  // Sync state to URL when it changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedLanguage) params.set('language', selectedLanguage);
    if (selectedSection) params.set('section', selectedSection);
    setSearchParams(params, { replace: true });
  }, [search, selectedCategory, selectedLanguage, selectedSection, setSearchParams]);

  const { data, isLoading, error } = useSearch({
    q: search || null,
    category: selectedCategory || null,
    language: selectedLanguage || null,
    section: selectedSection || null,
  });

  const handleClear = () => {
    setSearch('');
    setSelectedCategory('');
    setSelectedLanguage('');
    setSelectedSection('');
  };

  if (isLoading) return <div data-testid="search-loading">Loading...</div>;
  if (error) return <div data-testid="search-error">Error: {error.message}</div>;

  const hasNoResults = data && data.results.length === 0;

  return (
    <div className="search-page" data-testid="search-page">
      <h1>Search</h1>
      <input
        type="text"
        placeholder="Search shows..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="search-input"
        data-testid="search-input-q"
      />
      <SearchFilters
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />
      {hasNoResults ? (
        <div className="search-empty" data-testid="search-empty">
          <p>No results found</p>
          <button
            type="button"
            onClick={handleClear}
            className="search-clear-button"
            data-testid="search-clear-button"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="search-results" data-testid="search-results">
          {data?.results.map((show: CatalogShow) => (
            <ShowCard key={show.slug} show={show} />
          ))}
        </div>
      )}
    </div>
  );
}
