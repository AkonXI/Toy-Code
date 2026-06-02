<!--
    @desc: NaturePie
-->
<template>
  <div class="pie-container">
    <div class="no-data" v-if="echartsData.length === 0">
      <img src="@/assets/bigScreen/no-data.png" alt="" />
      <p>暂无数据</p>
    </div>
    <pie-charts v-else :echartsData="echartsData" :id="'nature-pie'" ref="Chart"></pie-charts>
  </div>
</template>

<script>
import PieCharts from './charts/ProjectNaturePie.vue'
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
      post('/tpm-act-sectioninfo/v1/statisticsProjectNature', {
        sysCompanyUuid: sysCompanyUuid,
        isStatisticsChildNode: isStatisticsChildNode,
        year: moment(year).format('YYYY')
      })
        .then((res) => {
          let data = res.data.filter((item) => {
            if (Number(item.value)) {
              return item
            }
          })
          this.echartsData = []
          this.echartsData = data.map((item, i) => {
            return {
              ...item,
              name: item.name,
              itemStyle: {
                color: ROSE_COLORS[i]
              }
            }
          })
          this.$nextTick(() => {
            this.$refs.Chart?.initChart()
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
}
</style>
