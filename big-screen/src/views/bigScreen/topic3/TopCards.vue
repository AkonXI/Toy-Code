<template>
  <div class="card-c">
    <div class="card-c-list">
      <div class="card-c-list-item" v-for="(item, index) in list" :key="index">
        <div class="left-d">
          <div class="left-d-title">{{ item.title }}</div>
          <div class="left-d-deci">{{ item.value }}</div>
        </div>
        <div class="right-d" v-if="query_fields.year">
          同比：
          <img
            class="item-icon"
            v-if="item.trend === 'up'"
            src="@/assets/bigScreen/up.png"
            alt=""
          />
          <img class="item-icon" v-else src="@/assets/bigScreen/down.png" alt="" />
          <span class="rate" :class="item.trend">{{ item.rate }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import { post } from '@/utils/request'
import moment from 'moment'
export default {
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
    return {
      list: []
    }
  },
  created() {
    this.initData()
  },
  watch: {
    query_fields: {
      handler(val) {
        this.initData()
      },
      deep: true
    }
  },
  methods: {
    initData() {
      let { sysCompanyUuid, year, isStatisticsChildNode } = this.query_fields
      post('/tpm-act-sectioninfo/v1/statisticsTopProjectCard', {
        sysCompanyUuid: sysCompanyUuid,
        isStatisticsChildNode: isStatisticsChildNode,
        year: moment(year).format('YYYY')
      }).then((res) => {
        this.list = res.data.map((item, index) => {
          return {
            ...item,
            name: item.name,
            title: item.title
          }
        })
      })
    }
  }
}
</script>
<style scoped lang="less">
.card-c {
  display: flex;
  height: 100%;
}
.card-c-list {
  display: flex;
  width: 100%;
  justify-content: space-between;
  height: 100%;
  align-items: center;
  gap: 26px;
  .card-c-list-item {
    width: 25%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 26px 30px;

    background: url('@/assets/bigScreen/p-card-bg.png') no-repeat;
    background-size: 100% 100%;

    .right-d {
      color: #ffffffd9;
      font-family: 'Helvetica Neue';
      font-size: 16px;

      display: flex;
      align-items: center;
    }

    .rate.up {
      color: #eb5757;
    }
    .rate.down {
      color: #0fdd12;
    }
  }
  .left-d-title {
    color: rgb(255, 255, 255);
    font-family: 'DingTalk JinBuTi';
    font-size: 14px;
  }
  .left-d-deci {
    color: rgb(11, 249, 254);
    text-shadow: 0 0 3px #52c5f4;
    font-family: 'YouSheBiaoTiHei';
    font-size: 32px;
    font-weight: 400;
  }
  .item-icon {
    width: 12px;
  }
}
</style>
