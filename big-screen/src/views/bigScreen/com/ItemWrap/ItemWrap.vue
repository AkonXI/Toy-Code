<template>
  <div class="lr_titles">
    <div class="item_title" :style="itemStyle" v-if="title">
      <span class="title-inner" :style="{ fontSize: fontSize_title }">{{ title }}</span>
    </div>

    <div class="item_title_content">
      <slot></slot>
    </div>
    <div class="corner corner-l" v-show="topL"></div>
    <div class="corner corner-r" v-show="topR"></div>
    <div class="corner corner-bl" v-show="bottomL"></div>
    <div class="corner corner-br" v-show="bottomR"></div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      fontSize_title: '22px'
    }
  },
  props: {
    title: {
      type: String,
      default: () => ''
    },
    itemStyle: {
      type: Object,
      default: () => {}
    },
    topL: {
      type: Boolean,
      default: () => true
    },
    topR: {
      type: Boolean,
      default: () => true
    },
    bottomL: {
      type: Boolean,
      default: () => true
    },
    bottomR: {
      type: Boolean,
      default: () => true
    }
  },
  created() {},

  mounted() {},
  methods: {}
}
</script>
<style lang="less" scoped>
.lr_titles {
  box-sizing: border-box;
  position: relative;

  border: 1px solid rgba(7, 152, 188, 0.3);
  background: linear-gradient(180deg, rgba(4, 153, 189, 0) 0%, rgba(4, 153, 189, 0.1) 100%);

  width: 100%;
  height: 100%;

  display: flex;
  flex-direction: column;

  .corner {
    width: 18.43px;
    height: 15.87px;

    position: absolute;
  }
  .corner-l {
    top: 0;
    left: 0;
    border-top: 1px solid #42c6ff;
    border-left: 1px solid #42c6ff;
  }
  .corner-r {
    top: 0;
    right: 0;
    border-top: 1px solid #42c6ff;
    border-right: 1px solid #42c6ff;
  }
  .corner-bl {
    bottom: 0;
    left: 0;
    border-bottom: 1px solid #42c6ff;
    border-left: 1px solid #42c6ff;
  }
  .corner-br {
    bottom: 0;
    right: 0;
    border-bottom: 1px solid #42c6ff;
    border-right: 1px solid #42c6ff;
  }

  .item_title {
    height: 45px;
    line-height: 45px;
    width: 100%;
    color: #31abe3;
    text-align: center;

    position: relative;
    display: flex;
    align-items: center;
    background: url('@/assets/bigScreen/box-title-bg.svg') no-repeat;

    .title-inner {
      letter-spacing: 2px;
      color: #fff;

      font-family: 'YouSheBiaoTiHei';
      // font-size: 22px;
      text-shadow: 0 0 3px #52c5f4;
      font-weight: 400;

      background: linear-gradient(180deg, #fff 0%, #badeff 100%);
      background-clip: text;

      margin-left: 56px;
    }
  }

  .item_title_content {
    min-height: calc(100% - 53px);
    flex: 1;
    padding: 0 16px;
  }
}
</style>
