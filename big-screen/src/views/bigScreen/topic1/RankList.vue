<template>
  <div class="bottom-list">
    <div class="no-data" v-if="list.length === 0">
      <img src="@/assets/bigScreen/no-data.png" alt="" />
      <p>暂无数据</p>
    </div>
    <vue-seamless-scroll
      @ScrollEnd="scrollEnd"
      v-else
      :data="list"
      :key="rdmk"
      :class-option="classOption"
      class="wrap"
    >
      <ul>
        <li class="item-list" v-for="(item, index) in list" :key="index">
          <div class="left-d">
            <div class="item-icon" :class="'item-' + index">{{ index + 1 }}</div>
            <div class="item-title basis-[30%] font-fff">{{ item.itemName }}</div>
          </div>
          <div class="basis-[30%]">{{ item.orgName }}</div>
          <div class="item-num font-fff">{{ Math.floor(Math.random() * 500) + 50 }}次</div>
        </li>
      </ul>
    </vue-seamless-scroll>
  </div>
</template>
<script>
import { post } from '@/utils/request'
import vueSeamlessScroll from 'vue-seamless-scroll'
export default {
  components: {
    vueSeamlessScroll
  },

  data() {
    return {
      rdmk: Math.random(),
      classOption: { limitMoveNum: 999, autoPlay: false },
      list: [],
      statisticsTimeRange: 'year'
    }
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
  methods: {
    calcLimit() {
      const wrap = this.$el?.querySelector?.('.wrap')
      if (wrap) {
        const itemHeight = 37
        this.classOption.limitMoveNum = Math.floor(wrap.clientHeight / itemHeight)
      }
    },
    scrollEnd() {
      this.classOption.autoPlay = false
      setTimeout(() => {
        this.rdmk = Math.random()
        this.classOption.autoPlay = true
      }, 3000)
    },
    initData() {
      this.classOption.autoPlay = false
      this.rdmk = Math.random()
      post('/tpm-bd-screen/v1/queryExpertRankingInfo', {
        extendProps: {},
        sysCompanyUuid: this.query_fields.sysCompanyUuid,
        isStatisticsChildNode: this.query_fields.isStatisticsChildNode
      })
        .then((res) => {
          if (res?.data) {
            this.list = res.data?.dataList?.map((item, index) => {
              return {
                ...item,
                name: item.itemName,
                itemName: item.itemName,
                orgName: item.orgName
              }
            })
            this.$nextTick(() => {
              this.calcLimit()
              this.classOption.autoPlay = this.list.length > this.classOption.limitMoveNum
            })
          } else {
            this.list = []
          }
        })
        .catch((err) => {
          console.log(err, '获取数据失败')
        })
    }
  }
}
</script>
<style scoped lang="less">
.bottom-list {
  height: 100%;

  .no-data {
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
  }
}

.wrap {
  height: 100%;
  overflow: hidden;
}

.item-list {
  display: flex;
  height: 29px;
  border-radius: 4px;

  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-left: 17px;

  &:nth-child(even) {
    background-color: rgba(0, 131, 230, 0.1);
  }

  .left-d {
    display: flex;
    flex: 1;
    min-width: 70px;
    align-items: center;
  }

  .item-icon {
    width: 19px;
    height: 19px;
    background: #024997;
    border-radius: 2px;

    display: grid;
    place-items: center;

    color: #fff;
    font-size: 12px;

    margin-right: 28px;
  }

  .item-0 {
    background: linear-gradient(147deg, #ffd952 7.9%, #f37500 80.54%);
  }

  .item-1 {
    background: linear-gradient(136deg, #d0d0d0 3.55%, #6e7275 92.97%);
  }

  .item-2 {
    background: linear-gradient(142deg, #a49e6a 3.17%, #825e03 90.35%);
  }

  .font-fff {
    color: #fff;
    font-size: 16px;
  }

  .item-num {
    width: 50px;
  }

  .item-title {
    flex: 1;
    min-width: 60px;

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    word-break: break-all;
  }

  .item-rate {
    font-size: 16px;
    color: #fff;
    font-style: normal;

    display: flex;
    align-items: center;
    gap: 10px;

    .up {
      color: rgb(245, 34, 45);
    }

    .down {
      color: rgb(15, 221, 18);
    }
  }
}
</style>
