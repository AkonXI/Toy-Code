<template>
  <div :id="'DashboardCharts' + id" :style="{ width: '100%', height: '100%' }"></div>
</template>

<script>
import * as echarts from 'echarts'
import { echartsMixin } from '../../com/echartsMixin'
export default {
  name: 'DashboardCharts',
  mixins: [echartsMixin],
  props: {
    source: {
      type: Array
    },
    max: {
      type: Number,
      default: 200
    },
    series: {
      type: Array,
      default: () => []
    },
    splitLineType: {
      type: String
    },
    id: {
      type: String,
      default: ''
    },
    yAxisName: {
      type: String,
      default: '单位'
    }
  },
  data() {
    return {
      myEchart: null
    }
  },
  methods: {
    initChart() {
      const chartDom = document.getElementById('DashboardCharts' + this.id)
      if (!chartDom) return

      this.myEchart = echarts.init(chartDom)
      const option = {
        series: [
          {
            type: 'gauge',
            startAngle: 180,
            endAngle: 0,
            center: ['50%', '70%'],
            radius: '90%',
            min: 0,
            max: this.max,
            splitNumber: 9,
            axisLine: {
              lineStyle: {
                width: 12,
                color: [
                  [0.33, '#23A4B6'],
                  [0.67, '#3784F2'],
                  [1, '#E9A351']
                ]
              }
            },
            title: {
              show: false
            },
            pointer: {
              icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
              length: '12%',
              width: 10,
              offsetCenter: [0, '-65%'],
              itemStyle: { color: 'auto' }
            },
            axisTick: { length: 0, lineStyle: { color: 'auto', width: 1 }, distance: 0 },
            splitLine: { length: 4, lineStyle: { color: 'lightgray', width: 2 }, distance: 0 },
            axisLabel: {
              color: '#464646',
              fontSize: 20,
              distance: -60,
              rotate: 'tangential',
              formatter: function (value) {
                return ''
              }
            },
            title: {
              show: false
            },
            detail: {
              fontSize: 0,
              offsetCenter: [0, '-5%'],
              valueAnimation: true,
              formatter: (...rest) => {
                return [
                  `{a|${this.source[0].num}}`,
                  `{b|${this.source[0].value}%}`,
                  `{c|${this.source[0].name}}`
                ].join('\n')
              },

              rich: {
                a: {
                  color: 'white',
                  fontSize: 40,
                  fontWeight: 'bold'
                },
                b: {
                  color: 'white',
                  lineHeight: 36,
                  fontSize: 22
                },
                c: {
                  color: 'white',
                  fontSize: 14
                }
              }
            },
            data: this.source
          }
        ]
      }

      this.myEchart.setOption(option)
    }
  }
}
</script>
