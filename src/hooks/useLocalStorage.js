import { useState, useEffect } from 'react';

export default function useLocalStorage(key, initialValue, normalize) {
  const [value, setValue] = useState(() => {
    let stored;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) stored = JSON.parse(raw);
    } catch (error) {
      console.warn('Could not read from localStorage', error);
    }

    const base =
      stored !== undefined
        ? stored
        : typeof initialValue === 'function'
          ? initialValue()
          : initialValue;

    // Normalizing on read means partially written or hand-edited values are
    // completed against the defaults instead of surfacing as missing fields.
    return typeof normalize === 'function' ? normalize(base) : base;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Could not write to localStorage', error);
    }
  }, [key, value]);

  return [value, setValue];
}
