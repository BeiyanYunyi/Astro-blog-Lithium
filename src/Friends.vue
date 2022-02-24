<template>
  <n-list>
    <n-a v-for="friend in friends" :href="friend.url">
      <n-list-item>
        <template #prefix>
          <n-thing></n-thing>
        </template>
        <n-thing :title="friend.title" :description="friend.description">
          <template #avatar>
            <n-image height="100" width="100" :src="friend.avatar" :preview-disabled="true" />
          </template>
        </n-thing>
      </n-list-item>
    </n-a>
  </n-list>
</template>

<script lang="ts" setup>
import friends from '../docs/_data/friends.json';
import { NImage, NList, NListItem, NThing,NA } from 'naive-ui';
</script>

<style module>
</style>
