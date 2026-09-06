// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import { useQuery } from '@tanstack/react-query';
import { Hero } from '../components/Hero';
import { SectionRow } from '../components/SectionRow';
import { getCatalog } from '../api/client';
import type { Catalog } from '../types/catalog';

export function HomePage() {
  const { data, isLoading, error } = useQuery<Catalog, Error>({
    queryKey: ['catalog'],
    queryFn: getCatalog,
  });

  if (isLoading) return <div data-testid="home-loading">Loading...</div>;
  if (error) return <div data-testid="home-error">Error: {error.message}</div>;
  if (!data) return null;

  return (
    <div className="home-page" data-testid="home-page">
      <Hero sections={data.sections} />
      {data.sections.filter((s) => s.key !== 'featured').map((section) => (
        <SectionRow key={section.key} section={section} />
      ))}
    </div>
  );
}
