import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_ENCODING_MODE,
  ENCODING_MODES,
  type EncodingMode,
} from "../utils/palette";

// Shared across views so the Plan overview and the Layout map stay in sync
// while the user compares visual encodings.
const KEY = "mccs_encoding_mode_v1";
const CHANGE_EVENT = "mccs:encoding-mode-change";

const VALID = new Set(ENCODING_MODES.map(m => m.value));

function load(): EncodingMode {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw && VALID.has(raw as EncodingMode)) return raw as EncodingMode;
  } catch {
    // ignore
  }
  return DEFAULT_ENCODING_MODE;
}

function save(mode: EncodingMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function useEncodingMode() {
  const [mode, setModeState] = useState<EncodingMode>(load);

  useEffect(() => {
    const refresh = () => setModeState(load());
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const setMode = useCallback((next: EncodingMode) => {
    setModeState(next);
    save(next);
  }, []);

  return { mode, setMode };
}
