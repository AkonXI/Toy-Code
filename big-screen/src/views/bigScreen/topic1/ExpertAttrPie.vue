<template>
  <pie-charts
    v-if="echartsData.length"
    showBg
    hideLegend
    :padAngle="2"
    :itemBorderWidth="10"
    :colors="ROSE_COLORS"
    showPieLabel
    :labelFormatter="labelFormatter"
    :radiusInner="'52%'"
    :radiusOuter="'60%'"
    :zoom="0.55"
    titleTextAlign=""
    :centerX="'50%'"
    :unit="'项'"
    :showRate="false"
    :echartsData="echartsData"
    :id="id"
    ref="Chart"
  />
</template>

<script>
import PieCharts from '../com/PieCharts.vue';
import { ROSE_COLORS } from '../com/colors';
import { post } from '@/utils/request';

export default {
  components: { PieCharts },
  props: {
    query_fields: { type: Object, default: () => ({ year: '', sysCompanyUuid: '' }) },
    id: { type: String, default: '' },
  },
  data() {
    return {
      echartsData: [],
      ROSE_COLORS,
    };
  },
  methods: {
    labelFormatter({ data }) {
      return `{total|${data.name}}\n{text|${data.value}项}`
    },
    async initData() {
      const res = await post('/tpm-bd-screen/v1/queryExpertTypeInfo', {
        dimension: '1',
        extendProps: {},
        sysCompanyUuid: this.query_fields.sysCompanyUuid,
        isStatisticsChildNode: this.query_fields.isStatisticsChildNode,
      })
      this.echartsData = res.data.dataList.map(v => ({
        name: v.itemName,
        value: v.itemNum,
      }))
      this.$nextTick(() => {
        this.$refs.Chart?.initChart();
      })
    },
  },
  watch: {
    query_fields: { handler() { this.initData() }, deep: true },
  },
  mounted() {
    this.initData();
  },
};
</script>
