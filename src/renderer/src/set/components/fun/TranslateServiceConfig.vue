<template>
  <div>
    <div class="header">
      <el-radio-group v-model="menuIndex" size="small">
        <el-radio-button :label="0">文本翻译</el-radio-button>
        <el-radio-button :label="1">文字识别</el-radio-button>
      </el-radio-group>
    </div>

    <translate-service v-if="menuIndex === ServiceTypeEnum.TRANSLATE" />
    <ocr-service v-else-if="menuIndex === ServiceTypeEnum.OCR" />
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'

import TranslateService from './serviceConfig/TranslateService.vue'
import OcrService from './serviceConfig/OcrService.vue'
import { ServiceTypeEnum } from '../../../../../common/enums/ServiceTypeEnum'

const menuIndex = ref(ServiceTypeEnum.TRANSLATE)
</script>

<style lang="scss" scoped>
@use '../../../css/set.scss' as *;

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
