<template>
  <div class="relative size-full">
    <div class="top-query bottom-full">
      <a-space>
        <a-radio-group v-model="typeRadio" @change="typeRadioChange">
          <a-radio-button value="1">类型一</a-radio-button>
          <a-radio-button value="2">类型二</a-radio-button>
        </a-radio-group>
      </a-space>
    </div>
    <div class="pie-container">
      <div class="no-data" v-if="echartsData.length === 0">
        <img src="@/assets/bigScreen/no-data.png" alt="" />
        <p>暂无数据</p>
      </div>
      <pie-charts
        v-else
        showBg
        :customTitle="(total) => `{total|${total}}\n\n{text|总数}`"
        :echartsData="echartsData"
        :id="'right-bottom'"
        ref="Chart"
      ></pie-charts>
    </div>
  </div>
</template>

<script>
import PieCharts from '../com/PieCharts.vue'
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
          year: moment(new Date()).format('YYYY'),
          sysCompanyUuid: ''
        }
      }
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
  data() {
    return {
      typeRadio: '1',
      echartsData: []
    }
  },
  methods: {
    typeRadioChange(e) {
      this.initData()
      this.$refs.Chart.resize()
    },
    async initData() {
      try {
        const res = await post('/tpm-bd-screen/v1/queryInfoRightBottom', {
          dimension: this.typeRadio,
          sysCompanyUuid: this.query_fields.sysCompanyUuid,
          isStatisticsChildNode: this.query_fields.isStatisticsChildNode,
          extendProps: {}
        })
        this.echartsData = []
        this.echartsData = res?.data?.dataList.map((item, i) => {
          return {
            name: item.itemName,
            value: item.itemNum,
            percent: item.percent,
            itemStyle: {
              color: ROSE_COLORS[i]
            }
          }
        })
        this.$nextTick(() => {
          this.$refs?.Chart?.initChart()
        })
      } catch (err) {}
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
