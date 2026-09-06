// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AppRouter } from './routes/AppRouter';
import { queryClient } from './queryClient';

export interface AppProps {
  client?: QueryClient;
}

export function App({ client }: AppProps = {}) {
  const qc = client ?? queryClient;
  return (
    <QueryClientProvider client={qc}>
      <AppRouter />
    </QueryClientProvider>
  );
}
