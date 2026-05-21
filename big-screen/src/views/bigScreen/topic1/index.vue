<template>
  <div class="flex w-full h-full px-[20px] pb-[20px]">
    <div class="h-full w-[25%] pr-[12px]">
      <div class="w-full h-[25%] pb-[12px]">
        <ItemWrap>
          <div class="flex justify-between items-center h-full">
            <div class="w-[30%] relative" v-for="(i, index) in expertNumList" :key="index">
              <div class="absolute top-0 w-full">
                <div class="w-full text-[#fff] text-center text-[16px]">{{ i.title }}</div>
                <div class="w-full text-[#fff] text-center text-[30px] font-bold">{{ i.num }}</div>
              </div>
              <img class="w-full h-full" src="@/assets/bigScreen/bottom-bg.png" alt="">
            </div>
          </div>
        </ItemWrap>
      </div>
      <div class="w-full h-[75%] ">
           <ItemWrap :topL="false" title="人员排行">
          <rank-list :query_fields="query_fields" />
        </ItemWrap>
      </div>
    </div>
    <div class="h-full flex-1">
      <div class="w-full h-[50%] pb-[12px]">
          <ItemWrap :topL="false" title="部门分布情况">
          <dept-bar :query_fields="query_fields" :id="'expertbar'" :yAxisName="'人'" ref="expertbar">
          </dept-bar>
        </ItemWrap>
      </div>
      <div class="w-full h-[50%] flex">
        <div class="flex-1 pr-[12px]">
          <ItemWrap :topL="false" title="属性分布">
            <attr-3-d-pie :query_fields="query_fields" :id="'attr3d'" dimension="1" ref="attr3d">
            </attr-3-d-pie>
          </ItemWrap>
        </div>
        <div class="flex-1 pr-[12px]">
          <ItemWrap :topL="false" title="领域分布">
            <field-pie :query_fields="query_fields" :id="'fieldpie'" ref="fieldpie"> </field-pie>
          </ItemWrap>
        </div>
        <div class="flex-1">
          <ItemWrap :topL="false" title="性别分布">
            <gender-pie :query_fields="query_fields" :id="'genderpie'" ref="genderpie">
            </gender-pie>
          </ItemWrap>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import ItemWrap from '../com/ItemWrap/ItemWrap.vue';
import RankList from './RankList.vue';
import DeptBar from './DeptBar.vue';
import Attr3DPie from './3DPie.vue';
import FieldPie from './ExpertFieldPie.vue';
import GenderPie from './GenderPie.vue';
import { post } from '@/utils/request';

export default {
  components: {
    ItemWrap,
    RankList,
    DeptBar,
    Attr3DPie,
    FieldPie,
    GenderPie
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
      expertNumList: [
      ]
    }
  },
  mounted() {
    this.initData()
  },
  watch: {
    query_fields: {
      handler(val) {
        this.initData();
      },
      deep: true,
    },
  },
  methods: {
    async initData() {
      try {

        const res = await post('/tpm-bd-screen/v1/queryAllExpertInfo', {
          sysCompanyUuid: this.query_fields.sysCompanyUuid,
          isStatisticsChildNode: this.query_fields.isStatisticsChildNode,
          "extendProps": {}
        })
        this.expertNumList = res?.data?.dataList.map((item, index) => {
          return {
            num: item.itemNum,
            title: item.itemName
          }
        })
      } catch (err) {

      }
    }

  }
}
</script>

<style lang="less" scoped></style>
