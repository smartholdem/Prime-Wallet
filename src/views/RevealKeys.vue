<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { copyToClipboard, pushToast } from "@/lib/utils";
import PinPad from "@/components/PinPad.vue";
import BottomDock from "@/components/BottomDock.vue";

const router = useRouter();
const auth = useAuthStore();

const pin = ref("");
const error = ref(false);
const secret = ref<string | null>(null);

function onComplete(v: string) {
  if (auth.verify(v)) {
    // briefly use pin to decrypt
    const saved = auth["_pin"];
    auth["_pin"] = v;
    const plain = auth.decryptSecret();
    if (!saved) auth["_pin"] = ""; // re-lock if it was locked
    else auth["_pin"] = saved;

    if (plain) {
      secret.value = plain;
    } else {
      error.value = true;
      setTimeout(() => {
        pin.value = "";
        error.value = false;
      }, 600);
      pushToast("Wrong PIN", "error");
    }
  } else {
    error.value = true;
    setTimeout(() => {
      pin.value = "";
      error.value = false;
    }, 600);
    pushToast("Wrong PIN", "error");
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0" data-testid="reveal-keys-view">
    <header
      class="flex items-center justify-between px-4 py-3 border-b border-gunmetal-400 bg-gunmetal-800"
    >
      <button
        @click="router.back()"
        class="text-[11px] uppercase tracking-[0.18em] text-gunmetal-300 hover:text-bone"
        data-testid="back-btn"
      >
        ← Back
      </button>
      <span class="text-[10px] uppercase tracking-[0.3em] text-bone font-semibold">
        Reveal Seed
      </span>
      <span class="w-12" />
    </header>

    <div class="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
      <template v-if="!secret">
        <p class="text-xs text-gunmetal-300 leading-relaxed">
          Re-enter your PIN to decrypt and reveal your seed phrase.
          <span class="text-rust">Never share it.</span>
        </p>
        <div class="mt-4">
          <PinPad v-model="pin" :length="6" :error="error" @complete="onComplete" />
        </div>
      </template>

      <template v-else>
        <div class="forge-card p-3 border-rust/40">
          <p class="text-[11px] text-rust uppercase tracking-[0.18em] font-semibold">
            ⚠ Sensitive
          </p>
          <p class="mono text-sm text-bone mt-2 leading-relaxed break-words">
            {{ secret }}
          </p>
        </div>
        <button
          @click="copyToClipboard(secret, 'Secret copied — clear clipboard quickly')"
          class="forge-btn-cyan h-11 mt-2"
          data-testid="copy-secret-btn"
        >
          Copy seed
        </button>
        <button @click="router.back()" class="forge-btn h-11" data-testid="done-btn">
          Done
        </button>
      </template>
    </div>

    <BottomDock />
  </div>
</template>
