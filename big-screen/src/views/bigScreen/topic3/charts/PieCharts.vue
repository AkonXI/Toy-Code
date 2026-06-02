<template>
  <div :id="'PieCharts' + id" :style="{ width: '100%', height: '100%' }"></div>
</template>

<script>
import echarts from '@/views/bigScreen/com/echarts'
import { echartsMixin } from '../../com/echartsMixin'

export default {
  name: 'PieCharts',
  mixins: [echartsMixin],
  props: {
    echartsData: {
      type: Array,
      default: () => []
    },

    id: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      myEchart: null
    }
  },
  methods: {
    initChart(echartsData) {
      const chartDom = document.getElementById('PieCharts' + this.id)
      if (!chartDom) return

      this.myEchart = echarts.init(chartDom)

      const option = {
        legend: {
          orient: 'vertical',
          right: 0,
          top: 'center',
          type: 'scroll',
          pageIconColor: '#fff',
          pageIconSize: 10,
          pageTextStyle: {
            color: '#fff'
          },

          textStyle: {
            rich: {
              uname: {
                width: 140,
                fontSize: 16,
                color: '#ffffffde',
                padding: [0, 0, 0, 10]
              },
              unum: {
                fontSize: 16,
                color: '#ffffffde'
              },
              unit: {
                color: '#ffffff61'
              }
            }
          },
          itemStyle: {
            borderColor: 'transparent',
            borderWidth: 0
          },
          itemWidth: 10,
          itemHeight: 10,
          itemGap: 20,
          formatter: (name) => {
            let item = echartsData.find((d) => d.name === name)
            if (!item) return name
            let idx = echartsData.findIndex((d) => d.name === name)

            return `{uname|分类${idx + 1}}{unum|${item.value}}{unit|个}`
          }
        },
        tooltip: {
          trigger: 'item',
          backgroundColor: '#073371c7',
          borderWidth: 1,
          borderColor: '#0085ff8f',
          textStyle: {
            color: '#fff'
          }
        },
        series: [
          {
            name: '',
            type: 'pie',
            radius: [30, 80],
            center: ['20%', '50%'],
            roseType: 'radius',
            animationType: 'scale', // 使用缩放动画
            animationEasing: 'elastic', // 采用弹性动画
            label: {
              show: false
            },
            itemStyle: {
              borderColor: 'transparent',
              borderWidth: 0
            },
            data: echartsData
          }
        ]
      }

      this.myEchart.setOption(option)
      let this_ = this
      this.myEchart.off('click')
      this.myEchart.on('click', function (params) {
        let children = params.data.children
        if (children && children.length > 0) {
          this_.initChart(children)
        }
      })
    }
  }
}
</script>
