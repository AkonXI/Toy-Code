<template>
  <div
    ref="chart"
    :id="'piechart3d' + id"
    :class="className"
    :style="{ height: height, width: width }"
  />
</template>

<script>
import * as echarts from 'echarts'
import 'echarts-gl'
import { post } from '@/utils/request'
import { ROSE_COLORS } from '../com/colors'
import { echartsMixin } from '../com/echartsMixin'

export default {
  mixins: [echartsMixin],
  props: {
    query_fields: {
      type: Object,
      default: () => {
        return {
          year: moment(new Date()).format('YYYY'),
          sysCompanyUuid: ''
        }
      }
    },
    className: {
      type: String,
      default: 'container'
    },
    id: {
      type: String,
      default: ''
    },
    width: {
      type: String,
      default: '100%'
    },
    height: {
      type: String,
      default: '100%'
    },
    dimension: {
      type: String,
      default: '2'
    }
  },
  data() {
    return {
      datalist: [],
      chart: null,
      multi: 1,
      fontSize: 14,
      scale: 1,
      optionAll: 0
    }
  },
  watch: {
    query_fields: {
      handler(val) {
        this.initChart()
      },
      deep: true
    }
  },
  beforeUnmount() {
    if (this.chart) {
      this.chart.dispose()
      this.chart = null
    }
  },
  mounted() {
    this.initChart()
  },
  methods: {
    async initChart() {
      const res = await post('/tpm-bd-screen/v1/queryExpertTypeInfo', {
        dimension: this.dimension,
        extendProps: {},
        sysCompanyUuid: this.query_fields.sysCompanyUuid,
        isStatisticsChildNode: this.query_fields.isStatisticsChildNode
      })
      this.datalist = res.data.dataList.map((v, index) => {
        return {
          name: v.itemName,
          value: Number(v.itemNum),
          percent: v.percent,
          itemStyle: {
            color: ROSE_COLORS[index % ROSE_COLORS.length]
          }
        }
      })
      this.scale = document.documentElement.clientWidth / 1480
      this.chart = echarts.init(this.$refs.chart)
      const data = this.datalist
      for (let item of data) {
        this.optionAll = this.optionAll + Number(item.value)
      }

      // 生成扇形的曲面参数方程，用于 series-surface.parametricEquation
      const getParametricEquation = (startRatio, endRatio, isSelected, isHovered, k, h) => {
        // 计算
        let midRatio = (startRatio + endRatio) / 2

        let startRadian = startRatio * Math.PI * 2
        let endRadian = endRatio * Math.PI * 2
        let midRadian = midRatio * Math.PI * 2

        // 如果只有一个扇形，则不实现选中效果。
        if (startRatio === 0 && endRatio === 1) {
          isSelected = false
        }

        // 通过扇形内径/外径的值，换算出辅助参数 k（默认值 1/3）
        k = typeof k !== 'undefined' ? k : 1 / 3

        // 计算选中效果分别在 x 轴、y 轴方向上的位移（未选中，则位移均为 0）
        let offsetX = isSelected ? Math.cos(midRadian) * 0.1 : 0
        let offsetY = isSelected ? Math.sin(midRadian) * 0.1 : 0

        // 计算高亮效果的放大比例（未高亮，则比例为 1）
        let hoverRate = isHovered ? 1.05 : 1

        // 返回曲面参数方程
        return {
          u: {
            min: -Math.PI,
            max: Math.PI * 3,
            step: Math.PI / 32
          },

          v: {
            min: 0,
            max: Math.PI * 2,
            step: Math.PI / 20
          },

          x(u, v) {
            if (u < startRadian) {
              return offsetX + Math.cos(startRadian) * (1 + Math.cos(v) * k) * hoverRate
            }
            if (u > endRadian) {
              return offsetX + Math.cos(endRadian) * (1 + Math.cos(v) * k) * hoverRate
            }
            return offsetX + Math.cos(u) * (1 + Math.cos(v) * k) * hoverRate
          },

          y(u, v) {
            if (u < startRadian) {
              return offsetY + Math.sin(startRadian) * (1 + Math.cos(v) * k) * hoverRate
            }
            if (u > endRadian) {
              return offsetY + Math.sin(endRadian) * (1 + Math.cos(v) * k) * hoverRate
            }
            return offsetY + Math.sin(u) * (1 + Math.cos(v) * k) * hoverRate
          },

          z: function (u, v) {
            if (u < -Math.PI * 0.5) {
              return Math.sin(u)
            }
            if (u > Math.PI * 2.5) {
              return Math.sin(u) * h * 0.1
            }
            return Math.sin(v) > 0 ? 1 * h * 0.1 : -1
          }
        }
      }

      // 生成模拟 3D 饼图的配置项
      const getPie3D = (pieData, internalDiameterRatio) => {
        let series = []
        let sumValue = 0
        let startValue = 0
        let endValue = 0
        let legendData = []
        let k =
          typeof internalDiameterRatio !== 'undefined'
            ? (1 - internalDiameterRatio) / (1 + internalDiameterRatio)
            : 1 / 3

        // 为每一个饼图数据，生成一个 series-surface 配置
        for (let i = 0; i < pieData.length; i++) {
          sumValue += pieData[i].value

          let seriesItem = {
            name: typeof pieData[i].name === 'undefined' ? `series${i}` : pieData[i].name,
            type: 'surface',
            parametric: true,
            wireframe: {
              show: false
            },
            pieData: pieData[i],
            pieStatus: {
              selected: false,
              hovered: false,
              k
            }
          }

          if (typeof pieData[i].itemStyle != 'undefined') {
            let itemStyle = {}

            typeof pieData[i].itemStyle.color != 'undefined'
              ? (itemStyle.color = pieData[i].itemStyle.color)
              : null
            typeof pieData[i].itemStyle.opacity != 'undefined'
              ? (itemStyle.opacity = pieData[i].itemStyle.opacity)
              : null

            seriesItem.itemStyle = itemStyle
          }
          series.push(seriesItem)
        }
        // 计算倍率  以最高的一个为80 获得倍率 然后所有值除以倍率
        this.multi = Math.max(...series.map((v) => v.pieData.value)) / 100
        // 使用上一次遍历时，计算出的数据和 sumValue，调用 getParametricEquation 函数，
        // 向每个 series-surface 传入不同的参数方程 series-surface.parametricEquation，也就是实现每一个扇形。
        for (let i = 0; i < series.length; i++) {
          endValue = startValue + series[i].pieData.value
          series[i].pieData.startRatio = startValue / sumValue
          series[i].pieData.endRatio = endValue / sumValue
          series[i].parametricEquation = getParametricEquation(
            series[i].pieData.startRatio,
            series[i].pieData.endRatio,
            false,
            false,
            k,
            series[i].pieData.value / this.multi
          )

          startValue = endValue

          legendData.push(series[i].name)
        }

        // 补充一个透明的圆环，用于支撑高亮功能的近似实现。
        series.push({
          name: 'mouseoutSeries',
          type: 'pie',
          labelLine: {
            length: 20,
            lineStyle: {
              color: '#ffffff'
            }
          },

          tooltip: {
            show: false
          },
          label: {
            show: false,
            position: 'outside',
            rich: {
              b: {
                color: '#FFFFFF',
                fontSize: 7 * this.scale
              },
              d: {
                color: '#FFFFFF',
                fontSize: 7 * this.scale
              }
            },
            formatter: '{b|{b}}{d|{d} %}'
          },
          radius: ['75%', '75%'],
          center: ['50%', '50%'],
          parametric: false,
          wireframe: {
            show: false
          },
          itemStyle: {
            opacity: 1
          },
          data: data,
          parametricEquation: {
            u: {
              min: 0,
              max: Math.PI * 2,
              step: Math.PI / 20
            },
            v: {
              min: 0,
              max: Math.PI,
              step: Math.PI / 20
            },
            x: function (u, v) {
              return Math.sin(v) * Math.sin(u) + Math.sin(u)
            },
            y: function (u, v) {
              return Math.sin(v) * Math.cos(u) + Math.cos(u)
            },
            z: function (u, v) {
              return Math.cos(v) > 0 ? 0.1 : -0.1
            }
          }
        })

        // 准备待返回的配置项，把准备好的 legendData、series 传入。
        let option = {
          tooltip: {
            backgroundColor: '#073371c7',
            borderWidth: 1,
            borderColor: '#0085ff8f',
            textStyle: {
              color: '#fff'
            },
            formatter: (params) => {
              if (params.seriesName !== 'mouseoutSeries') {
                return `${params.seriesName} ${(
                  (option.series[params.seriesIndex].pieData.value / this.optionAll) *
                  100
                ).toFixed(2)} %`
              }
            }
          },
          xAxis3D: {
            min: -1,
            max: 1
          },
          yAxis3D: {
            min: -1,
            max: 1
          },
          zAxis3D: {
            min: -1,
            max: 1
          },

          grid3D: {
            top: '-10%',
            height: 300,
            show: false,
            boxHeight: 6,
            boxWidth: 100,
            boxDepth: 100,
            viewControl: {
              alpha: 30,
              distance: 180,
              rotateSensitivity: 1,
              zoomSensitivity: 1,
              panSensitivity: 0,
              autoRotate: true,
              autoRotateSpeed: 3
            },
            //后处理特效可以为画面添加高光、景深、环境光遮蔽（SSAO）、调色等效果。可以让整个画面更富有质感。
            postEffect: {
              //配置这项会出现锯齿，请自己去查看官方配置有办法解决
              enable: true,
              bloom: {
                enable: true,
                bloomIntensity: 0.1
              },
              SSAO: {
                enable: true,
                quality: 'medium',
                radius: 2
              }
            }
          },
          legend: {
            show: true,
            orient: 'horizontal',
            bottom: '10%',

            textStyle: {
              color: '#fff',
              fontSize: 14,
              rich: {
                uname: {
                  width: 100,
                  fontSize: 14,
                  padding: [0, 0, 0, 10]
                },
                unum: {
                  width: 40,
                  fontFamily: 'D-DIN-PRO'
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
              for (let i = 0; i < this.datalist.length; i++) {
                let item = this.datalist[i]
                if (name === item.name) {
                  return `{uname|${name}}${item.value}个   {${i}|${item.percent}%}`
                }
              }
              // const item = this.echartsData.find(d => d.name === name);
              // if (!item) return name;
            }
          },
          series: series
        }
        return option
      }

      // 传入数据生成 option
      let option = getPie3D(data, 0.6)
      this.chart.setOption(option)
      // 监听鼠标事件，实现饼图选中效果（单选），近似实现高亮（放大）效果。
      let hoveredIndex = ''
      // 监听 mouseover，近似实现高亮（放大）效果
      this.chart.on('mouseover', (params) => {
        // 准备重新渲染扇形所需的参数
        let isSelected
        let isHovered
        let startRatio
        let endRatio
        let k

        // 如果触发 mouseover 的扇形当前已高亮，则不做操作
        if (hoveredIndex === params.seriesIndex) {
          return

          // 否则进行高亮及必要的取消高亮操作
        } else {
          // 如果当前有高亮的扇形，取消其高亮状态（对 option 更新）
          if (hoveredIndex !== '') {
            // 从 option.series 中读取重新渲染扇形所需的参数，将是否高亮设置为 false。
            isSelected = option.series[hoveredIndex].pieStatus.selected
            isHovered = false
            startRatio = option.series[hoveredIndex].pieData.startRatio
            endRatio = option.series[hoveredIndex].pieData.endRatio
            k = option.series[hoveredIndex].pieStatus.k

            // 对当前点击的扇形，执行取消高亮操作（对 option 更新）
            option.series[hoveredIndex].parametricEquation = getParametricEquation(
              startRatio,
              endRatio,
              isSelected,
              isHovered,
              k,
              option.series[hoveredIndex].pieData.value / this.multi
            )
            option.series[hoveredIndex].pieStatus.hovered = isHovered

            // 将此前记录的上次选中的扇形对应的系列号 seriesIndex 清空
            hoveredIndex = ''
          }

          // 如果触发 mouseover 的扇形不是透明圆环，将其高亮（对 option 更新）
          if (params.seriesName !== 'mouseoutSeries') {
            // 从 option.series 中读取重新渲染扇形所需的参数，将是否高亮设置为 true。
            isSelected = option.series[params.seriesIndex].pieStatus.selected
            isHovered = true
            startRatio = option.series[params.seriesIndex].pieData.startRatio
            endRatio = option.series[params.seriesIndex].pieData.endRatio
            k = option.series[params.seriesIndex].pieStatus.k

            // 对当前点击的扇形，执行高亮操作（对 option 更新）
            option.series[params.seriesIndex].parametricEquation = getParametricEquation(
              startRatio,
              endRatio,
              isSelected,
              isHovered,
              k,
              option.series[params.seriesIndex].pieData.value / this.multi + 5
            )
            option.series[params.seriesIndex].pieStatus.hovered = isHovered

            // 记录上次高亮的扇形对应的系列号 seriesIndex
            hoveredIndex = params.seriesIndex
          }
          // TODO 如果触发事件没有 seriesName ,判断有无已高亮扇形，还原位置
          // 使用更新后的 option，渲染图表
          this.chart.setOption(option)
        }
      })
    }
  }
}
</script>
<style scoped lang="less">
.highcharts-tooltip {
  font-size: 37px;
}
</style>
