<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from "vue";
import { useSettingsStore } from "@/stores/settings";
import { LOCALES, useT } from "@/locales";

const settings = useSettingsStore();
const t = useT();
const open = ref(false);
const ddRef = ref<HTMLElement | null>(null);

const current = computed(
  () => LOCALES.find((l) => l.code === settings.locale) ?? LOCALES[0]
);

function pick(code: "en" | "ru" | "zh" | "es") {
  settings.setLocale(code);
  open.value = false;
}

function onDoc(e: MouseEvent) {
  if (!ddRef.value) return;
  if (!ddRef.value.contains(e.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener("mousedown", onDoc));
onBeforeUnmount(() => document.removeEventListener("mousedown", onDoc));
</script>

<template>
  <div ref="ddRef" class="relative" data-testid="language-dropdown">
    <button
      type="button"
      @click="open = !open"
      :title="t('top.language')"
      class="h-8 px-2 flex items-center gap-1 rounded border border-gunmetal-400 text-fiat
             hover:border-cyan-volt/60 hover:text-cyan-voltGlow transition-colors"
      data-testid="language-toggle"
    >
      <span class="mono text-[10px] font-bold tracking-wider">{{ current.flag }}</span>
      <svg
        viewBox="0 0 24 24"
        class="w-3 h-3 transition-transform"
        :class="{ 'rotate-180': open }"
        fill="none" stroke="currentColor" stroke-width="2"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <transition name="dd">
      <div
        v-if="open"
        class="absolute right-0 top-full mt-1.5 z-40 forge-card p-1 min-w-[140px] flex flex-col gap-0.5"
        data-testid="language-menu"
      >
        <button
          v-for="l in LOCALES"
          :key="l.code"
          type="button"
          @click="pick(l.code)"
          :data-testid="`language-${l.code}`"
          class="flex items-center gap-2 px-2.5 py-2 rounded text-left transition-colors text-[12px]"
          :class="
            l.code === settings.locale
              ? 'bg-indigo-forge/15 text-indigo-forgeBright border border-indigo-forge/40'
              : 'border border-transparent text-fiat hover:bg-gunmetal-500'
          "
        >
          <span class="mono text-[10px] font-bold w-6">{{ l.flag }}</span>
          <span class="flex-1">{{ l.label }}</span>
          <span v-if="l.code === settings.locale" class="text-cyan-voltGlow">✓</span>
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.dd-enter-active, .dd-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}
.dd-enter-from, .dd-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
