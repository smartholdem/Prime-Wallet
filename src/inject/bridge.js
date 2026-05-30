/**
 * Isolated-world content script bridge.
 *
 * inject.js (MAIN world) exposes `window.smartholdem` to dApps and posts
 * messages to the page window. This bridge runs in the ISOLATED content-
 * script world, listens for those messages, forwards them to the extension
 * background service worker via `chrome.runtime.sendMessage`, and relays
 * the asynchronous response back to the page.
 *
 * Wire protocol:
 *   page   → bridge:  { source: "smartholdem-dapp",   id, method, params }
 *   bridge → bg:      { type: "smartholdem:request",  payload: {...} }
 *   bg     → bridge:  sendResponse({ id, result, error })   ← async (background returns `true`)
 *   bridge → page:    { source: "smartholdem-wallet", id, result, error }
 *
 * The background service worker keeps the message channel open (by returning
 * `true` from its listener) until the user approves/rejects the request in
 * the side-panel UI. That means the `sendResponse` callback below is the
 * sole source of truth for the dApp's Promise — there is no separate
 * runtime broadcast path to listen to.
 */
(function () {
  if (typeof window === "undefined") return;
  if (typeof chrome === "undefined" || !chrome.runtime) return;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "smartholdem-dapp") return;

    chrome.runtime.sendMessage(
      {
        type: "smartholdem:request",
        payload: {
          id: data.id,
          method: data.method,
          params: data.params,
          origin: window.location.origin,
        },
      },
      (response) => {
        // Background returned `true` ⇒ this callback fires once the side
        // panel resolves or rejects the request (or the 120 s timeout
        // expires). `response` is shaped `{ id, result, error }`.
        if (chrome.runtime.lastError) {
          // The service worker was suspended or the channel was closed
          // before the user acted — surface that to the dApp as an error.
          window.postMessage(
            {
              source: "smartholdem-wallet",
              id: data.id,
              error:
                chrome.runtime.lastError.message ||
                "smartholdem: channel closed before user action",
            },
            "*",
          );
          return;
        }
        if (!response || response.id !== data.id) return;
        window.postMessage(
          {
            source: "smartholdem-wallet",
            id: data.id,
            result: response.result,
            error: response.error,
          },
          "*",
        );
      },
    );
  });
})();
