<template>
    <div class="card-c">
        <div class="left-img">
            <img src="@/assets/bigScreen/left-img.png" alt="">
        </div>
        <div class="card-c-list">
            <div class="card-c-list-item" v-for="(item,index) in list" :key="index">
                <div class="list-item-content">
                    <div class="list-item-title">{{item.title}}</div>
                    <div class="list-item-deci">
                        <span class="list-item-deci-num">{{item.num}}</span>
                        <span class="list-item-deci-total">/{{item.total}}</span>
                    </div>
                </div>
                <img src="@/assets/bigScreen/bottom-bg.png" alt="">
            </div>
        </div>
        <div class="right-img">
            <img src="@/assets/bigScreen/right-img.png" alt="">
        </div>
    </div>
</template>
<script>
import moment from 'moment';
import { post } from '@/utils/request';
export default {
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
            list:[]
        }
    },
    watch:{
        query_fields:{
            handler(val){
                this.initData()
            },
            deep:true,
            immediate:true
        }
    },
    created() {
        this.initData()
    },
    methods:{
        initData(){
            let {sysCompanyUuid,year,isStatisticsChildNode} = this.query_fields
            post('/tpm-warn-record/v1/queryScreenStatisticsByStage',
            {
                sysCompanyUuid:sysCompanyUuid,
                isStatisticsChildNode:isStatisticsChildNode,
                year:year,
            }
            ).then(res=>{
                // console.log(res,'res====111===')
                if(res?.data?.length>0){
                    this.list = res.data.map((item, i)=>{
                        return {
                            title:item.name,
                            num:item.unDealWarnCount ?? 0,
                            total:item.warnCount ?? 0
                        }
                    })
                }else{
                    this.list = []
                }
            })
            .catch(err=>{
                console.log(err,'获取数据失败')
            })
        }
    }
}
</script>
<style scoped lang="less">
.card-c{
    display: flex;
    height: 100%;

    background: url('@/assets/bigScreen/top-bg.png') no-repeat;
    background-size: 100% 100px;
    background-position: bottom;
    .left-img{
        width: 71px;
        img{
            width: 41px;

        }
    }
    .right-img{
        width: 71px;
        text-align: right;

        img{
            width: 41px;
        }
    }
}
.card-c-list{
    display: flex;
    width: calc(100% - 142px);
    justify-content: space-between;
    height: 100%;
    align-items: center;
    .card-c-list-item{
        position: relative;
        width: 135px;
        height: 130px;

        display: flex;
        flex-direction: column;
        align-items: center;
        .list-item-content{
            text-align: center;
        }

        img{
            position: absolute;
            width: 135px;
        }
    }



    .list-item-title{
        color: #ffffff;
        font-family: "PingFang SC";
        font-size: 16px;
        font-style: normal;
        font-weight: 400;
        line-height: normal;

        margin-bottom: 13px;
    }
    .list-item-deci{
        font-family: "D-DIN-PRO";
        font-size: 30px;
        font-style: normal;
        font-weight: 700;
        line-height: 28px;
        text-shadow: 0 0 16px #4d9fff80;
        .list-item-deci-num{
            color: #fabb00;
        }
        .list-item-deci-total{
            color: #41f5f4;

        }
    }
}
</style>
