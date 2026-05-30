import "./lib/polyfills";
import { createApp, watchEffect } from "vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import App from "./App.vue";
import { router } from "./router";
import { useIntentStore } from "@/stores/intent";
import { useAuthStore } from "@/stores/auth";
import "./style.css";

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

const app = createApp(App);
app.use(pinia);
app.use(router);
app.mount("#app");

/**
 * Cross-context bridge wiring:
 *   - In the extension side panel: receive `smartholdem:dispatch` from the
 *     background service worker and translate it into a pending intent
 *     (connect / sign / swap deep-link).
 *   - Mirror the active wallet address to `chrome.storage.local` so the
 *     background SW can serve the `getAccount` whitelist fast-path without
 *     blocking on the UI being open.
 *   - In the dev preview: expose `window.__sthDev*()` console helpers.
 */
const intent = useIntentStore();
const auth = useAuthStore();

function applyIntent(method: string, params: any) {
  if (method === "requestSwap") {
    intent.setSwap({
      direction: params?.direction ?? "STH_TO_USDT",
      amount: params?.amount,
      destination: params?.destination,
      origin: params?.origin,
    });
    if (router.currentRoute.value.path !== "/swap") {
      router.push("/swap");
    }
  } else if (method === "signTransaction" || method === "sendTransaction") {
    // Same UI flow — AuthorizeTx modal renders either flavour based on the
    // `broadcast` flag (see PendingSignRequest in stores/intent.ts).
    //
    // `sendTransaction` is the one-shot convenience: sign + broadcast in
    // a single PIN entry. Resolves the dApp Promise with the node's
    // broadcast response augmented with `{ id, serialized, data }`.
    intent.setSign({
      id: params?.__id ?? Date.now(),
      payload: {
        recipient: params?.recipientId ?? params?.recipient,
        amount: params?.amount,
        vendorField: params?.vendorField,
        fee: params?.fee,
      },
      broadcast: method === "sendTransaction",
      origin: params?.origin,
    });
  } else if (method === "getAccount") {
    intent.setConnect({
      id: params?.__id ?? Date.now(),
      origin: params?.origin ?? "",
    });
  }
}

// Background-driven intents (real extension runtime).
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== "smartholdem:dispatch") return;
    const { id, method, params, origin } = msg.payload || {};
    // Forward the request id and origin so the modal can resolve through
    // UI_AUTHORIZE_COMPLETE with the correct key.
    applyIntent(method, { ...(params || {}), __id: id, origin });
  });
}

// Whitelist fast-path enabler: keep the active address mirrored to
// `chrome.storage.local.sthActiveAddress` so the background worker can
// resolve `getAccount` for trusted dApps without waking the UI.
// Also expose `lastUnlockedAt` for future session-bound policies.
if (typeof chrome !== "undefined" && chrome.storage?.local) {
  watchEffect(() => {
    const addr = auth.address;
    if (typeof addr === "string" && addr.length > 0) {
      chrome.storage.local.set({ sthActiveAddress: addr });
    }
  });
}

// Dev-mode simulators — trigger from the browser console.
(window as any).__sthDevDeepLink = (params: any) =>
  applyIntent("requestSwap", params || {});

(window as any).__sthDevSignTx = (params: any) =>
  applyIntent("signTransaction", { __id: Date.now(), ...(params || {}) });

(window as any).__sthDevSendTx = (params: any) =>
  applyIntent("sendTransaction", { __id: Date.now(), ...(params || {}) });

(window as any).__sthDevConnect = (params: any) =>
  applyIntent("getAccount", {
    __id: Date.now(),
    origin: params?.origin ?? "https://example.com",
  });
