import { useEffect, useRef, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // When a value arrives from outside this hook (cloud sync adopting a newer
  // value, or another tab), we re-read and must NOT immediately write it back.
  const skipWrite = useRef(false);

  useEffect(() => {
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);

  // Re-read when cloud sync (or another tab) updates this key.
  useEffect(() => {
    const reread = () => {
      try {
        const raw = localStorage.getItem(key);
        skipWrite.current = true;
        setValue(raw ? (JSON.parse(raw) as T) : initialValue);
      } catch {
        /* ignore */
      }
    };
    const onCustom = () => reread();
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) reread();
    };
    window.addEventListener(`alfred.ls:${key}`, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(`alfred.ls:${key}`, onCustom);
      window.removeEventListener("storage", onStorage);
    };
    // initialValue intentionally excluded — only the key identifies the listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [value, setValue] as const;
}
