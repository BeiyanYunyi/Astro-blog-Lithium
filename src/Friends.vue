<template>
  <n-space vertical>
    <n-a v-for="friend in friends" :href="friend.url">
      <n-card
        hoverable
        embedded
        :class="$style.card"
        content-style="padding: 0.25rem 0.5rem 0.25rem 0.5rem"
      >
        <n-thing :class="$style.content" :description="friend.description">
          <template #header>
            <div :class="$style.title">{{ friend.title }}</div>
          </template>
          <template #avatar>
            <n-image height="75" width="75" :src="friend.avatar" :preview-disabled="true" />
          </template>
        </n-thing>
      </n-card>
    </n-a>
  </n-space>
</template>

<script lang="ts" setup>
import friends from '../docs/_data/friends.json';
import { NImage, NSpace, NThing, NA, NCard } from 'naive-ui';
</script>

<style module>
.card {
  background-color: var(--bg-color-blur);
}
.content {
  color: var(--text-color);
}

.title {
  font-size: 16px;
  font-weight: var(--n-title-font-weight);
  transition: color 0.3s var(--n-bezier);
  color: var(--theme-color);
}
</style>
