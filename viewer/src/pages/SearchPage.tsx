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

  if (isLoading) {
    return (
      <div className="loading-state" data-testid="search-loading">
        <div className="spinner"></div>
        <span className="loading-state__text">Searching...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="error-state" data-testid="search-error">
        <h2 className="error-state__title">Search error</h2>
        <p className="error-state__message">{error.message}</p>
      </div>
    );
  }

  const hasNoResults = data && data.results.length === 0;
  const hasSearchQuery = search || selectedCategory || selectedLanguage || selectedSection;

  return (
    <div className="search-page" data-testid="search-page">
      <div className="search-header">
        <h1 className="search-title">Discover</h1>
        <p className="search-subtitle">Find something to watch</p>
        <div className="search-controls">
          <div className="search-controls-row">
            <div className="search-field search-field--grow">
              <label htmlFor="search-q" className="search-field-label">Search</label>
              <div className="search-input-wrapper">
                <svg className="search-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  id="search-q"
                  type="text"
                  placeholder="Search titles..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="search-input"
                  data-testid="search-input-q"
                />
              </div>
            </div>
            <SearchFilters
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
          </div>
        </div>
      </div>
      
      {hasNoResults ? (
        <div className="search-empty" data-testid="search-empty">
          <div className="search-empty__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h2 className="search-empty__title">No results found</h2>
          <p className="search-empty__message">Try adjusting your search or filters</p>
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
        <>
          {data && hasSearchQuery && (
            <p className="search-results-count" data-testid="search-count">
              <strong>{data.count}</strong> result{data?.count !== 1 ? 's' : ''} found
            </p>
          )}
          <div className="search-results" data-testid="search-results">
            {data?.results.map((show: CatalogShow) => (
              <ShowCard key={show.slug} show={show} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
