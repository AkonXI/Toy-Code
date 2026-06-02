<template>
  <div :id="'BarCharts' + id" :style="{ width: '100%', height: '100%' }"></div>
</template>

<script>
import * as echarts from 'echarts'
import mail from '@/assets/bigScreen/mail.png'
import femail from '@/assets/bigScreen/femail.png'
import { post } from '@/utils/request'
import { echartsMixin } from '../com/echartsMixin'

export default {
  name: 'BarCharts',
  mixins: [echartsMixin],
  props: {
    id: {
      type: String,
      default: ''
    },
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
        this.initChart()
      },
      deep: true
    }
  },
  data() {
    return {
      myEchart: null,
      mail,
      femail
    }
  },
  mounted() {
    this.initChart()
  },
  methods: {
    async initChart() {
      const res = await post('/tpm-bd-screen/v1/queryExpertTypeInfo', {
        dimension: '3',
        extendProps: {},
        sysCompanyUuid: this.query_fields.sysCompanyUuid,
        isStatisticsChildNode: this.query_fields.isStatisticsChildNode
      })
      const chartDom = document.getElementById('BarCharts' + this.id)
      if (!chartDom) return
      this.myEchart = echarts.init(chartDom)
      const colorList = ['#E31CCF', '#71E5FF']
      const option = {
        graphic: [
          // 在画布中央添加男女图标
          {
            type: 'image',
            style: {
              image: this.femail, // 替换为男图标URL
              width: 60,
              height: 60
            },
            left: '35%', // 水平居中偏左
            top: 'center' // 垂直居中
          },
          {
            type: 'image',
            style: {
              image: this.mail, // 替换为女图标URL
              width: 60,
              height: 60
            },
            right: '35%', // 水平居中偏左
            top: 'center' // 垂直居中
          }
        ],
        series: [
          {
            type: 'pie',
            radius: ['40%', '45%'], // 环形图内外半径:ml-citation{ref="6" data="citationList"}
            center: ['50%', '50%'], // 图表居中
            label: {
              // 标签显示数据
              formatter: '{a|{c}项} \n {b|{d}%}',
              fontSize: 14,
              rich: {
                a: {
                  color: 'white',
                  fontSize: '20px'
                },
                b: {
                  color: 'white',
                  padding: [5, 0, 0, 0]
                }
              }
            },
            padAngle: 5,
            itemStyle: {
              borderRadius: 10
            },
            data: res.data.dataList.map((v, i) => {
              return {
                value: v.itemNum,
                name: v.itemName,
                itemStyle: {
                  color: colorList[i]
                }
              }
            })
          }
        ]
      }

      this.myEchart.setOption(option)
    }
  }
}
</script>
