<template>
  <div class="relative size-full">
    <div class="top-query bottom-full">
      <a-space>
        <a-radio-group v-model="typeRadio" @change="typeRadioChange">
          <a-radio-button value="1">年</a-radio-button>
          <a-radio-button value="2">季度</a-radio-button>
          <a-radio-button value="3">月</a-radio-button>
        </a-radio-group>
        <a-select :dropdownMenuStyle="{ fontSize: '12px', width: '120px' }" @change="typeRadioChange"
          v-model="selectData">
          <a-select-option value="1">指标一</a-select-option>
          <a-select-option value="2">指标二</a-select-option>

        </a-select>
      </a-space>
    </div>
    <div class="bar-container py-4">
      <bar-charts splitLineType="dashed" class="flex-1" :legend="false"
        :tooltipFormatter="({ name, value }) => `样本数据：${value[1]}${selectData == 1 ? '万元' : '个'}`" :source="source"
        :series="series" :id="'centerTop'" :yAxisName="selectData == 1 ? '万元' : '个'" ref="barChart"></bar-charts>
    </div>
  </div>
</template>


<script>
import moment from 'moment';
import BarCharts from '../com/BarCharts.vue';
import { post } from '@/utils/request';
import * as echarts from 'echarts';
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
      typeRadio: '1',
      xAxisData: [],
      data: [],
      selectData: '1',
      legend_data: [],
      series: [],
      source: [],
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
  mounted() { },
  methods: {
    typeRadioChange(e) {
      this.initData();
      this.$refs.barChart.resize()
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
            { offset: 1, color: '#00c2ff33' },
          ],
        },
      ];

      this.series = [];
      try {
        const res = await post('/tpm-bd-screen/v1/queryInfoMiddleUp', {
          "dimension": this.selectData,
          "extendProps": {},
          timeType: this.typeRadio,
          sysCompanyUuid: this.query_fields.sysCompanyUuid,
          isStatisticsChildNode: this.query_fields.isStatisticsChildNode,
        })

        if (res?.data?.dataList?.length > 0) {
          this.source = res.data.dataList.map((item, index) => {
            return [item.itemName, item.itemNum]
          });

        } else {
          this.source = [];
        }
      } catch (err) {
        this.source = []
      }

      for (let i = 0; i < this.source[0].length - 1; i++) {
        this.series.push({
          type: 'line',
          color: colors[i],
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 1, 0, 0, [
              {
                offset: 0,
                color: 'rgba(77, 119, 255, 20%)'
              },
              {
                offset: 1,
                color: 'rgba(77, 119, 255 ,100%)'
              }

            ])
          },
          barWidth: '16px',
          itemStyle: {
            borderRadius: [15, 15, 0, 0],
          },
        });
      }

      this.$nextTick(() => {
        this.$refs.barChart.initChart();
      });
    },
  },
};
</script>

<style lang="less" scoped>
.bar-container {
  height: 100%;
  width: 100%;
}

.top-query {
  position: absolute;
  right: 0;

  /deep/ .ant-select-selection {
    background-color: transparent;
    width: 120px;
    color: white;

    .anticon {
      color: white;
    }
  }

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
