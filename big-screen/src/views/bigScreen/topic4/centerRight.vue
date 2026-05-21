<!--
    @desc: 各阶段占比
-->
<template>
  <div class="pie-container">
    <div class="top-query">
      <a-radio-group v-model="statisticsTimeRange" @change="comChange">
        <a-radio-button value="year"> 本年</a-radio-button>
        <a-radio-button value="month"> 本月</a-radio-button>
      </a-radio-group>
    </div>
    <div class="no-data" v-if="echartsData.length===0">
      <img src="@/assets/bigScreen/no-data.png" alt="">
      <p>暂无数据</p>
    </div>
    <pie-charts v-else roseType :centerX="'30%'" :unit="''" :echartsData="echartsData" :id="'risk-center'" ref="Chart"></pie-charts>
  </div>
</template>

<script>
import PieCharts from '../com/PieCharts.vue';
import { ROSE_COLORS } from '../com/colors';
import { post } from '@/utils/request'

export default {
  components: {
    PieCharts,
  },
  props:{
      query_fields:{
          type: Object,
          default: () => {
              return {
                  sysCompanyUuid:'',
              }
          }
      }
  },
  data() {
    return {
      echartsData: [],
      statisticsTimeRange: 'year',
    };
  },
  watch:{
      query_fields:{
          handler(val){
              this.initData()
          },
          deep:true
      }
  },
  created() {
    this.initData();
  },
  mounted() {},
  methods: {
    comChange(e) {
      this.statisticsTimeRange = e.target.value;
      this.initData();
    },
    initData() {
      post('/tpm-warn-record/v1/statisticsRateByStage', {
        sysCompanyUuid:this.query_fields.sysCompanyUuid,
        isStatisticsChildNode:this.query_fields.isStatisticsChildNode,
        statisticsTimeRange:this.statisticsTimeRange
      }).then((res) => {
        if(res?.data?.length>0){
          let data = res.data.filter(item => item.value > 0);
          if(!data.length) return
          this.echartsData = data.map((item, i) => {
            return {
              ...item,
              name: item.name,
              itemStyle: {
                color: ROSE_COLORS[i],
              },
            };
          });

          this.$nextTick(() => {
            this.$refs.Chart.initChart();
          });
        }else{
          this.echartsData = []
        }

      })
      .catch(err=>{
        console.log(err,'获取数据失败')
      })
    },
  },
};
</script>

<style lang="less" scoped>
.pie-container {
  height: 100%;
  width: 100%;

  .no-data{
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
