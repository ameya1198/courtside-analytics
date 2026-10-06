import { useSyncExternalStore } from "react";

// The page being opened while its query runs, or null when nothing is loading.
// Links start it, the route change ends it. Shared by the progress bar and the loading overlay.
let pending: string | null = null;
const listeners = new Set<() => void>();
let safety: ReturnType<typeof setTimeout> | undefined;

function set(next: string | null) {
  if (next === pending) return;
  pending = next;
  clearTimeout(safety);
  // A failed navigation never changes the route, so give up after 20 seconds instead of spinning forever
  if (next) safety = setTimeout(() => set(null), 20_000);
  listeners.forEach((l) => l());
}

export const startNav = (path: string) => set(path);
export const endNav = () => set(null);

export function useNavPending() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => pending,
    () => null,
  );
}
