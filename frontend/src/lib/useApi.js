import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/**
 * Load data from a GET endpoint.
 *
 *   const { data, loading, error, reload } = useApi('/farms');
 *   const { data } = useApi('/analyses', { page, outcome });   // refetches when the query changes
 *   const { data } = useApi(farmId ? '/weather/forecast' : null, { farmId });   // null path = skip
 *
 * A request that is overtaken by a newer one is aborted, so slow responses can never
 * overwrite fresh data.
 */
export function useApi(path, query) {
  const [state, setState] = useState({ data: null, loading: Boolean(path), error: null });
  const key = path ? `${path}?${JSON.stringify(query || {})}` : null;
  const queryRef = useRef(query);
  queryRef.current = query;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!key) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .get(path, queryRef.current, { signal: controller.signal })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ data: null, loading: false, error });
      });
    return () => controller.abort();
    // `key` captures both path and query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
