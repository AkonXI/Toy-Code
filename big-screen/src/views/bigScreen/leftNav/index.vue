<template>
    <div class="screen-left-nav">
      <div class="navs">
        <div :class="{'nav-item':true,'not-active-item':activeKey!=i.key,'active-item':activeKey==i.key}" v-for="i in tabList" :key="i.key" @click="menuChange(i)">
          <div class="item-title">
            {{i.name}}
          </div>
        </div>
      </div>
    </div>
</template>
<script>
export default {
    data() {
        return {
          activeKey:2,
          tabList:[
            {
              name:'模块一',
              key:1
            },
            {
              name:'模块二',
              key:2
            },
            {
              name:'模块三',
              key:3
            },
            {
              name:'模块四',
              key:4
            },
          ]
        }
    },
    methods: {
      menuChange(i){
        this.activeKey=i.key
        this.$emit('menuChange',i.key,i)
      }
    }
}
</script>
<style scoped lang="less">
.screen-left-nav{
    height: 100%;
    display: flex;
    align-items: center;
    /* width: 155px; */
    .active-item{
      background: linear-gradient(180deg, #ffc57173 49%, #ffc57100 100%);
    }
    .not-active-item{
      background: linear-gradient(180deg, #158fff82 49%, #158fff00 100%);
    }
    .nav-item{
      padding: 20px 0;
      width: 35px;
      // background: linear-gradient(180deg, #158fff82 49%, #158fff00 100%);
      margin-bottom: 20px;
      cursor: pointer;
      border-top-left-radius: 10px;
      border-top-right-radius: 10px;
      border-bottom-right-radius: 10px;
      border-bottom-left-radius: 10px;
      transform: perspective(20px) rotateX(0deg) rotateY(8deg) translateZ(0);
      &:hover{
        background: linear-gradient(180deg, #ffc57173 49%, #ffc57100 100%);
      }
      .item-title{
        width: 100%;
        writing-mode: vertical-rl; /* 文字竖向排列 */
        text-orientation: upright;
        color: #ffffff;
        font-family: "DingTalk JinBuTi";
        font-size: 18px;
        font-style: normal;
        font-weight: 400;
        line-height: 35px;
        text-align: center;
        transform: perspective(20px) rotateX(0deg) rotateY(-8deg) translateZ(0);
      }
    }
}
</style>