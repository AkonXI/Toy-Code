<template>
  <div :id="'BarCharts' + id" :style="{ width: '100%', height: '100%' }"></div>
</template>

<script>
import echarts from '../com/echarts'
import { echartsMixin } from '../com/echartsMixin'

export default {
  name: 'BarCharts',
  mixins: [echartsMixin],
  props: {
    legend: { type: Boolean, default: true },
    tooltipFormatter: { type: Function },
    source: { type: Array, default: () => [] },
    series: { type: Array, default: () => [] },
    splitLineType: { type: String },
    id: { type: String, default: '' },
    yAxisName: { type: String, default: '单位' },
  },
  methods: {
    initChart() {
      const chartDom = document.getElementById('BarCharts' + this.id)
      if (!chartDom) return
      if (this.myEchart) {
        this.myEchart.clear()
      } else {
        this.myEchart = echarts.init(chartDom)
      }

      const option = {
        grid: { top: '40', bottom: '30', left: '40', right: 0 },
        legend: this.legend && {
          icon: 'circle', right: 0, itemWidth: 12, itemHeight: 12,
          textStyle: { color: '#ffffff', fontSize: 14, fontFamily: 'PingFang SC', fontWeight: 'normal' },
        },
        tooltip: {
          backgroundColor: '#073371c7', borderWidth: 1, borderColor: '#0085ff8f',
          textStyle: { color: '#fff' },
          formatter: this.tooltipFormatter,
        },
        dataset: { source: this.source },
        xAxis: {
          type: 'category',
          axisLine: { show: false, lineStyle: { color: '#fff' } },
          axisLabel: { textStyle: { show: true, color: '#fff', fontSize: '14px', fontFamily: 'PingFang SC', fontWeight: '400' } },
          axisTick: { show: false },
        },
        yAxis: {
          minInterval: 1,
          name: this.yAxisName, type: 'value',
          nameTextStyle: { align: 'center', color: '#ffffff99', fontSize: '14px' },
          splitLine: { show: true, lineStyle: { type: this.splitLineType ?? 'solid', color: 'rgba(255, 255, 255, 0.12)' } },
          axisLine: { show: false, lineStyle: { color: '#C9CDD4' } },
          axisLabel: { textStyle: { show: true, color: '#fff', fontSize: '14px', fontFamily: 'PingFang SC', fontWeight: '400' } },
        },
        series: this.series,
      }

      this.myEchart.setOption(option)
    },
  },
}
</script>
