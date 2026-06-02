<template>
  <div class="risk-con">
    <div class="top-d space-div">
      <topCard :query_fields="query_fields"></topCard>
    </div>
    <div class="center-d space-div">
      <a-row :gutter="16">
        <a-col :span="5">
          <ItemWrap :topL="false" :topR="false">
            <centerLeft :query_fields="query_fields"></centerLeft>
          </ItemWrap>
        </a-col>
        <a-col :span="12">
          <ItemWrap :topL="false" title="数据总量统计">
            <centerCenter :query_fields="query_fields"></centerCenter>
          </ItemWrap>
        </a-col>
        <a-col :span="7">
          <ItemWrap :topL="false" :topR="false" title="各阶段占比">
            <centerRight :query_fields="query_fields"></centerRight>
          </ItemWrap>
        </a-col>
      </a-row>
    </div>
    <div class="bottom-d space-div">
      <a-row :gutter="16">
        <a-col :span="17">
          <ItemWrap :topL="false" title="管控信息明细">
            <bottomTable :query_fields="query_fields"></bottomTable>
          </ItemWrap>
        </a-col>

        <a-col :span="7">
          <ItemWrap :topL="false" :topR="false" title="各单位总量统计">
            <bottomList></bottomList>
          </ItemWrap>
        </a-col>
      </a-row>
    </div>
  </div>
</template>
<script>
import moment from 'moment'
import ItemWrap from '../com/ItemWrap/ItemWrap.vue'
import topCard from './topCard.vue'

import bottomTable from './bottomTable.vue'
import bottomList from './bottomList.vue'
import centerLeft from './centerLeft.vue'
import centerRight from './centerRight.vue'
import centerCenter from './centerCenter.vue'

export default {
  components: { ItemWrap, topCard, bottomTable, bottomList, centerLeft, centerCenter, centerRight },
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
  data() {
    return {}
  },
  mounted() {},
  methods: {}
}
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
    height: 17%;
  }
  .center-d {
    height: 33%;
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
