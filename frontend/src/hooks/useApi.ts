import { useState, useEffect, useCallback } from 'react';

export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options: { immediate?: boolean } = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line

  useEffect(() => {
    if (options.immediate !== false) fetch();
  }, [fetch]); // eslint-disable-line

  return { data, loading, error, refetch: fetch };
}
