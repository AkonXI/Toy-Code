<template>
  <div class="grid size-full gap-[18px] p-[18px] grid-cols-7 grid-rows-3">
    <!-- 左上 -->
    <div class="row-span-1 col-span-2">
      <ItemWrap :topL="false">
        <leftTop :query_fields="query_fields"></leftTop>
      </ItemWrap>
    </div>

    <!-- 中上 -->
    <div class="row-span-1 col-span-3">
      <ItemWrap :topL="false" title="分类统计一" :itemStyle="{ background: `url(${backgroundImage_bg}) no-repeat` }">
        <centerTop :query_fields="query_fields"></centerTop>
      </ItemWrap>
    </div>
    <!-- 右上 -->
    <div class="row-span-1 col-span-2">
      <ItemWrap :topL="false" title="分类统计二" :itemStyle="{ background: `url(${backgroundImage_bg}) no-repeat` }">
        <rightTop :query_fields="query_fields"></rightTop>
      </ItemWrap>
    </div>

    <!-- 左下 -->
    <div class="row-span-2 col-span-2">
      <ItemWrap :topL="false" :itemStyle="{ background: `url(${backgroundImage_bg}) no-repeat` }">
        <leftBottom :query_fields="query_fields"></leftBottom>
      </ItemWrap>
    </div>

    <!-- 正中 -->
    <div class="row-span-1 col-span-3">
      <ItemWrap :topL="false" title="分类统计三"
        :itemStyle="{ background: `url(${backgroundImage_bg}) no-repeat` }">
        <Center :query_fields="query_fields"></Center>
      </ItemWrap>
    </div>

    <!-- 正右 -->
    <div class="row-span-1 col-span-2">
      <ItemWrap :topL="false" title="分类统计四" :itemStyle="{ background: `url(${backgroundImage_bg}) no-repeat` }">
        <rightMiddle :query_fields="query_fields"></rightMiddle>
      </ItemWrap>
    </div>

    <!-- 正下 -->
    <div class="row-span-1 col-span-3">
      <ItemWrap :topL="false" title="分类统计五" :itemStyle="{ background: `url(${backgroundImage_bg}) no-repeat` }">
        <centerBottom :query_fields="query_fields"></centerBottom>
      </ItemWrap>
    </div>

    <!-- 右下 -->
    <div class="row-span-1 col-span-2">
      <ItemWrap :topL="false" title="分类统计六" :itemStyle="{ background: `url(${backgroundImage_bg}) no-repeat` }">
        <rightBottom :query_fields="query_fields"></rightBottom>
      </ItemWrap>
    </div>
  </div>
</template>
<script>
import moment from 'moment';
import ItemWrap from '../com/ItemWrap/ItemWrap.vue';
import backgroundImage_bg from '@/assets/bigScreen/box-title-bg.svg';
import leftTop from './leftTop.vue';
import rightTop from './rightTop.vue';
import rightMiddle from './rightMiddle.vue';

import rightBottom from './rightBottom.vue';
import leftBottom from './leftBottom.vue';

import Center from './center.vue';
import centerTop from './centerTop.vue';
import centerBottom from './centerBottom.vue';

export default {
  components: { Center, centerBottom, centerTop, rightMiddle, leftTop, ItemWrap, rightTop, rightBottom, leftBottom },

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
      backgroundImage_bg,
    };
  },
  mounted() {
    console.log(this.query_fields, 'risk');
  },
  methods: {},
};
</script>
<style scoped lang="less">
.risk-con {
  width: 100%;
  height: 100%;
  padding: 0 20px;

  display: flex;
  flex-direction: column;

  /deep/.ant-row {
    height: 100%;
  }

  /deep/.ant-col {
    height: 100%;
  }

  .top-d {
    height: 20%;
  }

  .center-d {
    height: 37%;
  }

  .bottom-d {
    width: 100%;
    flex: 1;
    min-height: 100px;
  }
}

.d-flex {
  display: flex;
  gap: 10px;
}

.space-div {
  margin-bottom: 12px;
}
</style>
