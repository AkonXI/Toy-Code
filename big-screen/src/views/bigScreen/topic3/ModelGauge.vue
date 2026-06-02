<!--
    @desc: ModelGauge
-->
<template>
  <div class="pie-container">
    <div class="top-query">
      <a-radio-group v-model="type" @change="comChange">
        <a-radio-button value="01">模式一</a-radio-button>
        <a-radio-button value="02">模式二</a-radio-button>
      </a-radio-group>
    </div>
    <div class="no-data" v-if="echartsData.length === 0">
      <img src="@/assets/bigScreen/no-data.png" alt="" />
      <p>暂无数据</p>
    </div>
    <pie-charts v-else :echartsData="echartsData" :id="'model-pie'" ref="Chart"></pie-charts>
  </div>
</template>

<script>
import PieCharts from './charts/ProcurementModelGauge.vue'
import { post } from '@/utils/request'
import moment from 'moment'
export default {
  components: {
    PieCharts
  },
  props: {
    query_fields: {
      type: Object,
      default: () => {
        return {
          sysCompanyUuid: '',
          year: moment(new Date()).format('YYYY')
        }
      }
    }
  },
  data() {
    return {
      echartsData: {},
      type: '01'
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
    comChange(e) {
      this.type = e.target.value
      this.initData()
    },
    initData() {
      this.echartsData = {}

      let { sysCompanyUuid, year, isStatisticsChildNode } = this.query_fields
      post('/tpm-act-sectioninfo/v1/statisticsProcurementModelDesign', {
        sysCompanyUuid: sysCompanyUuid,
        isStatisticsChildNode: isStatisticsChildNode,
        year: moment(year).format('YYYY'),
        type: this.type
      })
        .then((res) => {
          let data = res.data[0]
          data.percent = data.percent.replace('%', '')
          this.echartsData = { ...data }
          this.$nextTick(() => {
            this.$refs.Chart.initChart()
          })
        })
        .catch((err) => {
          console.log(err, '获取数据失败')
        })
    }
  }
}
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

  .top-query {
    position: absolute;
    top: 4px;
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
}
</style>
