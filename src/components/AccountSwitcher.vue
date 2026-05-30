<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useWalletStore } from "@/stores/wallet";
import { copyToClipboard, shortAddress, formatSth, pushToast } from "@/lib/utils";

const auth = useAuthStore();
const wallet = useWalletStore();

const open = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);
const editingIndex = ref<number | null>(null);
const editValue = ref("");
const editInputRef = ref<HTMLInputElement | null>(null);

const accounts = computed(() => auth.accounts);
const active = computed(() => auth.activeAccount);

function toggle() {
  open.value = !open.value;
  if (open.value) {
    wallet.fetchAllBalances();
  } else {
    cancelEdit();
  }
}

function pick(idx: number) {
  if (editingIndex.value !== null) return;
  wallet.setActiveAccount(idx);
  open.value = false;
}

function addAccount() {
  try {
    const m = wallet.addAccount();
    pushToast(`${m.label} forged`, "success");
    open.value = false;
  } catch (e: any) {
    pushToast(e?.message || "Add failed", "error");
  }
}

function startEdit(idx: number, currentLabel: string, ev: Event) {
  ev.stopPropagation();
  editingIndex.value = idx;
  editValue.value = currentLabel;
  nextTick(() => {
    editInputRef.value?.focus();
    editInputRef.value?.select();
  });
}

function commitEdit(idx: number) {
  const label = editValue.value.trim().slice(0, 24);
  if (!label) {
    cancelEdit();
    return;
  }
  auth.renameAccount(idx, label);
  pushToast("Account renamed", "success");
  editingIndex.value = null;
  editValue.value = "";
}

function cancelEdit() {
  editingIndex.value = null;
  editValue.value = "";
}

function onEditKey(e: KeyboardEvent, idx: number) {
  if (e.key === "Enter") commitEdit(idx);
  else if (e.key === "Escape") cancelEdit();
}

function onDocClick(e: MouseEvent) {
  if (!dropdownRef.value) return;
  if (!dropdownRef.value.contains(e.target as Node)) {
    open.value = false;
    cancelEdit();
  }
}

onMounted(() => document.addEventListener("mousedown", onDocClick));
onBeforeUnmount(() => document.removeEventListener("mousedown", onDocClick));
</script>

<template>
  <div ref="dropdownRef" class="relative" data-testid="account-switcher">
    <button
      type="button"
      @click="toggle"
      class="w-full flex items-center justify-between px-3 py-2 rounded-md border border-gunmetal-400 bg-gunmetal-700 hover:border-indigo-forge/60 transition-colors"
      :class="{ 'border-indigo-forge/60 shadow-glowIndigo': open }"
      data-testid="account-switcher-toggle"
    >
      <div class="flex items-center gap-2 min-w-0">
        <span
          class="w-6 h-6 rounded grid place-items-center bg-indigo-forge/15 border border-indigo-forge/40 text-indigo-forgeBright text-[10px] font-bold mono flex-shrink-0"
        >
          {{ (active?.index ?? 0) + 1 }}
        </span>
        <div class="flex flex-col min-w-0 text-left">
          <span class="text-[10px] uppercase tracking-[0.18em] text-fiat font-semibold leading-none truncate">
            {{ active?.label }}
          </span>
          <span class="mono text-xs text-fiat truncate mt-0.5">
            {{ shortAddress(active?.address ?? "", 6, 6) }}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <button
          type="button"
          @click.stop="copyToClipboard(active?.address ?? '', 'Address copied')"
          class="w-7 h-7 grid place-items-center rounded text-fiatDim hover:text-cyan-voltGlow transition-colors"
          data-testid="account-copy-btn"
          title="Copy address"
        >
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="11" height="11" rx="1.5" />
            <path d="M5 15V5a1 1 0 0 1 1-1h10" />
          </svg>
        </button>
        <svg
          viewBox="0 0 24 24"
          class="w-3.5 h-3.5 text-fiatDim transition-transform"
          :class="{ 'rotate-180': open }"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </button>

    <transition name="dd">
      <div
        v-if="open"
        class="absolute left-0 right-0 top-full mt-1.5 z-40 forge-card p-1.5 flex flex-col gap-1"
        data-testid="account-switcher-menu"
      >
        <div
          v-for="a in accounts"
          :key="a.index"
          @click="pick(a.index)"
          class="flex items-center justify-between gap-2 px-2 py-2 rounded text-left transition-colors cursor-pointer"
          :class="
            a.index === active?.index
              ? 'bg-indigo-forge/15 border border-indigo-forge/40'
              : 'border border-transparent hover:bg-gunmetal-500'
          "
          :data-testid="`account-item-${a.index}`"
        >
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span
              class="w-5 h-5 rounded text-[9px] grid place-items-center mono font-bold flex-shrink-0"
              :class="
                a.index === active?.index
                  ? 'bg-indigo-forge/25 text-indigo-forgeBright border border-indigo-forge/50'
                  : 'bg-gunmetal-600 text-fiatDim border border-gunmetal-400'
              "
            >
              {{ a.index + 1 }}
            </span>
            <div class="flex flex-col min-w-0 flex-1">
              <!-- Rename mode -->
              <template v-if="editingIndex === a.index">
                <input
                  ref="editInputRef"
                  v-model="editValue"
                  type="text"
                  maxlength="24"
                  spellcheck="false"
                  @click.stop
                  @keydown="onEditKey($event, a.index)"
                  @blur="commitEdit(a.index)"
                  class="w-full bg-gunmetal-800 border border-indigo-forge/60 rounded px-1.5 py-0.5
                         text-[11px] text-fiat font-semibold focus:outline-none focus:shadow-glowIndigo"
                  :data-testid="`account-rename-input-${a.index}`"
                />
                <span class="mono text-[10px] text-fiatDim truncate mt-0.5">
                  {{ shortAddress(a.address, 6, 6) }}
                </span>
              </template>
              <template v-else>
                <span class="text-[11px] text-fiat font-semibold leading-none truncate">
                  {{ a.label }}
                </span>
                <span class="mono text-[10px] text-fiatDim truncate mt-0.5">
                  {{ shortAddress(a.address, 6, 6) }}
                </span>
              </template>
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <span class="mono text-[10px] text-cyan-voltGlow">
              {{ formatSth(wallet.balances[a.address] ?? 0, 2) }}
            </span>
            <!-- Edit/pen icon -->
            <button
              v-if="editingIndex !== a.index"
              type="button"
              @click="startEdit(a.index, a.label, $event)"
              class="w-6 h-6 grid place-items-center rounded text-fiatDim hover:text-cyan-voltGlow hover:bg-gunmetal-600 transition-colors"
              :data-testid="`account-edit-btn-${a.index}`"
              title="Rename"
            >
              <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          </div>
        </div>

        <div class="metal-divider my-0.5" />

        <button
          type="button"
          @click="addAccount"
          class="flex items-center justify-center gap-1.5 px-2 py-2 rounded border border-dashed border-indigo-forge/40 text-indigo-forgeBright text-[11px] uppercase tracking-[0.18em] font-semibold hover:bg-indigo-forge/10 hover:border-indigo-forge/70 transition-colors"
          data-testid="add-account-btn"
        >
          <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add account
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.dd-enter-active,
.dd-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}
.dd-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.dd-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
