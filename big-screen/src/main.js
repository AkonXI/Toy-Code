import Vue from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/antd.css'
import './assets/main.css'
import App from './App.vue'

Vue.use(Antd)

const store = Vue.observable({
  state: {
    user: {
      userInfo: {
        companyuuid: ''
      }
    }
  }
})

store.getters = {
  companyuuid: () => store.state.user.userInfo.companyuuid
}

Vue.prototype.$store = store

new Vue({
  render: (h) => h(App)
}).$mount('#app')
