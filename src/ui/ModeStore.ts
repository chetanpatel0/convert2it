import { signal } from "@preact/signals";

const STORAGE_KEY = "mode";

export enum ModeEnum {
  Simple,
  Advanced,
}

export const enum ModeText {
  Simple = "Simple mode",
  Advanced = "Advanced mode",
}

function getInitialMode(): ModeEnum {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Advanced mode is the default for fresh installs.
    if (stored === null) return ModeEnum.Advanced;
    return stored === String(ModeEnum.Advanced) ? ModeEnum.Advanced : ModeEnum.Simple;
  } catch {
    return ModeEnum.Advanced;
  }
}

export const Mode = signal<ModeEnum>(getInitialMode());

Mode.subscribe((value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value.toString());
  } catch {}
});

export function toggleMode() {
  Mode.value = Mode.value === ModeEnum.Advanced ? ModeEnum.Simple : ModeEnum.Advanced;
}
