<script setup lang="ts">
import { useToasts } from "@/lib/utils";
const toasts = useToasts();
</script>

<template>
  <div class="toast-container" data-testid="toast-host">
    <div
      v-for="t in toasts.items"
      :key="t.id"
      class="toast"
      :class="{ 'toast-error': t.kind === 'error', 'toast-success': t.kind === 'success' }"
      :data-testid="`toast-${t.kind}`"
    >
      <span v-if="t.kind === 'success'" class="text-indigo-forgeBright">✓</span>
      <span v-else-if="t.kind === 'error'" class="text-rust">!</span>
      <span v-else class="text-cyan-volt">·</span>
      {{ t.text }}
    </div>
  </div>
</template>
