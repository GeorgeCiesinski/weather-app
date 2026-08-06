/**
 * Provides TanStack Query's client (cache + request coordination) to the app.
 *
 * One cache for all useQuery / useMutation hooks.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { ReactNode } from 'react';

// Module-level client: one instance for the app lifetime. Contains cache and fetch/retry policy.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 120_000, // data fresh for 120s; fewer automatic refetches
      retry: 1, // One retry on failure
    },
  },
});

type QueryProviderProps = {
  children: ReactNode;
};

/**
 * Wraps the tree in QueryClientProvider and mounts Devtools in development.
 *
 * @param children - App tree that may call useQuery / useMutation.
 */
export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
