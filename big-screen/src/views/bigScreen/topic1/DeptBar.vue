<template>
  <div :id="'BarCharts' + id" :style="{ width: '100%', height: '100%' }"></div>
</template>

<script>
import * as echarts from 'echarts'
import { post } from '@/utils/request'
import { echartsMixin } from '../com/echartsMixin'
const colors_top = ['#A5FFFF', '#FCFF6C']

const colors = [
  {
    type: 'linear',
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: '#00D0DD' },
      { offset: 0.88, color: '#00c2ff33' },
      { offset: 1, color: '#00c2ff33' }
    ]
  },
  {
    type: 'linear',
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: '#FFD600' },
      { offset: 0.88, color: '#FF8A0033' },
      { offset: 1, color: '#FF8A0033' }
    ]
  }
]
export default {
  name: 'BarCharts',
  mixins: [echartsMixin],
  props: {
    id: {
      type: String,
      default: ''
    },
    query_fields: {
      type: Object,
      default: () => {
        return {
          year: moment(new Date()).format('YYYY'),
          sysCompanyUuid: ''
        }
      }
    },
    yAxisName: {
      type: String,
      default: '单位'
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
  data() {
    return {
      myEchart: null
    }
  },
  mounted() {
    this.initChart()
  },
  methods: {
    registerShape() {
      let c = 0
      const CubeLeft = echarts.graphic.extendShape({
        shape: {
          x: 0,
          y: 0
        },
        buildPath: function (ctx, shape) {
          const xAxisPoint = shape.xAxisPoint
          const c0 = [shape.x + c, shape.y]
          const c1 = [shape.x - 18 + c, shape.y - 18]
          const c2 = [xAxisPoint[0] - 18 + c, xAxisPoint[1] - 18]
          const c3 = [xAxisPoint[0] + c, xAxisPoint[1]]
          ctx
            .moveTo(c0[0], c0[1])
            .lineTo(c1[0], c1[1])
            .lineTo(c2[0], c2[1])
            .lineTo(c3[0], c3[1])
            .closePath()
        }
      })
      const CubeRight = echarts.graphic.extendShape({
        shape: {
          x: 0,
          y: 0
        },
        buildPath: function (ctx, shape) {
          const xAxisPoint = shape.xAxisPoint
          const c1 = [shape.x + c, shape.y]
          const c2 = [xAxisPoint[0] + c, xAxisPoint[1]]
          const c3 = [xAxisPoint[0] + 18 + c, xAxisPoint[1] - 18]
          const c4 = [shape.x + 18 + c, shape.y - 18]
          ctx
            .moveTo(c1[0], c1[1])
            .lineTo(c2[0], c2[1])
            .lineTo(c3[0], c3[1])
            .lineTo(c4[0], c4[1])
            .closePath()
        }
      })

      const CubeTop = echarts.graphic.extendShape({
        shape: {
          x: 0,
          y: 0
        },
        buildPath: function (ctx, shape) {
          const c1 = [shape.x + c, shape.y]
          const c2 = [shape.x + 18 + c, shape.y - 18]
          const c3 = [shape.x + 18 + c, shape.y - 18]
          const c4 = [shape.x - 18 + c, shape.y - 18]
          ctx
            .moveTo(c1[0], c1[1])
            .lineTo(c2[0], c2[1])
            .lineTo(c3[0], c3[1])
            .lineTo(c4[0], c4[1])
            .closePath()
        }
      })
      echarts.graphic.registerShape('CubeThirdLeft0', CubeLeft)
      echarts.graphic.registerShape('CubeThirdRight0', CubeRight)
      echarts.graphic.registerShape('CubeThirdTop0', CubeTop)
    },
    gerateSeries(info, index = 0) {
      return [
        {
          type: 'custom',
          name: info[0]?.itemName || '部门数据',
          renderItem: (params, api) => {
            const value = api.value(1)
            if (value === 0) {
              return { type: 'group', children: [] } // 返回一个空的 group，不绘制任何图形
            }
            const location = api.coord([api.value(0), api.value(1)])
            return {
              type: 'group',
              children: [
                {
                  type: `CubeThirdLeft${index}`,
                  shape: {
                    api,
                    xValue: api.value(0),
                    yValue: api.value(1),
                    x: location[0],
                    y: location[1],
                    xAxisPoint: api.coord([api.value(0), 0])
                  },
                  style: {
                    fill: colors[index]
                  }
                },
                {
                  type: `CubeThirdRight${index}`,
                  shape: {
                    api,
                    xValue: api.value(0),
                    yValue: api.value(1),
                    x: location[0],
                    y: location[1],
                    xAxisPoint: api.coord([api.value(0), 0])
                  },
                  style: {
                    fill: colors[index]
                  }
                },
                {
                  type: `CubeThirdTop${index}`,
                  shape: {
                    api,
                    xValue: api.value(0),
                    yValue: api.value(1),
                    x: location[0],
                    y: location[1],
                    xAxisPoint: api.coord([api.value(0), 0])
                  },
                  style: {
                    fill: colors_top[index]
                  }
                }
              ]
            }
          },
          data: info.map((item) => {
            return {
              value: item.itemNum,
              itemStyle: { color: colors[index] }
            }
          })
        }
      ]
    },
    async initChart() {
      const res = await post('/tpm-bd-screen/v1/queryExpertDeptInfo', {
        extendProps: {},
        sysCompanyUuid: this.query_fields.sysCompanyUuid,
        isStatisticsChildNode: this.query_fields.isStatisticsChildNode
      })
      const chartDom = document.getElementById('BarCharts' + this.id)
      if (!chartDom) return
      let that = this
      this.myEchart = echarts.init(chartDom)
      this.registerShape()
      console.warn(res)
      const option = {
        grid: {
          top: '40',
          bottom: '30',
          left: '40',
          right: 0
        },
        legend: {
          icon: 'circle',
          right: 0,
          itemWidth: 12,
          itemHeight: 12,
          textStyle: {
            color: '#ffffff',
            fontSize: 14,
            fontFamily: 'PingFang SC',
            fontWeight: 'normal'
          }
        },
        tooltip: {
          backgroundColor: '#073371c7',
          borderWidth: 1,
          borderColor: '#0085ff8f',
          textStyle: {
            color: '#fff'
          }
        },
        // dataset: {
        //   source: this.source
        // },
        //横轴
        xAxis: {
          type: 'category',
          axisLine: {
            show: false,
            lineStyle: {
              color: '#fff'
            }
          },
          axisLabel: {
            textStyle: {
              show: true,
              color: '#fff',
              fontSize: '14px',
              fontFamily: 'PingFang SC',
              fontWeight: '400'
            }
          },
          axisTick: {
            show: false
          },
          data: res?.data?.dataList.map((v) => v.itemName)
        },
        yAxis: {
          minInterval: 1,
          name: this.yAxisName,
          type: 'value',
          nameTextStyle: {
            align: 'center',
            color: '#ffffff99',
            fontSize: '14px'
          },
          splitLine: {
            show: true,
            lineStyle: {
              color: 'rgba(255, 255, 255, 0.12)'
            }
          },
          // 轴线
          axisLine: {
            show: false,
            lineStyle: {
              color: '#C9CDD4'
            }
          },
          axisLabel: {
            textStyle: {
              show: true,
              color: '#fff',
              fontSize: '14px',
              fontFamily: 'PingFang SC',
              fontWeight: '400'
            }
          }
        },
        series: this.gerateSeries(res?.data?.dataList, 0)
        //     [
        //   {
        //     data: res?.data?.dataList.map(v => { return { percent: v.percent + '%', value: v.itemNum } }),
        //     type: 'bar',
        //     barWidth: '26px',
        //     label: {
        //       show: true,
        //       offset: [0, -5],
        //       position: 'top',
        //       formatter({ data }) {
        //         return data.percent
        //       },
        //       color: 'white',
        //       valueAnimation: true
        //     },
        //     itemStyle: {
        //       color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        //         { offset: 0, color: ' #07D2FFcc' },
        //         { offset: 0.5, color: '#07D2FF66' },
        //         { offset: 1, color: '#07D2FF20' }
        //       ])
        //     },
        //     renderItem: function (params, api) {
        //       return that.getRenderItem(params, api)
        //     }
        //   }
        // ],
      }

      this.myEchart.setOption(option)
    }
  }
}
</script>
