<!--
    @desc: 数据总量统计
-->
<template>
  <div class="bar-container">
    <bar-charts
      :xData="xData"
      :series="series"
      :legend="legend"
      :id="'sys-task1'"
      :yAxisName="'单位'"
      ref="barChart"
    ></bar-charts>
  </div>
</template>

<script>
import moment from 'moment'
import BarCharts from '../com/BarCharts3D.vue'
import { post } from '@/utils/request'
import echarts from '../com/echarts'

// 柱身颜色
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
// 柱头部颜色
const colors_top = ['#A5FFFF', '#FCFF6C']
export default {
  components: {
    BarCharts
  },
  props: {
    query_fields: {
      type: Object,
      default: () => {
        return {
          year: moment(new Date()).format('YYYY'),
          sysCompanyUuid: ''
        }
      }
    }
  },
  data() {
    return {
      myEchart: null,

      xData: [],
      data: [],
      legend: {
        right: 0,
        data: []
      },
      series: []
    }
  },
  watch: {
    query_fields: {
      handler(val) {
        this.initData()
      },
      deep: true
    }
  },
  created() {
    this.initData()
  },
  mounted() {},
  methods: {
    registerShape() {
      let c = -15
      const CubeLeft = echarts.graphic.extendShape({
        shape: {
          x: 0,
          y: 0
        },
        buildPath: function (ctx, shape) {
          const xAxisPoint = shape.xAxisPoint
          const c0 = [shape.x + c, shape.y]
          const c1 = [shape.x - 8 + c, shape.y - 8]
          const c2 = [xAxisPoint[0] - 8 + c, xAxisPoint[1] - 8]
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
          const c3 = [xAxisPoint[0] + 13 + c, xAxisPoint[1] - 4]
          const c4 = [shape.x + 13 + c, shape.y - 4]
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
          const c2 = [shape.x + 13 + c, shape.y - 4]
          const c3 = [shape.x + 5 + c, shape.y - 12]
          const c4 = [shape.x - 8 + c, shape.y - 8]
          ctx
            .moveTo(c1[0], c1[1])
            .lineTo(c2[0], c2[1])
            .lineTo(c3[0], c3[1])
            .lineTo(c4[0], c4[1])
            .closePath()
        }
      })
      echarts.graphic.registerShape('CubeLeft0', CubeLeft)
      echarts.graphic.registerShape('CubeRight0', CubeRight)
      echarts.graphic.registerShape('CubeTop0', CubeTop)

      let c_1 = 15
      const CubeLeft1 = echarts.graphic.extendShape({
        shape: {
          x: 0,
          y: 0
        },
        buildPath: function (ctx, shape) {
          const xAxisPoint = shape.xAxisPoint
          const c0 = [shape.x + c_1, shape.y]
          const c1 = [shape.x - 8 + c_1, shape.y - 8]
          const c2 = [xAxisPoint[0] - 8 + c_1, xAxisPoint[1] - 8]
          const c3 = [xAxisPoint[0] + c_1, xAxisPoint[1]]
          ctx
            .moveTo(c0[0], c0[1])
            .lineTo(c1[0], c1[1])
            .lineTo(c2[0], c2[1])
            .lineTo(c3[0], c3[1])
            .closePath()
        }
      })
      const CubeRight1 = echarts.graphic.extendShape({
        shape: {
          x: 0,
          y: 0
        },
        buildPath: function (ctx, shape) {
          const xAxisPoint = shape.xAxisPoint
          const c1 = [shape.x + c_1, shape.y]
          const c2 = [xAxisPoint[0] + c_1, xAxisPoint[1]]
          const c3 = [xAxisPoint[0] + 13 + c_1, xAxisPoint[1] - 4]
          const c4 = [shape.x + 13 + c_1, shape.y - 4]
          ctx
            .moveTo(c1[0], c1[1])
            .lineTo(c2[0], c2[1])
            .lineTo(c3[0], c3[1])
            .lineTo(c4[0], c4[1])
            .closePath()
        }
      })
      const CubeTop1 = echarts.graphic.extendShape({
        shape: {
          x: 0,
          y: 0
        },
        buildPath: function (ctx, shape) {
          const c1 = [shape.x + c_1, shape.y]
          const c2 = [shape.x + 13 + c_1, shape.y - 4]
          const c3 = [shape.x + 5 + c_1, shape.y - 12]
          const c4 = [shape.x - 8 + c_1, shape.y - 8]
          ctx
            .moveTo(c1[0], c1[1])
            .lineTo(c2[0], c2[1])
            .lineTo(c3[0], c3[1])
            .lineTo(c4[0], c4[1])
            .closePath()
        }
      })
      echarts.graphic.registerShape('CubeLeft1', CubeLeft1)
      echarts.graphic.registerShape('CubeRight1', CubeRight1)
      echarts.graphic.registerShape('CubeTop1', CubeTop1)
    },
    gerateSeries(info, index) {
      return [
        {
          type: 'custom',
          name: info.name,
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
                  type: `CubeLeft${index}`,
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
                  type: `CubeRight${index}`,
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
                  type: `CubeTop${index}`,
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
          data: info.data.map((item) => {
            return {
              value: item,
              itemStyle: { color: colors[index] }
            }
          })
        }
      ]
    },
    initData() {
      this.series = []

      this.registerShape()
      post('/tpm-warn-record/v1/statisticsWarnRecordCount', {
        sysCompanyUuid: this.query_fields.sysCompanyUuid,
        isStatisticsChildNode: this.query_fields.isStatisticsChildNode,
        year: this.query_fields.year
      }).then((res) => {
        this.series = []
        if (res?.data?.length > 0) {
          let legend = res.data[0].filter((item) => item)
          this.xData = res.data.slice(1).map((item) => {
            return item[0]
          })
          let data = legend.map((label, idx) => ({
            name: label,
            data: res.data.slice(1).map((item) => {
              return item[idx + 1]
            })
          }))
          this.legend.data = []
          data.forEach((item, index) => {
            this.legend.data.push({
              name: item.name,
              icon: 'circle',

              textStyle: {
                color: '#ffffff',
                fontSize: 14,
                fontFamily: 'PingFang SC',
                fontWeight: 'normal'
              },
              itemStyle: {
                color: colors[index]
              }
            })
            let item_s = this.gerateSeries(item, index)
            this.series.push(...item_s)
          })

          this.$nextTick(() => {
            this.$refs.barChart.initChart()
          })
        }
      })
    }
  }
}
</script>

<style lang="less" scoped>
.bar-container {
  height: 100%;
  width: 100%;
}
</style>
