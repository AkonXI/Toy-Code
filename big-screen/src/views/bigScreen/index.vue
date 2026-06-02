<!-- eslint-disable vue/multi-word-component-names -->
<!-- 大屏-->
<template>
  <screenTitle
    @queryChange="queryChange"
    :showDatePicker="type === 1 || type === 2"
    :screenTitle="screenTitle"
  >
    <div class="screen-contain">
      <!-- 左导航 -->
      <div class="l-d">
        <leftNav @menuChange="menuChange"></leftNav>
      </div>
      <!-- 右内容 -->
      <div class="r-d">
        <topic-three v-if="type === 1" :query_fields="query_fields"></topic-three>
        <topic-four v-if="type === 2" :query_fields="query_fields"></topic-four>
        <topic-two v-if="type === 3" :query_fields="query_fields" />
        <topic-one v-if="type === 4" :query_fields="query_fields" />
      </div>
    </div>
  </screenTitle>
</template>
<script>
import moment from 'moment'
import screenTitle from '@/views/bigScreen/screenTitle'
import { autofitMixins } from '@/mixins/autofitMixins'
import leftNav from '@/views/bigScreen/leftNav/index'
import TopicFour from '@/views/bigScreen/topic4/riskScreen'
import TopicOne from '@/views/bigScreen/topic1/index.vue'
import TopicTwo from '@/views/bigScreen/topic2/index.vue'
import TopicThree from '@/views/bigScreen/topic3/index.vue'

export default {
  mixins: [autofitMixins],
  components: {
    screenTitle,
    leftNav,
    TopicFour,
    TopicOne,
    TopicTwo,
    TopicThree
  },
  data() {
    return {
      type: 2,
      screenTitle: '数据可视化大屏',
      query_fields: {
        year: moment(new Date()).format('YYYY'),
        sysCompanyUuid: this.$store.state.user.userInfo.companyuuid ?? ''
      }
    }
  },
  created() {
    document.title = this.screenTitle
  },
  mounted() {},
  methods: {
    menuChange(type, info) {
      this.type = type
      this.screenTitle = info.name
    },
    queryChange(query_fields) {
      this.query_fields = query_fields
    }
  }
}
</script>
<style scoped lang="less">
.screen-contain {
  width: 100%;
  height: 100%;
  display: flex;

  .r-d {
    flex: 1;
    min-width: 200px;
  }
}
</style>
