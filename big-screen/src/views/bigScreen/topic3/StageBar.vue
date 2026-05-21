<!--
    @desc: StageBar
-->
<template>
  <div class="bar-container">
    <bar-charts :xData="xData" :series="series" :legend="legend" :id="'sys-project'" :yAxisName="'单位'" ref="barChart"></bar-charts>
  </div>
</template>

<script>
import moment from 'moment';
import BarCharts from '../com/BarCharts3D.vue';
import echarts from '../com/echarts';
import { post } from '@/utils/request';

export default {
  components: {
    BarCharts,
  },
  props: {
    query_fields: {
      type: Object,
      default: () => {
        return {
          year: moment(new Date()).format('YYYY'),
          sysCompanyUuid: '',
        };
      },
    },
  },
  data() {
    return {
      myEchart: null,

      xAxisData: [],
      data: [],
      legend: {show:false},
      series: [],
      xData: [],
    };
  },
  watch: {
    query_fields: {
      handler(val) {
        this.initData();
      },
      deep: true,
    },
  },
  created() {
    this.initData();
  },
  mounted() {},
  methods: {
    registerShape() {
      let c = 0;
      const CubeLeft = echarts.graphic.extendShape({
        shape: {
          x: 0,
          y: 0,
        },
        buildPath: function (ctx, shape) {
          const xAxisPoint = shape.xAxisPoint;
          const c0 = [shape.x + c, shape.y];
          const c1 = [shape.x - 8 + c, shape.y - 8];
          const c2 = [xAxisPoint[0] - 8 + c, xAxisPoint[1] - 8];
          const c3 = [xAxisPoint[0] + c, xAxisPoint[1]];
          ctx.moveTo(c0[0], c0[1]).lineTo(c1[0], c1[1]).lineTo(c2[0], c2[1]).lineTo(c3[0], c3[1]).closePath();
        },
      });
      const CubeRight = echarts.graphic.extendShape({
        shape: {
          x: 0,
          y: 0,
        },
        buildPath: function (ctx, shape) {
          const xAxisPoint = shape.xAxisPoint;
          const c1 = [shape.x + c, shape.y];
          const c2 = [xAxisPoint[0] + c, xAxisPoint[1]];
          const c3 = [xAxisPoint[0] + 13 + c, xAxisPoint[1] - 4];
          const c4 = [shape.x + 13 + c, shape.y - 4];
          ctx.moveTo(c1[0], c1[1]).lineTo(c2[0], c2[1]).lineTo(c3[0], c3[1]).lineTo(c4[0], c4[1]).closePath();
        },
      });
      const CubeTop = echarts.graphic.extendShape({
        shape: {
          x: 0,
          y: 0,
        },
        buildPath: function (ctx, shape) {
          const c1 = [shape.x + c, shape.y];
          const c2 = [shape.x + 13 + c, shape.y - 4];
          const c3 = [shape.x + 5 + c, shape.y - 12];
          const c4 = [shape.x - 8 + c, shape.y - 8];
          ctx.moveTo(c1[0], c1[1]).lineTo(c2[0], c2[1]).lineTo(c3[0], c3[1]).lineTo(c4[0], c4[1]).closePath();
        },
      });
      echarts.graphic.registerShape('CubeLeft0', CubeLeft);
      echarts.graphic.registerShape('CubeRight0', CubeRight);
      echarts.graphic.registerShape('CubeTop0', CubeTop);
    },
    gerateSeries(data,index=0) {
      // 柱身颜色
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
            { offset: 1, color: '#00c2ff33' },
          ],
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
            { offset: 1, color: '#FF8A0033' },
          ],
        },
      ];
      // 柱头部颜色
      let colors_top = [
        '#A5FFFF','#FCFF6C'
      ]
      return [
        {
          type: 'custom',
          name: '',
          renderItem: (params, api) => {
            const value = api.value(1);
            if (value === 0) {
              return { type: 'group', children: [] }; // 返回一个空的 group，不绘制任何图形
            }
            const location = api.coord([api.value(0), api.value(1)]);
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
                    xAxisPoint: api.coord([api.value(0), 0]),
                  },
                  style: {

                    fill:colors[index]
                  },
                },
                {
                  type: `CubeRight${index}`,
                  shape: {
                    api,
                    xValue: api.value(0),
                    yValue: api.value(1),
                    x: location[0],
                    y: location[1],
                    xAxisPoint: api.coord([api.value(0), 0]),
                  },
                  style: {
                    fill:colors[index]
                  },
                },
                {
                  type: `CubeTop${index}`,
                  shape: {
                    api,
                    xValue: api.value(0),
                    yValue: api.value(1),
                    x: location[0],
                    y: location[1],
                    xAxisPoint: api.coord([api.value(0), 0]),
                  },
                  style: {
                    fill:colors_top[index]
                  },
                },
              ],
            };
          },
          data: data.map((item) => {
            return {
              value: item,
              itemStyle: { color: colors[index] },
            };
          }),
        },
      ];
    },
    initData() {


      let { sysCompanyUuid, year,isStatisticsChildNode } = this.query_fields;
      post('/tpm-act-sectioninfo/v1/statisticsProjectStageCnt',{
        sysCompanyUuid:sysCompanyUuid,
        isStatisticsChildNode:isStatisticsChildNode,
        year:moment(year).format('YYYY'),
      }).then(res=>{
        let data = {
          xData: res.data.map((item, i)=>{
            return item.name
          }),
          yData: res.data.map(item => item.value),
        };
        this.xData = data.xData;
        this.registerShape();
        this.series = []
        let item_s = this.gerateSeries(data.yData);
        this.series.push(...item_s);



        this.$nextTick(() => {
          this.$refs.barChart.initChart();
        });
      })
      .catch(err=>{
        console.log(err,'获取数据失败')
      })
    },
  },
};
</script>

<style lang="less" scoped>
.bar-container {
  height: 100%;
  width: 100%;
}
</style>
