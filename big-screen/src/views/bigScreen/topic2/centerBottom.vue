<template>
  <div class="flex size-full">
    <div class="w-1/2 h-full">
      <DashBoardCharts :max="100" ref="ChartLeft" :source="ChartLeftData" id="left">
      </DashBoardCharts>
    </div>
    <div class="w-1/2 h-full">
      <DashBoardCharts :max="100" ref="ChartRight" :source="ChartRightData" id="right">
      </DashBoardCharts>
    </div>
  </div>
</template>

<script setup>
import { post } from '@/utils/request'
import { ref, nextTick, watch, onMounted } from 'vue'
import DashBoardCharts from './Charts/Dashboard.vue'
import moment from 'moment'
const ChartLeft = ref()
const ChartRight = ref()
const ChartLeftData = ref([])
const ChartRightData = ref([])
const props = defineProps({
  query_fields: {
    type: Object,
    default: () => {
      return {
        year: moment(new Date()).format('YYYY'),
        sysCompanyUuid: ''
      }
    }
  }
})
const initData = async () => {
  try {
    const res = await post('/tpm-bd-screen/v1/queryInfoMiddleDown', {
      extendProps: {},
      sysCompanyUuid: props.query_fields.sysCompanyUuid,
      isStatisticsChildNode: props.query_fields.isStatisticsChildNode
    })
    console.log(res)
    ChartLeftData.value = [res?.data?.dataList?.[0]].map((item, index) => {
      return {
        name: item.itemName,
        num: item.itemNum,
        value: item.percent
      }
    })
    ChartRightData.value = [res?.data?.dataList?.[1]].map((item, index) => {
      return {
        name: item.itemName,
        num: item.itemNum,
        value: item.percent
      }
    })
  } catch (err) {
    console.log(err)

    ChartLeftData.value = ChartRightData.value = null
  }

  nextTick(() => {
    ChartLeft.value?.initChart()
    ChartRight.value?.initChart()
  })
}
watch(
  props.query_fields,
  () => {
    initData()
  },
  { deep: true }
)
onMounted(() => {
  initData()
})
</script>

<style lang="less" scoped></style>
