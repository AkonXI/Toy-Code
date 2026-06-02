export const echartsMixin = {
  mounted() {
    window.addEventListener('resize', this.resize)
  },
  activated() {
    window.addEventListener('resize', this.resize)
    this.$nextTick(() => this.resize())
  },
  deactivated() {
    window.removeEventListener('resize', this.resize)
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resize)
    if (this.myEchart) {
      this.myEchart.dispose()
      this.myEchart = null
    }
  },
  methods: {
    resize() {
      this.myEchart?.resize()
    }
  }
}
