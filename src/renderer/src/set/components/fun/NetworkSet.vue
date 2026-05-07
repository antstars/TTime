<template>
  <div>
    <div class="network-layer">
      <el-form label-width="120px">
        <el-form-item label="代理设置">
          <el-select v-model="agentConfig.type" class="network-agent-select">
            <el-option
              v-for="model in agentSelectList"
              :key="model.value"
              :label="model.label"
              :value="model.value"
            />
          </el-select>
        </el-form-item>

        <div v-if="agentConfig.type !== 0">
          <el-form-item label="服务器">
            <el-input
              v-model="agentConfig.host"
              class="network-input"
              type="text"
              placeholder="请输入地址IP"
              spellcheck="false"
            />
          </el-form-item>
          <el-form-item label="端口">
            <el-input
              v-model="agentConfig.port"
              class="network-input"
              type="text"
              placeholder="请输入端口"
              spellcheck="false"
            />
          </el-form-item>
          <el-form-item label="用户名">
            <el-input
              v-model="agentConfig.userName"
              class="network-input"
              type="text"
              placeholder="请输入用户名"
              spellcheck="false"
            />
            <span class="form-switch-span"> （选填）此处填写代理用户名 如果没有不填即可 </span>
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="agentConfig.passWord"
              class="network-input"
              type="password"
              placeholder="请输入密码"
              spellcheck="false"
              show-password
            />
            <span class="form-switch-span"> （选填）此处填写代理密码 如果没有不填即可 </span>
          </el-form-item>
        </div>
        <el-form-item>
          <el-button plain @click="save">保存</el-button>
          <span class="form-switch-span form-switch-button-span">
            {{ agentConfig.type === 0 ? '' : '配置后TTime默认所有请求通过代理执行' }}
          </span>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { isNull } from '../../../../../common/utils/validate'
import ElMessageExtend from '../../../utils/messageExtend'
import { cacheGet } from '../../../utils/cacheUtil'
import R from '../../../../../common/class/R'

const defaultAgentConfig = {
  type: 0,
  checkStatus: false,
  host: '',
  port: '',
  userName: '',
  passWord: ''
}
const agentSelectList = [
  { label: '不使用代理', value: 0 },
  { label: 'HTTP代理', value: 1 },
  { label: 'SOCKS5代理', value: 2 }
]
const agentTypeList = agentSelectList.map((agentSelect) => agentSelect.value)
const normalizeAgentConfig = (value): any => {
  const type = Number(value?.type)
  return {
    type: agentTypeList.includes(type) ? type : defaultAgentConfig.type,
    checkStatus: value?.checkStatus === true,
    host: trimAgentConfigValue(value?.host),
    port: trimAgentConfigValue(value?.port),
    userName: trimAgentConfigValue(value?.userName),
    passWord: trimAgentConfigValue(value?.passWord)
  }
}
const trimAgentConfigValue = (value): string => {
  return isNull(value) ? '' : String(value).trim()
}
const cachedAgentConfig = cacheGet('agentConfig')
const agentConfig = ref(
  normalizeAgentConfig({
    ...defaultAgentConfig,
    ...(isNull(cachedAgentConfig) ? {} : cachedAgentConfig)
  })
)

/**
 * 不设置代理保存
 */
const save = async (): Promise<void> => {
  const nextAgentConfig = normalizeAgentConfig(agentConfig.value)
  if (nextAgentConfig.type !== 0 && (isNull(nextAgentConfig.host) || isNull(nextAgentConfig.port))) {
    ElMessageExtend.warning('代理地址或端口号不能为空')
    return
  }
  if (
    (!isNull(nextAgentConfig.userName) && isNull(nextAgentConfig.passWord)) ||
    (isNull(nextAgentConfig.userName) && !isNull(nextAgentConfig.passWord))
  ) {
    return ElMessageExtend.warning('请填写完整的代理用户名和密码')
  }
  const res = await window.api.agentUpdateEvent(nextAgentConfig)
  if (isNull(res) || res.code !== R.SUCCESS) {
    ElMessageExtend.warning(isNull(res?.msg) ? '代理设置失败' : res.msg)
    return
  }
  agentConfig.value = nextAgentConfig
  ElMessageExtend.success('保存成功')
}
</script>

<style lang="scss" scoped>
@import '../../../css/set.scss';

.network-layer {
  display: flex;
  max-height: 500px;
  min-height: 500px;

  .form-switch-button-span {
    margin-left: 15px;
  }
}

.network-input {
  //width: 70%;
}

.network-agent-select {
  width: 150px;
}
</style>
