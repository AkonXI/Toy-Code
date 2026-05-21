<template>
    <div class="table-wrap">
        <div class="table-header">
            <div class="table-header-item" :style="{width:item.width,textAlign:item.align}" v-for="(item, index) in headerColunm" :key="index">
                {{item.title}}
            </div>
        </div>
        <div class="no-data" v-if="tableData.length===0">
            <img src="@/assets/bigScreen/no-data.png" alt="">
            <p>暂无数据</p>
        </div>
        <div class="table-body" v-else>
            <vue-seamless-scroll :data="tableData" :class-option="classOption"  class="wrap">
                <ul>
                    <li class="table-body-item" v-for="(item, index) in tableData" :key="index">
                        <template v-for="(col, ii) in headerColunm">
                            <div class="col-item item-name" v-if="col.key === 'name'" :key="ii" :title="item.name" :style="{width:col.width,textAlign:col.align}">
                                <div class="item-name-text">{{item.name}}</div>
                            </div>
                            <div class="col-item" :title="item[col.key]" v-else :key="ii" :style="{width:col.width,textAlign:col.align}">
                                {{
                                    item[col.key]
                                }}
                            </div>
                            <a-divider v-if="ii !== headerColunm.length-1" :key="ii+'v'" type="vertical" />
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
    data() {
        return {
            classOption:{},
            headerColunm: [
                {
                    title: '公示标题',
                    key: 'name',
                    width: '40%',
                    align: 'left'
                },
                {
                    title: '信息来源',
                    key: 'reason',
                    width: '40%',
                    align: 'left'
                },
                {
                    title: '发布时间',
                    key: 'date',
                    width: '20%',
                    align: 'left'
                },
            ],
            tableData: []
        }
    },
    watch:{
        query_fields:{
            handler(val){
                this.initData()
            },
            deep:true
        }
    },
    created() {
        this.initData()
    },
    methods: {
        initData(){
            let {sysCompanyUuid,year,isStatisticsChildNode} = this.query_fields
            post('/tpm-open-openaudit/v1/queryList',{
                sysCompanyUuid:sysCompanyUuid,
                isStatisticsChildNode:isStatisticsChildNode,
                year:moment(year).format('YYYY'),
                pageNum:1,
                pageSize:50,
            }).then(res=>{
                if(res?.data?.data?.length>0){
                    let { data } = res.data
                    this.tableData = data.map((item)=>{
                        return {
                            ...item,
                            name: item.openTitle,
                            reason: item.sendInfoFromName,
                            date: moment(item.sendTime).format('YYYY-MM-DD'),
                        }
                    })
                }else{
                    this.tableData = []
                }
            })
            .catch(err=>{
                console.log(err,'获取数据失败')
            })
        },
        goView(item){
            let {href} = this.$router.resolve({
                path:'/form/formshowbuild',
                query:{
                    formdesign_uuid:'1F7A52DB6A3046EDBA5D47F20A9BB36F',
                    primarykey:item.pkUuid,
                    actionflag:'view'}
            })
            window.open(href,'_blank');
        }
    }
}
</script>
<style scoped lang="less">
.table-wrap{
    height: 100%;
    display: flex;
    flex-direction: column;

    .no-data{
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
    }
    /deep/.ant-divider{
        background: #44f1ff40;
    }
}
.wrap{
    height: 100%;
    overflow: hidden;
  }
.table-header{
    width: 100%;
    height: 36px;
    display: flex;

    // border: 1px solid #0085ff8f;
    background: #44f1ff1a;
    padding: 0 8px;

    color: #ffffff;
    font-family: "PingFang SC";
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
    .table-header-item{
        height: 37px;
        line-height: 37px;
        text-align: center;
    }
}
.table-body{
    flex: 1;
    min-height: 10px;
}
.table-body-item{
    display: flex;
    align-items: center;
    // border: 1px solid #1aa0f73b;
    // margin: 4px 0;

    &:nth-child(even){
        background: #44f1ff1a;
    }

    .col-item{
        height: 46px;
        line-height: 46px;

        padding: 0 5px;

        color: #ffffff;
        font-family: "PingFang SC";
        font-size: 14px;
        font-style: normal;
        font-weight: 400;

        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        word-break: break-all;
    }
    .item-name{
        display: flex;
        align-items: center;
        .item-name-text{
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            word-break: break-all;
        }
    }
    .item-icon{
        width: 31px;
        margin-right: 5px;
    }

    .risk-type-pre{
        border: 1px solid #FAB728;
        color: #fab728;
        padding: 0 6px;
        border-radius: 4px;
        font-size: 14px;

    }
    .risk-type-warn{
        border: 1px solid #F04129;
        color: #F04129;
        padding: 0 6px;
        border-radius: 4px;
        font-size: 14px;
    }
}
</style>
