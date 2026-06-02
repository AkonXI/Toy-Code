<template>
  <div class="risk-table-wrap">
    <div class="table-header">
      <div
        class="table-header-item"
        :style="{ width: item.width, textAlign: item.align }"
        v-for="(item, index) in headerColunm"
        :key="index"
      >
        {{ item.title }}
      </div>
    </div>
    <div class="no-data" v-if="tableData.length === 0">
      <img src="@/assets/bigScreen/no-data.png" alt="" />
      <p>暂无数据</p>
    </div>
    <div class="table-body" v-else>
      <vue-seamless-scroll :data="tableData" :key="rdmk" :class-option="classOption" class="wrap">
        <ul>
          <li class="table-body-item" v-for="(item, index) in tableData" :key="index">
            <template v-for="(col, ii) in headerColunm">
              <div
                class="col-item"
                :key="ii"
                v-if="col.key === 'index'"
                :style="{ width: col.width, textAlign: col.align }"
              >
                {{ index + 1 }}
              </div>
              <div
                class="col-item oprate"
                :key="ii"
                v-else-if="col.key === 'oprate'"
                :style="{ width: col.width, textAlign: col.align }"
                @click="goView(item)"
              >
                查看
              </div>
              <div
                class="col-item item-name"
                v-else-if="col.key === 'name'"
                :key="ii"
                :title="item.name"
                :style="{ width: col.width, textAlign: col.align }"
              >
                <template>
                  <img
                    class="item-icon"
                    v-if="item.type == '2'"
                    src="@/assets/bigScreen/risk-type-warn.png"
                    alt=""
                  />
                  <img class="item-icon" v-else src="@/assets/bigScreen/risk-type-pre.png" alt="" />
                </template>
                <div class="item-name-text">{{ item.name }}</div>
              </div>
              <div
                class="col-item"
                :title="item[col.key]"
                v-else
                :key="ii"
                :style="{ width: col.width, textAlign: col.align }"
              >
                {{ item[col.key] }}
              </div>
            </template>
          </li>
        </ul>
      </vue-seamless-scroll>
    </div>
  </div>
</template>
<script>
import { post } from '@/utils/request'
import vueSeamlessScroll from 'vue-seamless-scroll'
import moment from 'moment'
export default {
  components: {
    vueSeamlessScroll
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
  data() {
    return {
      rdmk: Math.random(),
      classOption: { limitMoveNum: 999, autoPlay: false },
      headerColunm: [
        {
          title: '序号',
          key: 'index',
          width: '8%',
          align: 'center'
        },
        {
          title: '异常项',
          key: 'name',
          width: '20%',
          align: 'left'
        },
        {
          title: '原因说明',
          key: 'reason',
          width: '32%',
          align: 'left'
        },
        {
          title: '所属单位',
          key: 'unit',
          width: '15%',
          align: 'left'
        },
        {
          title: '记录时间',
          key: 'date',
          width: '15%',
          align: 'left'
        },
        {
          title: '操作',
          key: 'oprate',
          width: '10%',
          align: 'center'
        }
      ],
      tableData: []
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
        const itemHeight = 44
        this.classOption.limitMoveNum = Math.floor(wrap.clientHeight / itemHeight)
      }
    },
    initData() {
      this.classOption.autoPlay = false
      let { sysCompanyUuid, year, isStatisticsChildNode } = this.query_fields
      post('/tpm-warn-record/v1/pageQueryInfo', {
        sysCompanyUuid: sysCompanyUuid,
        isStatisticsChildNode: isStatisticsChildNode,
        year: year,
        pageNum: 1,
        pageSize: 50
      })
        .then((res) => {
          if (res?.data?.data?.length > 0) {
            let { data } = res.data
            this.tableData = data.map((item, i) => {
              return {
                name: '异常项' + (i + 1),
                reason: '原因说明' + (i + 1),
                unit: '所属单位' + (i + 1),
                date: item.abnormalDate,
                type: item.warnType, //2 告警
                ...item
              }
            })
            this.$nextTick(() => {
              this.calcLimit()
              this.classOption.autoPlay = this.tableData.length > this.classOption.limitMoveNum
            })
          } else {
            this.tableData = []
          }
        })
        .catch((err) => {
          console.log(err, '获取数据失败')
        })
    },
    goView(item) {
      let { href } = this.$router.resolve({
        path: '/form/formshowbuild',
        query: {
          formdesign_uuid: '1F7A52DB6A3046EDBA5D47F20A9BB36F',
          primarykey: item.pkUuid,
          actionflag: 'view'
        }
      })
      window.open(href, '_blank')
    }
  }
}
</script>
<style scoped lang="less">
.risk-table-wrap {
  height: 100%;
  display: flex;
  flex-direction: column;

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
.table-header {
  width: 100%;
  height: 37px;
  display: flex;

  border: 1px solid #0085ff8f;
  background: #0730601f;
  box-shadow: 0 0 38px 0 #01a4ff66 inset;

  color: #ffffff;
  font-family: 'PingFang SC';
  font-size: 16px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  .table-header-item {
    height: 37px;
    line-height: 37px;
    text-align: center;
    padding: 0 5px;
    flex-shrink: 0;
  }
}
.table-body {
  flex: 1;
  min-height: 10px;
}
.table-body-item {
  display: flex;
  border: 1px solid #1aa0f73b;
  margin: 4px 0;

  .col-item {
    height: 36px;
    line-height: 36px;

    padding: 0 5px;

    color: #ffffff;
    font-family: 'PingFang SC';
    font-size: 14px;
    font-style: normal;
    font-weight: 400;

    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    word-break: break-all;

    &.oprate {
      cursor: pointer;
      color: #009bf2;
    }
  }
  .item-name {
    display: flex;
    align-items: center;
    .item-name-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      word-break: break-all;
    }
  }
  .item-icon {
    width: 31px;
    margin-right: 5px;
  }

  .risk-type-pre {
    border: 1px solid #fab728;
    color: #fab728;
    padding: 0 6px;
    border-radius: 4px;
    font-size: 14px;
  }
  .risk-type-warn {
    border: 1px solid #f04129;
    color: #f04129;
    padding: 0 6px;
    border-radius: 4px;
    font-size: 14px;
  }
}
</style>
