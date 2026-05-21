<template>
    <div style="width:100%;height:100%;" class="center-left">
        <div class="top-d">
            <div class="f-d" >
                <div class="img-warn bubble">
                    <div class="num-deci">{{info.gaojingCount??0}}</div>
                    <div class="type-name">                    指标一</div>
                </div>

            </div>
            <div class="d-flex second-d bubble">
                <div class="img-pre-warn">
                    <div class="num-deci">{{info.yujingCount??0}}</div>
                    <div class="type-name">                    指标二</div>
                </div>
                <div class="img-risk bubble">
                    <div class="num-deci">{{info.totalCount??0}}</div>
                    <div class="type-name">                    指标三</div>
                </div>
            </div>
        </div>
        <div class="b-img">
        </div>
    </div>
</template>

<script>
import { post } from '@/utils/request'
import moment from 'moment'
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
            info:  {},
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
    methods:{
        initData() {
            let {sysCompanyUuid,year,isStatisticsChildNode} = this.query_fields
            post('/tpm-warn-record/v1/queryScreenRecordStatistics',{
                sysCompanyUuid:sysCompanyUuid,
                isStatisticsChildNode:isStatisticsChildNode,
                year:year,
            }
            ).then(res=>{
                if(res&&Object.keys(res.data).length>0){
                    this.info = res.data
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
.center-left{
    position: relative;
    padding-top: 20px;

    background: url('@/assets/bigScreen/b-l-bg.png') no-repeat;
    background-size: 100% 150px;
    background-position: bottom;
}
.d-flex{
    display: flex;
    justify-content: center;
}
.b-img{
    height: 70px;
}
.top-d{
    width: 100%;
    height: calc(100% - 70px);
    .f-d{
        width: 100%;
        display: flex;
        justify-content: center;
    }

    .second-d{
        width: 100%;
        display: flex;
    }

}
.num-deci{
    font-family: "D-DIN-PRO";
    font-size: 30px;
    font-style: normal;
    font-weight: 700;
}
.img-warn{
    width: 120px;
    height: 120px;
    background: url('@/assets/bigScreen/warn-img.png') no-repeat;
    background-size: cover;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    .num-deci{
        color: #ffce00;
    }

    animation: float 3s ease-in-out infinite;
}

.type-name{
    color: #fbfdff;
    text-align: center;
    font-family: "PingFang SC";
    font-size: 16px;
}
.img-pre-warn{
    width: 120px;
    height: 120px;
    background: url('@/assets/bigScreen/pre-warn-img1.png') no-repeat;
    background-size: cover;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    .num-deci{
        color: #33e4ff;
    }



    animation: float 4s ease-in-out infinite;
    animation-delay: 0.5s;
}
.img-risk{
    width: 150px;
    height: 150px;
    background: url('@/assets/bigScreen/risk-img1.png') no-repeat;
    background-size: cover;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    .num-deci{
        color: #ffffff;
    }

    animation: float 3.5s ease-in-out infinite;
    animation-delay: 1s;
}

.bubble{
    border-radius: 50%;
    transform-origin: center;

    position: relative;
    z-index: 9;
}

@keyframes float {
    0%, 100% {
        transform: translateY(0) rotate(0deg);
    }
    50% {
        transform: translateY(-16px) rotate(5deg);
    }
}
</style>
