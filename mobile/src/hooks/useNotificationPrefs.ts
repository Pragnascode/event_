import { useCallback, useEffect, useState } from "react";

type Prefs = {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
};

const MEMORY_PREFS: Prefs = {
  soundEnabled: true,
  vibrationEnabled: true,
};

const STORAGE_KEY = "event.notificationPrefs";

async function readPersistedPrefs(): Promise<Prefs> {
  try {
    const mod = await import("@react-native-async-storage/async-storage");
    const raw = await mod.default.getItem(STORAGE_KEY);
    if (!raw) return MEMORY_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      soundEnabled: parsed.soundEnabled ?? true,
      vibrationEnabled: parsed.vibrationEnabled ?? true,
    };
  } catch {
    return MEMORY_PREFS;
  }
}

async function persistPrefs(next: Prefs) {
  MEMORY_PREFS.soundEnabled = next.soundEnabled;
  MEMORY_PREFS.vibrationEnabled = next.vibrationEnabled;
  try {
    const mod = await import("@react-native-async-storage/async-storage");
    await mod.default.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // AsyncStorage may not be installed in all setups; in-memory fallback still works.
  }
}

export function useNotificationPrefs() {
  const [prefs, setPrefs] = useState<Prefs>(MEMORY_PREFS);
  const [loadingPrefs, setLoadingPrefs] = useState(true);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const loaded = await readPersistedPrefs();
      if (!mounted) return;
      MEMORY_PREFS.soundEnabled = loaded.soundEnabled;
      MEMORY_PREFS.vibrationEnabled = loaded.vibrationEnabled;
      setPrefs(loaded);
      setLoadingPrefs(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setSoundEnabled = useCallback(async (enabled: boolean) => {
    const next = { ...MEMORY_PREFS, soundEnabled: enabled };
    setPrefs(next);
    await persistPrefs(next);
  }, []);

  const setVibrationEnabled = useCallback(async (enabled: boolean) => {
    const next = { ...MEMORY_PREFS, vibrationEnabled: enabled };
    setPrefs(next);
    await persistPrefs(next);
  }, []);

  return {
    soundEnabled: prefs.soundEnabled,
    vibrationEnabled: prefs.vibrationEnabled,
    setSoundEnabled,
    setVibrationEnabled,
    loadingPrefs,
  };
}
