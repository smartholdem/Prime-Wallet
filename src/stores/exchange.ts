import { defineStore } from "pinia";
import axios from "axios";

/**
 * Exchange store — adapted from smartholdem/wallet-pro src/stores/exchange.ts.
 * Used here primarily for STH/USDT price discovery on the Dashboard.
 * Full module is kept so the extension can later host the on-chain swap UX.
 */
const EXCHANGE_API_URL = "https://exchange.smartholdem.io";

// Bridge economics (mirror wallet-pro ExchangeModal.vue).
export const SWAP_FEE_PCT = 0.54;       // 0.54 % transaction fee
export const SWAP_SLIPPAGE_PCT = 5.0;   // 5 % min-guaranteed safety margin
export const MIN_SWAP_USDT = 5.0;       // bridge will not process under 5 USDT

export const useExchangeStore = defineStore("exchange", {
  state: () => ({
    sthUsdtPrice: 0,
    isExchangeAvailable: false,
    error: null as string | null,
    lastFetchedAt: 0,
    realPrice: 0,
    calculatedBuyAmount: 0,
    calculatedReceiveUsdtAmount: 0,
    calculatedUsdtAmountForBuy: 0,
    exchangeSthBalance: 0,
    exchangeUsdtBalance: 0,
    gateAddressSth: null as { address: string; timestamp: number } | null,
    sthAddressHot: null as { address: string; timestamp: number } | null,
    depositAddress: null as string | null,
    // Per-account BSC/BEP20 deposit address cache.
    bscDepositCache: {} as Record<string, { address: string; timestamp: number }>,
    loadingBscDeposit: false,
  }),
  actions: {
    async checkExchangeAvailability() {
      try {
        const res = await axios.get(`${EXCHANGE_API_URL}/`, { timeout: 6000 });
        this.isExchangeAvailable = res.data === true;
      } catch {
        this.isExchangeAvailable = false;
      }
      return this.isExchangeAvailable;
    },
    async fetchSthUsdtPrice() {
      try {
        const res = await axios.get(`${EXCHANGE_API_URL}/xbts/pool/sth-usdt`, {
          timeout: 6000,
        });
        if (res.data && res.data.price) {
          this.sthUsdtPrice = parseFloat(res.data.price);
          this.error = null;
          this.lastFetchedAt = Date.now();
        } else {
          this.error = "exchange_error_invalid_response";
        }
      } catch (e) {
        this.error = "Failed to fetch STH/USDT price";
      }
    },
    async checkExchangeBalance() {
      try {
        const res = await axios.get(
          `${EXCHANGE_API_URL}/xbts/smartholdem-balances`,
          { timeout: 6000 }
        );
        if (res.data?.STH !== undefined && res.data?.USDT !== undefined) {
          this.exchangeSthBalance = res.data.STH;
          this.exchangeUsdtBalance = res.data.USDT;
        }
      } catch {
        this.exchangeSthBalance = 0;
        this.exchangeUsdtBalance = 0;
      }
    },
    /** Refreshes everything needed for the dashboard price card. */
    async refreshDashboardPrice() {
      const ok = await this.checkExchangeAvailability();
      if (ok) await this.fetchSthUsdtPrice();
    },
    async getSthAddressHot() {
      const now = Date.now();
      const ten = 10 * 24 * 60 * 60 * 1000;
      if (this.sthAddressHot && now - this.sthAddressHot.timestamp < ten) return;
      try {
        const res = await axios.get(`${EXCHANGE_API_URL}/xbts/sth_address_hot`);
        if (res.data?.address) {
          this.sthAddressHot = { address: res.data.address, timestamp: now };
        }
      } catch {
        this.sthAddressHot = null;
      }
    },
    async getSellGateAddress() {
      const now = Date.now();
      const ten = 10 * 24 * 60 * 60 * 1000;
      if (this.gateAddressSth && now - this.gateAddressSth.timestamp < ten) return;
      try {
        const res = await axios.get(`${EXCHANGE_API_URL}/sell-sth-address-gate`);
        if (res.data?.address) {
          this.gateAddressSth = { address: res.data.address, timestamp: now };
        }
      } catch {
        this.gateAddressSth = null;
      }
    },

    /**
     * Polls the exchange for the settlement state of a given STH transaction.
     * The endpoint is best-effort: we try a couple of conventional paths and
     * return `"unknown"` if none respond positively. The caller decides whether
     * to keep polling.
     */
    /**
     * Production BSC/BEP20 deposit-address lookup.
     *
     * Matches the wallet-pro gateway contract:
     *   GET https://exchange.smartholdem.io/exchange-address/bsc/{stiAddress}
     * Response: { address: "0x…", type: "sth", v: 2 }
     *
     * @param sthAddress  Active STH address (the `userId` for the gateway).
     * @param force       Bypass cache and hit the production HTTP endpoint.
     */
    async getBscDepositAddress(
      sthAddress: string,
      force = false
    ): Promise<string | null> {
      if (!sthAddress) return null;
      const cached = this.bscDepositCache[sthAddress];
      const tenMin = 10 * 60 * 1000;
      if (!force && cached && Date.now() - cached.timestamp < tenMin) {
        return cached.address;
      }
      this.loadingBscDeposit = true;
      try {
        const url = `${EXCHANGE_API_URL}/exchange-address/bsc/${sthAddress}`;
        const res = await axios.get(url, {
          timeout: 8000,
          headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        });
        const addr: string | undefined = res.data?.address;
        if (typeof addr === "string" && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
          this.bscDepositCache[sthAddress] = {
            address: addr,
            timestamp: Date.now(),
          };
          return addr;
        }
        // Invalid payload — drop any stale cached entry so the UI shows the retry state.
        delete this.bscDepositCache[sthAddress];
        return null;
      } catch {
        delete this.bscDepositCache[sthAddress];
        return null;
      } finally {
        this.loadingBscDeposit = false;
      }
    },

    async fetchOrderStatus(txid: string): Promise<"settled" | "pending" | "unknown"> {
      const candidates = [
        `${EXCHANGE_API_URL}/xbts/order/${txid}`,
        `${EXCHANGE_API_URL}/order/sth/${txid}`,
      ];
      for (const url of candidates) {
        try {
          const res = await axios.get(url, {
            timeout: 6000,
            validateStatus: (s) => s < 500,
          });
          if (res.status >= 200 && res.status < 300 && res.data) {
            const state =
              res.data.state ?? res.data.status ?? res.data.bridge ?? "";
            const settled =
              res.data.settled === true ||
              /^(settled|filled|completed|done)$/i.test(String(state));
            if (settled) return "settled";
            return "pending";
          }
        } catch {
          // try next endpoint
        }
      }
      return "unknown";
    },
  },
});
