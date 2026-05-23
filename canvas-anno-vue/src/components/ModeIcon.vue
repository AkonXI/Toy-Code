<script setup lang="ts">
import type { ModeType, InteractionMode } from '../engine/types';
defineProps<{ type: ModeType | InteractionMode }>();
</script>

<template>
  <svg class="size-[18px] fill-current pointer-events-none" viewBox="0 0 24 24">
    <template v-if="type === 'select'">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </template>
    <template v-else-if="type === 'draw'">
      <path d="M12 20h9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </template>
    <rect v-else-if="type === 'rect'" x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
    <template v-else-if="type === 'point'">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </template>
    <polyline v-else-if="type === 'polyline'" points="3,21 9,7 15,15 21,3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <polygon v-else-if="type === 'polygon'" points="12,2 22,8 19,21 5,21 2,8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
  </svg>
</template>
