<template>
  <div class="bottom-list">
    <div class="top-query">
      <a-radio-group v-model="statisticsTimeRange" @change="comChange">
        <a-radio-button value="year"> 本年</a-radio-button>
        <a-radio-button value="month"> 本月</a-radio-button>
      </a-radio-group>
    </div>
    <div class="no-data" v-if="list.length === 0">
      <img src="@/assets/bigScreen/no-data.png" alt="">
      <p>暂无数据</p>
    </div>
    <vue-seamless-scroll v-else :data="list" :key="rdmk" :class-option="classOption" class="wrap">
      <ul>
        <li class="item-list" v-for="(item, index) in list" :key="index">
          <div class="left-d">
            <div class="item-icon" :class="'item-' + index">{{ index + 1 }}</div>
            <div class="item-title font-fff">{{ item.title }}</div>
          </div>
          <div class="item-num font-fff">{{ item.value }}</div>
          <div class="item-rate">
            <span font-fff>同比</span>
            <span>
              <img v-if="item.trend === 'up'" style="width: 12px;" src="@/assets/bigScreen/up.png" alt="">
              <img v-else style="width: 12px;" src="@/assets/bigScreen/down.png" alt="">
            </span>
            <span :class="item.trend">{{ item.rate }}</span>
          </div>
        </li>
      </ul>
    </vue-seamless-scroll>
  </div>
</template>
<script>
import { post } from '@/utils/request';
import vueSeamlessScroll from 'vue-seamless-scroll';
export default {
  components: {
    vueSeamlessScroll,
  },

  data() {
    return {
      rdmk: Math.random(),
      classOption: { limitMoveNum: 999, autoPlay: false },
      list: [],
      statisticsTimeRange: 'year',
    };
  },
  created() {
    this.initData();
  },
  methods: {
    calcLimit() {
      const wrap = this.$el?.querySelector?.('.wrap');
      if (wrap) {
        const itemHeight = 37;
        this.classOption.limitMoveNum = Math.floor(wrap.clientHeight / itemHeight);
      }
    },
    comChange(e) {
      this.statisticsTimeRange = e.target.value;
      this.initData();
    },
    initData() {
      this.classOption.autoPlay = false
      post('/tpm-warn-record/v1/statisticsRecordGroupByCompany', {
        statisticsTimeRange: this.statisticsTimeRange
      }).then(res => {
        if (res?.data?.length > 0) {
          this.list = res.data.map((item, index) => {
            return {
              ...item,
              name: item.name,
              title: item.title
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
        .catch(err => {
          console.log(err, '获取数据失败')
        })
    },
  },
};
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

.top-query {
  position: absolute;
  top: 4px;
  right: 0;

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
    width: 120px;
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
      color: rgb(15, 221, 18);    }
  }
}
</style>