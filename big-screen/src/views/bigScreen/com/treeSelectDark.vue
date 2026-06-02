<template>
  <div>
    <a-tree-select
      dropdownClassName="selectDownBodyDark"
      v-model="treeValue"
      :show-search="props.showSearch"
      :style="{ width: handleWidth() }"
      :dropdown-style="{ maxHeight: '400px', overflow: 'auto', color: '#fff' }"
      placeholder="请选择"
      :replaceFields="{ children: 'children', title: 'nodeName', key: 'nodeId', value: 'nodeId' }"
      :tree-data="treeData"
      :filterTreeNode="filterTreeOption"
      @change="change"
    >
    </a-tree-select>
  </div>
</template>

<script>
import { post } from '@/utils/request'
export default {
  //名称
  name: 'treeSelectDark',
  props: {
    props: {
      type: Object,
      default: () => {
        return {}
      }
    },
    width: {
      type: [String, Number],
      default: undefined
    },
    value: {
      type: [String, Number],
      default: undefined
    }
  },
  data() {
    return {
      treeData: [],
      treeValue: undefined
    }
  },
  watch: {
    props: {
      immediate: true,
      handler(val) {
        if (val && val.url) {
          this.loadTreeData()
        }
      }
    },
    value: {
      immediate: true,
      handler(val) {
        this.treeValue = val
      }
    },
    treeValue: {
      handler(val) {
        this.$emit('input', val)
      }
    }
  },
  //方法集合
  methods: {
    loadTreeData() {
      const param = { ...this.props.reqParam }
      post(this.props.url, param).then((res) => {
        this.treeData = res.data
      })
    },
    handlerData(dataArr, filterArr) {
      let result = []
      dataArr.forEach((ele) => {
        let obj = {}
        Object.keys(filterArr).forEach((attr) => {
          if (ele[attr]) {
            obj[filterArr[attr]] = ele[attr]
          }
        })
        result.push(obj)
      })
      return result
    },

    change(val, label, { triggerNode }) {
      this.$emit('change', val, label, triggerNode?.dataRef)
    },
    filterTreeOption(input, treeNode) {
      return treeNode.data.props.title.includes(input)
    },
    handleWidth() {
      if (this.width && Number(this.width) && Number(this.width) != NaN) {
        return Number(this.width) - 35 + 'px'
      } else {
        return '100%'
      }
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
  //   background-color: transparent !important;
  //   border: 0.5px solid #0085d0 !important;
  border: 1px solid #0190f7;
  background: #ffffff05;
  box-shadow:
    -2px -2px 4px 0 #c8fffb66 inset,
    2px 2px 4px 0 #c8fffb66 inset;

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
