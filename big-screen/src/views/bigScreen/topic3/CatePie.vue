<!--
    @desc: CatePie
-->
<template>
  <div class="pie-container">
    <div class="no-data" v-if="echartsData.length === 0">
      <img src="@/assets/bigScreen/no-data.png" alt="" />
      <p>暂无数据</p>
    </div>
    <template v-else>
      <div class="back-btn">
        <img src="@/assets/bigScreen/back-img.png" alt="" @click="backClick" />
      </div>
      <pie-charts :id="'risk-center'" ref="Chart"></pie-charts>
    </template>
  </div>
</template>

<script>
import PieCharts from './charts/PieCharts.vue'
import { ROSE_COLORS } from '../com/colors'
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
      echartsData: []
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
    initData() {
      let { sysCompanyUuid, year, isStatisticsChildNode } = this.query_fields
      post('/tpm-act-sectioninfo/v1/statisticsProcurementCategory', {
        sysCompanyUuid: sysCompanyUuid,
        year: moment(year).format('YYYY'),
        isStatisticsChildNode: isStatisticsChildNode
      })
        .then((res) => {
          this.echartsData = res.data.map((item, i) => {
            return {
              ...item,
              name: item.name,
              itemStyle: {
                color: ROSE_COLORS[i]
              }
            }
          })
          this.$nextTick(() => {
            this.$refs.Chart.initChart(this.echartsData)
          })
        })
        .catch((err) => {
          console.log(err, '获取数据失败')
        })
    },
    backClick() {
      this.$refs.Chart.initChart(this.echartsData)
    }
  }
}
</script>

<style lang="less" scoped>
.pie-container {
  height: 100%;
  width: 100%;
  position: relative;

  .no-data {
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
  }
  .back-btn {
    position: absolute;
    z-index: 9;

    img {
      width: 30px;
      cursor: pointer;
    }
  }
}
</style>
