import { reactive } from "vue";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

const state = reactive<{ items: Toast[] }>({ items: [] });
let _id = 0;

export function pushToast(text: string, kind: ToastKind = "info", ttl = 2400) {
  const id = ++_id;
  state.items.push({ id, text, kind });
  setTimeout(() => {
    const i = state.items.findIndex((t) => t.id === id);
    if (i >= 0) state.items.splice(i, 1);
  }, ttl);
}

export function useToasts() {
  return state;
}

export async function copyToClipboard(value: string, label = "Copied") {
  try {
    await navigator.clipboard.writeText(value);
    pushToast(label, "success");
  } catch {
    pushToast("Clipboard unavailable", "error");
  }
}

export function shortAddress(addr: string, lead = 6, trail = 6): string {
  if (!addr) return "";
  if (addr.length <= lead + trail + 3) return addr;
  return `${addr.slice(0, lead)}…${addr.slice(-trail)}`;
}

import { getActivePinia } from "pinia";

/**
 * Resolves the active BCP-47 locale tag from the settings store at runtime.
 * Reads from Pinia state map without creating an import-cycle with the store.
 * Falls back to "en-US" if Pinia isn't initialised yet.
 */
function currentLocaleTag(): string {
  try {
    const pinia = getActivePinia() as any;
    const locale = pinia?.state?.value?.appSettings?.locale;
    return locale === "ru" ? "ru-RU" : "en-US";
  } catch {
    return "en-US";
  }
}

export function formatSth(value: number | string | undefined, decimals = 4): string {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  if (!isFinite(n as number)) {
    return new Intl.NumberFormat(currentLocaleTag(), {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(0);
  }
  return new Intl.NumberFormat(currentLocaleTag(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n as number);
}

export function formatUsdt(value: number | undefined): string {
  const n = value ?? 0;
  return new Intl.NumberFormat(currentLocaleTag(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function timeAgo(timestampSec: number): string {
  const s = Math.floor(Date.now() / 1000) - timestampSec;
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
