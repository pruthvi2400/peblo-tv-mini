// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import { useQuery } from '@tanstack/react-query';
import { Hero } from '../components/Hero';
import { SectionRow } from '../components/SectionRow';
import { getCatalog } from '../api/client';
import type { Catalog } from '../types/catalog';

export function HomePage() {
  const { data, isLoading, error } = useQuery<Catalog, Error>({
    queryKey: ["catalog"],
    queryFn: getCatalog,
  });

  if (isLoading) {
    return (
      <div className="loading-state" data-testid="home-loading">
        <div className="spinner"></div>
        <span className="loading-state__text">Loading catalogue...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="error-state" data-testid="home-error">
        <h2 className="error-state__title">Something went wrong</h2>
        <p className="error-state__message">Failed to load catalogue. Please try again later.</p>
      </div>
    );
  }
  if (!data) return null;
  if (data.sections.length === 0) {
    return (
      <div className="empty-state" data-testid="home-empty">
        <h2 className="empty-state__title">No content available</h2>
        <p className="empty-state__message">Check back later for new shows and episodes.</p>
      </div>
    );
  }

  return (
    <div className="home-page" data-testid="home-page">
      <Hero sections={data.sections} />
      {data.sections.filter((s) => s.key !== "featured").map((section) => (
        <SectionRow key={section.key} section={section} />
      ))}
    </div>
  );
}
