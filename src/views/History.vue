<script setup lang="ts">
import { onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useWalletStore } from "@/stores/wallet";
import { useT } from "@/locales";
import TxRow from "@/components/TxRow.vue";
import BottomDock from "@/components/BottomDock.vue";

const router = useRouter();
const auth = useAuthStore();
const wallet = useWalletStore();
const t = useT();

function reload() {
  if (auth.address) wallet.fetchTransactions(auth.address, 50);
}
onMounted(reload);
watch(() => auth.activeIndex, reload);
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0" data-testid="history-view">
    <header
      class="flex items-center justify-between px-4 py-3 border-b border-gunmetal-400 bg-gunmetal-800"
    >
      <!-- Back arrow row — matches the Connected Apps screen layout. -->
      <button
        @click="router.push('/dashboard')"
        class="text-[11px] uppercase tracking-[0.18em] text-fiat hover:text-bone"
        data-testid="history-back-btn"
      >
        ← {{ t('top.back') }}
      </button>
      <span class="text-[10px] uppercase tracking-[0.3em] text-fiat font-semibold">
        Ledger
      </span>
      <button
        @click="reload"
        class="text-[10px] mono text-fiat hover:text-cyan-voltGlow"
        data-testid="refresh-tx-btn"
      >
        {{ wallet.loadingTxs ? "syncing…" : "↻" }}
      </button>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
      <div
        v-if="!wallet.transactions.length && !wallet.loadingTxs"
        class="forge-card p-6 text-center text-xs text-fiatDim"
        data-testid="history-empty"
      >
        No transactions yet for this account.
      </div>
      <TxRow v-for="t in wallet.transactions" :key="t.id" :tx="t" />
    </div>

    <BottomDock />
  </div>
</template>
