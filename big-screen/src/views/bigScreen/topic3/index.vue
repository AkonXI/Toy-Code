<template>
  <div class="project-doard">
    <div class="space-div first-row">
      <a-row :gutter="16">
        <top-cards :query_fields="query_fields"></top-cards>
      </a-row>
    </div>
    <div class="space-div second-row">
      <a-row :gutter="16">
        <a-col :span="6">
          <ItemWrap :topL="false" :topR="false" title="方式统计一">
            <method-pie :query_fields="query_fields"></method-pie>
          </ItemWrap>
        </a-col>
        <a-col :span="6">
          <ItemWrap :topL="false" :topR="false" title="类型统计一">
            <nature-pie :query_fields="query_fields"></nature-pie>
          </ItemWrap>
        </a-col>
        <a-col :span="5">
          <ItemWrap :topL="false" :topR="false" title="模式统计一">
            <model-gauge :query_fields="query_fields"></model-gauge>
          </ItemWrap>
        </a-col>
        <a-col :span="7">
          <ItemWrap :topL="false" :topR="false" title="模式统计二">
            <sign-pie :query_fields="query_fields"></sign-pie>
          </ItemWrap>
        </a-col>
      </a-row>
    </div>
    <div class="space-div third-row">
      <a-row :gutter="16">
        <a-col :span="6">
          <ItemWrap :topL="false" :topR="false" title="类别统计">
            <cate-pie :query_fields="query_fields"></cate-pie>
          </ItemWrap>
        </a-col>
        <a-col :span="11">
          <ItemWrap :topL="false" :topR="false" title="阶段统计">
            <stage-bar :query_fields="query_fields"></stage-bar>
          </ItemWrap>
        </a-col>
        <a-col :span="7">
          <ItemWrap :topL="false" :topR="false" title="公示列表">
            <public-table :query_fields="query_fields"></public-table>
          </ItemWrap>
        </a-col>
      </a-row>
    </div>
    <div class="space-div last-row">
      <a-row :gutter="16">
        <a-col :span="6">
          <ItemWrap :topL="false" :topR="false" title="整合程度统计">
            <model-pie :query_fields="query_fields"></model-pie>
          </ItemWrap>
        </a-col>
        <a-col :span="18">
          <ItemWrap :topL="false" :topR="false" title="金额统计">
            <amount-bar :query_fields="query_fields"></amount-bar>
          </ItemWrap>
        </a-col>
      </a-row>
    </div>
  </div>
</template>

<script>
import TopCards from './TopCards.vue'
import ItemWrap from '../com/ItemWrap/ItemWrap.vue';

import StageBar from './StageBar.vue';
import AmountBar from './AmountBar.vue';
import PublicTable from './PublicTable.vue';
import CatePie from './CatePie.vue'
import MethodPie from './MethodPie.vue'
import NaturePie from './NaturePie.vue'
import ModelGauge from './ModelGauge.vue'
import ModelPie from './ModelPie.vue'
import SignPie from './SignPie.vue'

  export default {
    props:{
      query_fields:{
          type: Object,
          default: () => {
              return {
                  year: moment(new Date()).format('YYYY'),
                  sysCompanyUuid:'',
              }
          }
      }
    },
    components: {
      ItemWrap,
      TopCards,
      StageBar,
      AmountBar,
      PublicTable,
      CatePie,
      MethodPie,
      NaturePie,
      ModelGauge,
      ModelPie,
      SignPie
    },

    data() {
      return {
        
      }
    },
    mounted() {
      
    },

    methods: {
      
    }
  }
</script>

<style lang="less" scoped>
.project-doard{
  width: 100%;
  height: 100%;
  padding: 0 20px;
  /deep/.ant-row {
    height: 100%;
  }
  /deep/.ant-col {
    height: 100%;
  }

  .space-div {
    margin-bottom: 12px;
  }
}
.first-row{
  height: 100px;
}
.second-row,.third-row,.last-row{
  height: calc(33% - 46px);
}
</style>
