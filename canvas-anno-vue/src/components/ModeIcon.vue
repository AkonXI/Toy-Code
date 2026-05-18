<script setup lang="ts">
import type { ModeType } from '../engine/types';
defineProps<{ type: ModeType }>();
</script>

<template>
  <svg class="size-[18px] fill-current pointer-events-none" viewBox="0 0 24 24">
    <rect v-if="type === 'rect'" x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
    <template v-else-if="type === 'point'">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </template>
    <polyline v-else-if="type === 'polyline'" points="3,21 9,7 15,15 21,3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <polygon v-else-if="type === 'polygon'" points="12,2 22,8 19,21 5,21 2,8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
  </svg>
</template>
