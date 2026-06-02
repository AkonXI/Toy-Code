<template>
  <div class="grid grid-cols-3 grid-rows-2 size-full">
    <div class="h-full flex justify-center items-center" v-for="item in data" :key="item.name">
      <div class="h-[80%] aspect-square relative">
        <span
          class="w-[6em] absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center text-[16px]"
        >
          <div class="text-center h-[2em] leading-4">{{ item.name }}</div>
          <span class="font-[D-DIN-PRO] text-[30px]">
            {{ item.value }}
          </span>
        </span>
        <img class="w-full h-full" src="@/assets/bigScreen/bottom-bg.png" alt="" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { post } from '@/utils/request'
import moment from 'moment'
const data = ref([])
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
const initData = () => {
  post('/tpm-bd-screen/v1/queryInfoLeftUp', {
    extendProps: {},
    queryDate: '',
    sysCompanyUuid: props.query_fields.sysCompanyUuid,
    isStatisticsChildNode: props.query_fields.isStatisticsChildNode
  })
    .then((res) => {
      if (res?.data?.dataList?.length > 0) {
        data.value = res.data.dataList.map((item, index) => {
          return {
            name: item.itemName,
            value: item.itemNum
          }
        })
        console.log(data.value)
      } else {
        data.value = []
      }
    })
    .catch((err) => {
      console.log(err, '获取数据失败')
    })
}
watch(
  () => props.query_fields,
  (value) => {
    console.log(value)
    initData()
  },
  { deep: true, immediate: true }
)
</script>

<style lang="less" scoped></style>
