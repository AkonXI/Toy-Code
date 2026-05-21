<template>
  <div class="pie-container">
    <div class="no-data" v-if="echartsData.length === 0">
      <img src="@/assets/bigScreen/no-data.png" alt="" />
      <p>暂无数据</p>
    </div>
    <pie-charts v-else roseType :echartsData="echartsData" :id="'right-middle'" ref="Chart"></pie-charts>
  </div>
</template>

<script>
import PieCharts from '../com/PieCharts.vue';
import { ROSE_COLORS } from '../com/colors';
import { post } from '@/utils/request';
import moment from "moment"

export default {
  components: {
    PieCharts,
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
      echartsData: [],
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
    async initData() {
      try {

        const res = await post('/tpm-bd-screen/v1/queryInfoSupplierRight', {
          dimension: '2',
          sysCompanyUuid: this.query_fields.sysCompanyUuid,
          isStatisticsChildNode: this.query_fields.isStatisticsChildNode,
          "extendProps": {}
        })

        this.echartsData = [];
        this.echartsData = res?.data?.dataList.map((item, i) => {
          return {
            name: item.itemName,
            value: item.itemNum,
            percent: item.percent,
            itemStyle: {
              color: ROSE_COLORS[i],
            },
          };
        });
        this.$nextTick(() => {
          this.$refs.Chart.initChart();
        });
      } catch (err) {

      }
    }
  },
};
</script>

<style lang="less" scoped>
.pie-container {
  height: 100%;
  width: 100%;

  .no-data {
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
  }
}
</style>
