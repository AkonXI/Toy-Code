<template>
  <div :id="'PieCharts' + id" :style="{ width: '100%', height: '100%' }"></div>
</template>

<script>
import echarts from './echarts'
import graphicPieCircle, { getPosition } from './pieBg'
import pieBgImg from '@/assets/bigScreen/piebg.png'
import { echartsMixin } from './echartsMixin'
export default {
  name: 'PieCharts',
  mixins: [echartsMixin],
  props: {
    echartsData: { type: Array, default: () => [] },
    roseType: { type: Boolean },
    showOutline: { type: Boolean },
    showBg: { type: Boolean },
    unit: { type: String, default: '个' },
    showRate: { type: Boolean, default: true },
    centerX: { type: String, default: '25%' },
    centerY: { type: String, default: '50%' },
    customTitle: { type: Function, default() {} },
    id: { type: String, default: '' },
    hideLegend: { type: Boolean, default: false },
    padAngle: { type: Number, default: 0 },
    itemBorderWidth: { type: Number, default: 0 },
    colors: { type: Array },
    showPieLabel: { type: Boolean, default: false },
    labelFormatter: { type: Function },
    radiusInner: { type: String, default: '55%' },
    radiusOuter: { type: String, default: '65%' },
    zoom: { type: Number, default: 0.6 },
    titleTextAlign: { type: String, default: 'center' }
  },
  data() {
    return {
      graphicData: {},
      myEchart: null
    }
  },
  methods: {
    initChart() {
      const chartDom = document.getElementById('PieCharts' + this.id)
      if (!chartDom) return

      this.myEchart = echarts.init(chartDom)
      let total = 0
      if (this.echartsData && this.echartsData.length > 0) {
        total = this.echartsData.reduce((a, b) => a + Number(b.value), 0)
      }

      const computedDataGap = (dataParam) => {
        let newData = []
        let showLen = dataParam.filter((v) => v.value && v.value > 0)
        if (showLen.length <= 1) {
          return dataParam
        }
        dataParam.map((v) => {
          newData.push(v)
        })
        return newData
      }
      let n = computedDataGap(this.echartsData)
      let optionColorArr = this.echartsData.map((v) => v?.itemStyle?.color)
      let optionRich = []
      this.echartsData.forEach((el, index) => {
        optionRich[index] = {
          color: optionColorArr[index],
          fontSize: 16,
          padding: [10, 0, 10, 10]
        }
      })
      this.graphicData = graphicPieCircle(
        'PieCharts' + this.id,
        [this.centerX, this.centerY],
        pieBgImg,
        this.zoom
      )
      const titleX = this.centerX === '50%' ? 'center' : parseFloat(this.centerX) - 1 + '%'
      const posCheck = getPosition('PieCharts' + this.id, [this.centerX, this.centerY])
      const pixelCx = posCheck.left + posCheck.size / 2
      const pixelCy = posCheck.top + posCheck.size / 2
      const option = {
        graphic: this.showBg ? this.graphicData : undefined,
        legend: {
          show: !this.hideLegend,
          type: 'scroll',
          orient: 'vertical',
          right: '0',
          top: 'center',
          textStyle: {
            color: '#fff',
            width: 240,
            overflow: 'break',
            fontSize: 14,
            rich: {
              uname: {
                fontSize: 16,
                padding: [10, 0, 10, 10]
              },
              ...optionRich
            }
          },
          itemWidth: 10,
          itemHeight: 10,
          itemGap: 20,
          formatter: (name) => {
            for (let i = 0; i < this.echartsData.length; i++) {
              let item = this.echartsData[i]
              if (name === item.name) {
                let pct =
                  item.percent ||
                  (total > 0 ? ((Number(item.value) / total) * 100).toFixed(2) : '0.00')
                if (this.showRate) {
                  return `{uname|${name}} {${i}|${item.value}${this.unit}} {unum|${pct}%}`
                } else {
                  return `{uname|${name}} {${i}|${item.value}${this.unit}}`
                }
              }
            }
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
        title: !this.roseType && {
          text: this?.customTitle(total) ?? `{total|${total}}\n\n{text|总数}`,
          ...(this.titleTextAlign ? { textAlign: this.titleTextAlign } : {}),
          x: titleX,
          y: 'center',
          textStyle: {
            rich: {
              total: {
                color: '#ffffff',
                fontFamily: 'Alimama ShuHeiTi',
                fontSize: 30,
                fontWeight: 700,
                align: 'center'
              },
              text: {
                color: '#ffffff',
                fontFamily: 'PingFang SC',
                fontSize: 16,
                fontWeight: 400,
                align: 'center'
              }
            }
          }
        },
        color: this.colors,
        series: [
          this.showOutline
            ? {
                name: '',
                type: 'pie',
                radius: ['68%', '69%'],
                center: [pixelCx, pixelCy],
                avoidLabelOverlap: false,
                itemStyle: {
                  borderRadius: 1000,
                  borderWidth: 8
                },
                label: {
                  show: false,
                  position: 'center'
                },
                emphasis: {
                  disabled: true
                },
                emptyCircleStyle: {
                  color: 'rgba(255,255,255,0)'
                },
                labelLine: {
                  show: false
                },
                data: n
              }
            : null,
          {
            name: '',
            type: 'pie',
            radius: this.roseType ? ['20%', '60%'] : [this.radiusInner, this.radiusOuter],
            center: [pixelCx, pixelCy],
            roseType: this.roseType && 'area',
            padAngle: this.padAngle,
            label: this.showPieLabel
              ? {
                  show: true,
                  formatter: this.labelFormatter,
                  rich: {
                    total: {
                      color: 'white',
                      fontSize: '16px'
                    },
                    text: {
                      color: 'white',
                      fontSize: '12px',
                      padding: [5, 0, 0, 0]
                    }
                  }
                }
              : { show: false },
            itemStyle: {
              borderColor: 'transparent',
              borderWidth: this.itemBorderWidth
            },
            data: this.echartsData
          }
        ].filter(Boolean)
      }

      this.myEchart.setOption(option)
    }
  }
}
</script>
