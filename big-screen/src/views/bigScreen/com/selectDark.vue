<template>
  <div>
    <a-select
      dropdownClassName="selectDownBodyDark"
      :allowClear="true"
      v-model="selectValue"
      @change="selectChange"
    >
      <a-select-option v-for="(d, index) in optionList" :key="index" :value="d.value">
        {{ d.label }}
      </a-select-option>
    </a-select>
  </div>
</template>
<script>
export default {
  props: {
    value: {
      type: [String, Object, Array],
      default: () => []
    }
  },
  data() {
    return {
      optionList: []
    }
  },
  computed: {
    selectValue: {
      get: function () {
        return this.value
      },
      set: function (val) {
        this.$emit('update:value', val)
      }
    }
  },
  methods: {
    selectChange(value) {
      this.$emit('selectChange', value)
    }
  }
}
</script>
<style lang="less">
@import './querySelect.less';
</style>
<style lang="less" scoped>
.ant-select {
  width: 150px;
}
/deep/.ant-select-selection {
  background-color: transparent !important;
  border: 0.5px solid #0085d0 !important;

  color: #fff !important;
}

/deep/.ant-select-selection__clear {
  background: #020927;
  // color: #ffffffd6;
}
/deep/.anticon {
  color: #fff;
}
</style>
