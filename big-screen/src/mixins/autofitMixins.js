import autofit from 'autofit.js'
export const autofitMixins = {
  mounted() {
    this.$nextTick(() => {
      autofit.init({ el: '.scale-wrap', limit: 0, transition: 0.3 })
    })
  },
  beforeDestroy() {
    autofit?.off()
  }
}
