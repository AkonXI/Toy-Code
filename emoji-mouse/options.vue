<template>
  <div class="w-[1200px] mx-auto">
    <div class="font-medium text-[22px] py-8">设置</div>
    <Form
      ref="FormRef"
      :labelCol="{ span: 2 }"
      :wrapperCol="{ span: 22 }"
      :model="FormData">
      <Row>
        <Col :span="24">
          <FormItem label="开启状态" name="status">
            <RadioGroup v-model:value="FormData.status">
              <Radio :value="true"> 开 </Radio>
              <Radio :value="false"> 关 </Radio>
            </RadioGroup>
          </FormItem>
        </Col>
        <Col :span="24">
          <FormItem label="掉落表情" name="emoji">
            <Select
              v-model:value="FormData.emojis"
              mode="tags"
              style="width: 100%"
              :token-separators="[',']"
              placeholder="输入emoji按Enter键添加"
              :options="options"></Select>
          </FormItem>
        </Col>
        <Col :span="12">
          <FormItem
            :labelCol="{ span: 4 }"
            :wrapperCol="{ span: 16 }"
            label="掉落间隔"
            name="duration">
            <input-number
              addon-after="ms"
              :min="100"
              v-model:value="FormData.duration"></input-number>
          </FormItem>
        </Col>
        <Col :span="12">
          <FormItem
            :labelCol="{ span: 4 }"
            :wrapperCol="{ span: 16 }"
            label="存在时长"
            name="stay">
            <input-number
              addon-after="ms"
              :min="500"
              v-model:value="FormData.stay"></input-number>
          </FormItem>
        </Col>
        <Col :span="12">
          <FormItem
            :labelCol="{ span: 4 }"
            :wrapperCol="{ span: 16 }"
            label="表情直径">
            <FormItemRest>
              <div class="flex items-center">
                最小 &nbsp;
                <input-number
                  class="w-24"
                  addon-after="px"
                  :min="0"
                  v-model:value="FormData.min"></input-number>
                &emsp; 最大 &nbsp;
                <input-number
                  class="w-24"
                  addon-after="px"
                  :min="0"
                  v-model:value="FormData.max"></input-number>
              </div>
            </FormItemRest>
          </FormItem>
        </Col>
        <Col :span="12">
          <FormItem
            label="透明度"
            :labelCol="{ span: 4 }"
            :wrapperCol="{ span: 16 }">
            <input-number
              :min="0"
              :max="1"
              :step="0.1"
              :precision="2"
              v-model:value="FormData.opacity"></input-number>
          </FormItem>
        </Col>
        <Col :span="24">
          <FormItem>
            <template #label>
              <div>操作</div>
            </template>
            <Button type="primary" @click="saveConfig"> 保存 </Button>
            &emsp;<Button @click="resetConfig" type="primary" danger>
              重置</Button
            >
          </FormItem>
        </Col>
      </Row>
    </Form>
  </div>
</template>

<script setup>
import Button from "ant-design-vue/es/button"
import Col from "ant-design-vue/es/col"
import Form, { FormItem, FormItemRest } from "ant-design-vue/es/form"
import InputNumber from "ant-design-vue/es/input-number"
import message from "ant-design-vue/es/message"
import Radio, { RadioGroup } from "ant-design-vue/es/radio"
import Row from "ant-design-vue/es/row"
import Select from "ant-design-vue/es/select"
import { onMounted, ref } from "vue"

import initOption from "~initOption"

const FormData = ref({ ...initOption })
const options = ref([])
// ❤️, 🧡, 💛, 💚, 💙, 💜, 🤎, 🖤, 🤍

// 🍇, 🍈, 🍉, 🍊, 🍋, 🍌, 🍍, 🥭, 🍎, 🍒, 🍓, 🥑

const saveConfig = async () => {
  chrome.runtime.sendMessage(
    { type: "update-option", data: FormData.value },
    (ret) => {
      if (chrome.runtime.lastError) return
      message.success("保存成功")
    }
  )
}

const resetConfig = async () => {
  const defaults = { ...initOption }
  chrome.runtime.sendMessage(
    { type: "update-option", data: defaults },
    (ret) => {
      if (chrome.runtime.lastError) return
      FormData.value = defaults
      message.success("重置成功")
    }
  )
}
onMounted(() => {
  chrome.runtime.sendMessage({ type: "get-options" }, (v) => {
    if (chrome.runtime.lastError) return
    FormData.value = { ...initOption, ...v }
  })
})
defineOptions({
  prepare(app) {
    // Use any plugins here:
    // app.use
  }
})
</script>

<style>
@import "style.css";

.anticon {
  vertical-align: middle !important;
}
</style>
