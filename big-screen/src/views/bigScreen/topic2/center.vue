<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div class="relative size-full">
    <div class="top-query bottom-full">
      <a-radio-group v-model="typeRadio" @change="typeRadioChange">
        <a-radio-button value="1">类型一</a-radio-button>
        <a-radio-button value="2">类型二</a-radio-button>
      </a-radio-group>
    </div>
    <div class="bar-container py-4">
      <bar-charts
        class="flex-1"
        :tooltipFormatter="({ name, value }) => `样本数据：${value[1]}个`"
        :source="source"
        :series="series"
        :id="'sys-project'"
        :yAxisName="'个'"
        :legend="false"
        ref="barChart"
      ></bar-charts>
    </div>
  </div>
</template>

<script>
import moment from 'moment'
import BarCharts from '../com/BarCharts.vue'
import { post } from '@/utils/request'
import * as echarts from 'echarts'
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
      typeRadio: '1',
      xAxisData: [],
      data: [],
      legend_data: [],
      series: [],
      source: []
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
      let c = 0
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
    },
    typeRadioChange(e) {
      this.initData()
    },
    async initData() {
      let colors = [
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
            { offset: 0.88, color: '#ff8a0033' },
            { offset: 1, color: '#ff8a0033' }
          ]
        }
      ]
      let colors_top = ['#A5FFFF', '#FCFF6C']
      this.series = []

      try {
        const res = await post('/tpm-bd-screen/v1/queryInfoCenter', {
          extendProps: {},
          dimension: this.typeRadio,
          sysCompanyUuid: this.query_fields.sysCompanyUuid,
          isStatisticsChildNode: this.query_fields.isStatisticsChildNode
        })

        if (res?.data?.dataList?.length > 0) {
          this.registerShape()
          this.source = res.data.dataList.map((item, index) => {
            return [item.itemName, item.itemNum]
          })
        } else {
          this.source = []
        }
      } catch (err) {
        this.source = []
      }
      for (let i = 0; i < this.source[0].length - 1; i++) {
        this.series.push({
          type: 'custom',
          name: '',
          renderItem: (params, api) => {
            const location = api.coord([api.value(0), api.value(1)])
            return {
              type: 'group',
              children: [
                {
                  type: `CubeLeft${i}`,
                  shape: {
                    api,
                    xValue: api.value(0),
                    yValue: api.value(1),
                    x: location[0],
                    y: location[1],
                    xAxisPoint: api.coord([api.value(0), 0])
                  },
                  style: {
                    fill: colors[i]
                  }
                },
                {
                  type: `CubeRight${i}`,
                  shape: {
                    api,
                    xValue: api.value(0),
                    yValue: api.value(1),
                    x: location[0],
                    y: location[1],
                    xAxisPoint: api.coord([api.value(0), 0])
                  },
                  style: {
                    fill: colors[i]
                  }
                },
                {
                  type: `CubeTop${i}`,
                  shape: {
                    api,
                    xValue: api.value(0),
                    yValue: api.value(1),
                    x: location[0],
                    y: location[1],
                    xAxisPoint: api.coord([api.value(0), 0])
                  },
                  style: {
                    fill: colors_top[i]
                  }
                }
              ]
            }
          },
          barWidth: '16px',
          itemStyle: {
            borderRadius: [15, 15, 0, 0]
          }
        })
      }

      this.$nextTick(() => {
        this.$refs.barChart.initChart()
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

.top-query {
  position: absolute;
  right: 0;

  /deep/ .ant-radio-button-wrapper {
    background-color: transparent;
    border: 1px solid #0085d0;
    border-right: none;
    font-size: 12px;

    color: #fff;
  }

  .ant-radio-button-wrapper:last-child {
    border-right: 1px solid #0085d0;
  }

  /deep/ .ant-radio-button-wrapper-checked {
    border-color: #0085d0;
    color: #fff;
    background-color: #0085d0;
  }

  /deep/ .ant-radio-button-wrapper:not(:first-child)::before {
    background-color: transparent;
  }
}
</style>
