import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async loader when `deps` change. Returns { data, error, loading, reload, setData }.
 * Ignores results from stale requests.
 */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await run();
      if (id === seq.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id === seq.current) setState({ data: null, error, loading: false });
    }
  }, [run]);

  useEffect(() => { reload(); }, [reload]);

  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  return { ...state, reload, setData };
}

/** Debounces a changing value. */
export function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/** Simple form state with server-side error mapping. */
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const set = (name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
  };
  const bind = (name) => ({
    name,
    value: values[name] ?? '',
    onChange: (e) => set(name, e.target.type === 'checkbox' ? e.target.checked : e.target.value),
    error: errors[name],
  });

  async function submit(fn, validate) {
    setFormError('');
    if (validate) {
      const clientErrors = validate(values) || {};
      const has = Object.values(clientErrors).some(Boolean);
      setErrors(clientErrors);
      if (has) return undefined;
    }
    setSubmitting(true);
    try {
      return await fn(values);
    } catch (e) {
      setErrors(e.errors || {});
      setFormError(e.message || 'Something went wrong');
      return undefined;
    } finally {
      setSubmitting(false);
    }
  }

  return { values, setValues, set, bind, errors, setErrors, submitting, formError, setFormError, submit };
}
