<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useWalletStore } from "@/stores/wallet";
import { useAuthStore } from "@/stores/auth";
import { copyToClipboard, pushToast } from "@/lib/utils";
import PinPad from "@/components/PinPad.vue";

const router = useRouter();
const wallet = useWalletStore();
const auth = useAuthStore();

const step = ref<1 | 2 | 3 | 4>(1);
const seed = ref<{ mnemonic: string; address: string } | null>(null);
const acknowledged = ref(false);
const pin = ref("");
const pinConfirm = ref("");
const pinError = ref(false);

function generate() {
  seed.value = wallet.createNew();
  step.value = 2;
}
generate();

const words = computed(() => (seed.value?.mnemonic ?? "").split(" "));

function gotoVerify() {
  if (!acknowledged.value) {
    pushToast("Confirm you saved the phrase", "error");
    return;
  }
  step.value = 3;
}

function onPinComplete(v: string) {
  if (step.value === 3) {
    step.value = 4;
    pinConfirm.value = "";
    return;
  }
  if (step.value === 4) {
    if (v !== pin.value) {
      pinError.value = true;
      setTimeout(() => {
        pinError.value = false;
        pinConfirm.value = "";
      }, 700);
      pushToast("PINs don't match", "error");
      return;
    }
    finalize();
  }
}

function finalize() {
  if (!seed.value) return;
  auth.saveWallet(seed.value.address, seed.value.mnemonic, pin.value);
  pushToast("Wallet forged", "success");
  router.replace("/dashboard");
}
</script>

<template>
  <div class="flex-1 flex flex-col px-5 py-5 overflow-y-auto" data-testid="create-wallet-view">
    <!-- header -->
    <div class="flex items-center justify-between mb-5">
      <button
        @click="router.back()"
        class="text-[11px] uppercase tracking-[0.18em] text-gunmetal-300 hover:text-bone"
        data-testid="back-btn"
      >
        ← Back
      </button>
      <span class="text-[10px] uppercase tracking-[0.3em] text-gunmetal-300">
        Step {{ step }} / 4
      </span>
    </div>

    <!-- Step 1/2: Seed phrase -->
    <template v-if="step === 2 && seed">
      <h2 class="text-xl font-semibold text-bone leading-tight">Your seed phrase</h2>
      <p class="text-xs text-gunmetal-300 mt-1.5 leading-relaxed">
        12 words. Write them down. <span class="text-rust">Anyone with this phrase owns your STH.</span>
      </p>

      <div class="forge-card mt-4 p-3" data-testid="seed-phrase-grid">
        <div class="grid grid-cols-3 gap-1.5">
          <div
            v-for="(w, i) in words"
            :key="i"
            class="flex items-baseline gap-1.5 px-2 py-1.5 rounded border border-gunmetal-400 bg-gunmetal-700"
          >
            <span class="text-[9px] text-gunmetal-300 mono w-3 text-right">{{ i + 1 }}</span>
            <span class="mono text-sm text-bone">{{ w }}</span>
          </div>
        </div>
      </div>

      <button
        @click="copyToClipboard(seed.mnemonic, 'Seed copied — clear clipboard quickly')"
        class="mt-3 forge-btn-cyan h-10 text-xs"
        data-testid="copy-seed-btn"
      >
        Copy seed
      </button>

      <div class="mt-4 p-3 rounded border border-rust/40 bg-rust/5 text-[11px] text-rust leading-relaxed">
        ⚠ Never share. Never screenshot. Store offline.
      </div>

      <label
        class="mt-4 flex items-start gap-2.5 text-xs text-bone cursor-pointer"
        data-testid="ack-label"
      >
        <input
          type="checkbox"
          v-model="acknowledged"
          class="mt-0.5 accent-cyan-volt"
          data-testid="ack-checkbox"
        />
        <span>I've stored my seed phrase in a safe place.</span>
      </label>

      <div class="mt-auto pt-5">
        <button
          @click="gotoVerify"
          :disabled="!acknowledged"
          class="forge-btn-primary w-full h-12 disabled:opacity-40"
          data-testid="seed-continue-btn"
        >
          Continue to PIN
        </button>
      </div>
    </template>

    <!-- Step 3: Set PIN -->
    <template v-else-if="step === 3">
      <h2 class="text-xl font-semibold text-bone leading-tight">Set a 6-digit PIN</h2>
      <p class="text-xs text-gunmetal-300 mt-1.5">
        Unlocks the lockbox each session. Encrypts your seed locally.
      </p>
      <div class="mt-6">
        <PinPad v-model="pin" :length="6" @complete="onPinComplete" />
      </div>
    </template>

    <!-- Step 4: Confirm PIN -->
    <template v-else-if="step === 4">
      <h2 class="text-xl font-semibold text-bone leading-tight">Confirm your PIN</h2>
      <p class="text-xs text-gunmetal-300 mt-1.5">Enter the same 6 digits again.</p>
      <div class="mt-6">
        <PinPad v-model="pinConfirm" :length="6" :error="pinError" @complete="onPinComplete" />
      </div>
    </template>
  </div>
</template>
