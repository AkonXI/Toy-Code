<template>
  <div>
    <a-date-picker
     dropdownClassName="dateDownBody"
      v-model="query_value"
      placeholder="请选择年份"
      :mode="'year'"
      :format="'YYYY'"
      style="width: 100%"
      :open="yearOpen"
      @panelChange="(time) => yearOpenChange(time)"
      @openChange="yearPanelChange"
      @change="(time) => yearChange(time)"
    />
  </div>
</template>

<script>
import moment from 'moment';

export default {
    props: {
      value: {
        type: [String, Object, Array],
        default: () => [],
      },
    },

  data() {
    return {
      yearOpen: false,
      query_value: moment(new Date()),
    };
  },
  methods: {
    yearOpenChange(time) {
      if (time) {
        this.$nextTick(() => {
          this.query_value = moment(time).format('YYYY');
          this.$emit('change', this.query_value)
        });
        this.yearOpen = false;
      }
    },
    yearPanelChange(value) {
      this.yearOpen = value;
    },
    yearChange(time){
      this.$emit('change', time)
    }
  },

};
</script>
<style lang="less">
@import './querySelect.less';
</style>
<style lang="less" scoped>
/deep/ .ant-calendar-picker-input.ant-input {
    color: #ffffffd9;

    border: 1px solid #0190F7;
    background: #ffffff05;
    box-shadow: -2px -2px 4px 0 #c8fffb66 inset, 2px 2px 4px 0 #c8fffb66 inset;
  }
/deep/ .anticon {
    color: #ffffffd9;
    background: #0C3B72;
}
</style>