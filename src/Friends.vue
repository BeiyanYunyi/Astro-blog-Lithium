<template>
  <n-space vertical>
    <n-a v-for="friend in friends" :href="friend.url">
      <n-card hoverable embedded content-style="padding: 0.25rem 0.5rem 0.25rem 0.5rem">
        <n-thing :title="friend.title" :description="friend.description">
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

<style module></style>
