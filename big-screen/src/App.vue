<template>
  <bigScreen />
</template>

<script>
import bigScreen from '@/views/bigScreen/index.vue'

export default {
  components: { bigScreen }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html,
body,
#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
