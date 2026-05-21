<!-- 大屏 -->
<template>
  <div class="scale-wrap">
    <div class="bg">
      <a-spin class="screen-loading" v-if="loading" size="large" />
      <div v-else class="host-body">
        <!-- 头部 s -->
        <div class="title_wrap">
          <div>
            <div class="top-query">
              <yearDateDark v-show="showDatePicker" @change="(e) => queryChange('year', e)"></yearDateDark>
              <treeSelectDark :props="treeOptions" width="200" v-model="sysCompanyUuid" @change="(e) => queryChange('sysCompanyUuid', e)">
              </treeSelectDark>
              <div class="select-wrapper" v-if="showSubCompaniesOption">
                <a-select class="ant-select-dark" dropdownClassName="selectDownBodyDark" :allowClear="false" v-model="isStatisticsChildNode" @change="(e) => queryChange('isStatisticsChildNode', e)" style="width: 150px;">
                  <a-select-option v-for="(d,index) in optionList" :key="index" :value="d.value">
                    {{ d.label }}
                  </a-select-option>
                </a-select>
              </div>
            </div>
            <div class="title" id="screenTitle">
              <span class="title-text">{{ screenTitle }}</span>
            </div>
            <div class="timers">
              <img src="@/assets/bigScreen/time.png" alt="">
              {{ timing }}
            </div>
          </div>
        </div>
        <!-- 头部 e-->
        <!-- 内容  s-->
        <div class="content">
          <slot></slot>
        </div>
        <!-- 内容 e -->
      </div>
    </div>
  </div>
</template>
<script>
import moment from 'moment';

import lottie from 'lottie-web';
import ammNoticeData from '@/assets/bigScreen/screenTitle/data.json';

import selectDark from './com/selectDark.vue';
import treeSelectDark from './com/treeSelectDark.vue';
import yearDateDark from './com/yearDateDark.vue';
import { post } from '@/utils/request';


export default {
  components: { selectDark, treeSelectDark, yearDateDark },
  props: {
    showDatePicker: {
      type: Boolean,
      default: true
    },
    screenTitle: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      timing: null,
      loading: true,
      selfAdaption: false,
      activeMenu: '',
      query_fields: {
        year: moment(new Date()).format('YYYY'),
        sysCompanyUuid: '',
        isStatisticsChildNode: '0',
      },
      optionList:[
        {
          label: '选项一',
          value: '0'
        },
        {
          label: '选项二',
          value: '1'
        },
      ],
      treeOptions: {
        url: '/org/v1/queryOrgNodeTreeByAttrWithAuth',
        reqParam: {
          orgBizCode: "default",
          orgNodeLevelCodes: ["00", "01"]
        },
      },
      showSubCompaniesOption: false
    };
  },
  computed: {
    isStatisticsChildNode: {
      get() {
        return this.query_fields.isStatisticsChildNode;
      },
      set(value) {
        this.query_fields.isStatisticsChildNode = value;
      }
    },
    sysCompanyUuid: {
      get() {
        return this.query_fields.sysCompanyUuid;
      },
      set(value) {
        this.query_fields.sysCompanyUuid = value;
      }
    }
  },
  mounted() {
    this.cancelLoading();
    this.selfAdaption = true;
    this.timing = moment(new Date()).format('YYYY-MM-DD');

    // 设置默认选中当前用户所属单位
    this.$nextTick(() => {
      const currentUserCompanyUuid = this.$store.state.user.userInfo.companyuuid ?? '';
      if (currentUserCompanyUuid) {
        this.query_fields.sysCompanyUuid = currentUserCompanyUuid;
        // 检查是否显示下级公司选项
        this.checkSubCompanies(currentUserCompanyUuid);
      }
    });
  },
  methods: {
    queryChange(field, value) {
      this.query_fields[field] = value;
      // 当isStatisticsChildNode值改变时，重新判断是否需要展示下级公司选项
      if (field === 'sysCompanyUuid') {
        this.checkSubCompanies(this.query_fields.sysCompanyUuid);
      }
      this.$emit('queryChange', this.query_fields);
    },
    menuChange(type) {
      this.activeMenu = type;
      this.$emit('menuChange', type);
    },
    cancelLoading() {
      let timer = setTimeout(() => {
        this.loading = false;
        clearTimeout(timer);

        this.$nextTick(() => {
          this.initLottieAnimation();
        });
      }, 500);
    },
    initLottieAnimation() {
      lottie.loadAnimation({
        container: document.getElementById('screenTitle'),
        animationData: ammNoticeData, // 动画 JSON 数据
        renderer: 'svg', // 使用 SVG 渲染器
        loop: true, // 循环播放
        autoplay: true, // 自动播放
      });
    },
    // 检查是否显示下级公司选项
    checkSubCompanies(companyUuid) {
      post('/org/v1/hasSubCompanies', { companyUuid:companyUuid,orgNodeLevelCodes: ["00", "01"],orgBizCode: "default" })
        .then(response => {
          this.showSubCompaniesOption = response.data === true;
        })
        .catch(error => {
          console.error('检查下级公司失败:', error);
          // 出错时默认显示
          this.showSubCompaniesOption = false;
        });
    }
  },
};
</script>
<style lang="less" scoped>
@import './screen.less';

.content {
  height: calc(100% - 104px);
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.host-body {
  height: 100%;

  .timers>img {
    width: 19px;
    height: 19px;

    margin-right: 10px;
  }

  .title {
    display: flex;
    justify-content: center;
    align-items: center;

    font-size: 38px;
    font-weight: 900;
    letter-spacing: 6px;
    border: none;
  }

  .top-query {
    position: absolute;
    height: 70px;
    line-height: 70px;
    left: 20px;
    z-index: 9;

    display: flex;
    gap: 20px;
    align-items: center;
  }

  .select-wrapper {
    display: flex;
    align-items: center;
  }

}
</style>
