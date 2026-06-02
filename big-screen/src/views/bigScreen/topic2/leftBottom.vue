<template>
  <div class="bottom-list flex flex-col">
    <div class="top-query">
      <div class="flex justify-between pt-3">
        <a-select
          :dropdownMenuStyle="{ fontSize: '12px' }"
          v-model="selectData"
          @change="changeSelect"
          placeholder="排名一"
        >
          <a-select-option value="1">排名一</a-select-option>
          <a-select-option value="2">排名二</a-select-option>
        </a-select>
        <a-radio-group v-model="typeRadio" @change="typeRadioChange">
          <template v-if="selectData == '1'">
            <a-radio-button value="1"> 指标一</a-radio-button>
            <a-radio-button value="2"> 指标二</a-radio-button>
            <a-radio-button value="3"> 指标三 </a-radio-button>
            <a-radio-button value="4"> 指标四</a-radio-button>
          </template>
          <template v-else>
            <a-radio-button value="1"> 统计一 </a-radio-button>
            <a-radio-button value="2"> 统计二</a-radio-button>
          </template>
        </a-radio-group>
      </div>
    </div>
    <div class="no-data" v-if="list.length === 0">
      <img src="@/assets/bigScreen/no-data.png" alt="" />
      <p>暂无数据</p>
    </div>
    <template v-else>
      <vue-seamless-scroll
        @ScrollEnd="scrollEnd"
        :key="rdmk"
        :data="list"
        :class-option="classOption"
        class="wrap px-0 py-2"
      >
        <ul>
          <li class="item-list" v-for="(item, index) in list" :key="index">
            <div class="left-d">
              <div class="item-icon" :class="'item-' + index">{{ index + 1 }}</div>
              <div class="flex-1 w-1">
                <div class="item-title w-full text-[16px] text-white flex justify-between">
                  <span class="flex-1 w-1 overflow-hidden text-ellipsis" :title="item.name">
                    {{ item.name }}
                  </span>
                  <span class="flex-none">{{ item.value }}{{ currentUnit }}</span>
                </div>
                <div class="w-full h-[10px] bg-[#FFFFFF29]">
                  <div
                    class="h-full relative progress"
                    :style="{ width: `${(Number(item.value) / maxProgress) * 100}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </vue-seamless-scroll>
    </template>
  </div>
</template>
<script>
import { post } from '@/utils/request'
import vueSeamlessScroll from 'vue-seamless-scroll'
const ApiMap = {
  1: '/tpm-bd-screen/v1/querySupplierInfoLeftBottom',
  2: '/tpm-bd-screen/v1/queryTenderagentInfoLeftBottom'
}
const unitMap = [
  {
    unit: '个',
    used: [
      ['1', '1'],
      ['2', '2']
    ]
  },
  {
    unit: '万元',
    used: [
      ['1', '2'],
      ['1', '3'],
      ['1', '4']
    ]
  },
  {
    unit: '分',
    used: [['2', '1']]
  }
]
export default {
  components: {
    vueSeamlessScroll
  },

  data() {
    return {
      rdmk: Math.random(),
      selectData: '1',
      classOption: { limitMoveNum: 9, autoPlay: false },
      typeRadio: '1',
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
  computed: {
    currentUnit() {
      return unitMap.find((v) =>
        v.used.find((v) => v[0] == this.selectData && v[1] == this.typeRadio)
      )?.unit
    },
    maxProgress() {
      return this.selectData == '1' && this.typeRadio == '0'
        ? 110
        : Math.max(...this.list.map((v) => Number(v.value))) / 0.9
    }
  },
  created() {
    this.initData()
  },
  methods: {
    typeRadioChange(e) {
      this.list = []
      this.initData()
    },
    scrollEnd() {
      this.classOption.autoPlay = false
      setTimeout(() => {
        this.rdmk = Math.random()
        this.classOption.autoPlay = true
      }, 3000)
    },
    changeSelect() {
      this.typeRadio = '1'
      this.typeRadioChange()
    },
    initData() {
      this.classOption.autoPlay = false
      this.rdmk = Math.random()
      post(ApiMap[this.selectData], {
        dimension: this.typeRadio,
        extendProps: {},
        sysCompanyUuid: this.query_fields.sysCompanyUuid,
        isStatisticsChildNode: this.query_fields.isStatisticsChildNode
      })
        .then((res) => {
          if (res?.data?.dataList?.length > 0) {
            this.list = res.data.dataList.map((item, index) => {
              return {
                name: item.itemName,
                value: item.itemNum
              }
            })
            setTimeout(() => {
              this.classOption.autoPlay = true
            }, 3000)
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

.top-query {
  /deep/ .ant-select-selection {
    background-color: transparent;
    width: 120px;
    color: white;

    .anticon {
      color: white;
    }
  }

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

.progress {
  background: linear-gradient(270deg, #3f95ce 0%, #1ee7e7 100%);

  &::after {
    content: '';
    position: absolute;
    display: inline-block;
    border-left: 2px;
    top: 50%;
    transform: translateY(-50%);
    left: 100%;
    height: 140%;
    border: 2px solid white;
  }
}

.item-list {
  display: flex;
  border-radius: 4px;
  padding: 4px 0;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;

  &:nth-child(even) {
    background-color: rgba(0, 131, 230, 0.1);
  }

  .left-d {
    display: flex;
    padding: 4px 0;
    flex: 1;
    min-width: 70px;
    align-items: center;
  }

  .item-icon {
    width: 30px;
    height: 20px;
    background: #0085d0;
    flex-shrink: 0;
    display: grid;
    place-items: center;

    color: #fff;
    font-size: 12px;
    position: relative;
    margin-right: 28px;

    &::after {
      position: absolute;
      content: ' ';
      left: 100%;
      top: 0;
      width: 14px;
      height: 20px;
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      border-right: 7px solid transparent;

      border-left: 7px solid #0085d0;
    }
  }

  .item-0 {
    background: #cd4545;

    &::after {
      border-left: 7px solid #cd4545;
    }
  }

  .item-1 {
    background: #ca7e0e;

    &::after {
      border-left: 7px solid #ca7e0e;
    }
  }

  .item-2 {
    background: #ccb859;

    &::after {
      border-left: 7px solid #ccb859;
    }
  }

  .font-fff {
    color: #fff;
    font-size: 16px;
  }

  .item-title {
    flex: 1;
    min-width: 60px;
    padding-bottom: 4px;
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
