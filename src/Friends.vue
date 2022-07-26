<template>
  <div :class="$style.stack">
    <ClientOnly>
      <a
        v-for="(friend, index) in friendRenderList"
        :class="{ [$style.firstElement]: index === 0 }"
        :key="friend.url"
        :href="friend.url"
      >
        <div :class="$style.card">
          <div :class="$style.cardLayer1">
            <img height="75" width="75" :src="friend.avatar" :class="$style.avatar" />

            <div :class="$style.cardLayer2">
              <div :class="$style.title">{{ friend.title }}</div>
              <div :class="$style.content">{{ friend.description }}</div>
            </div>
          </div>
        </div>
      </a>
    </ClientOnly>
  </div>
</template>

<script lang="ts" setup>
import friends from '../docs/_data/friends.json';


const shuffle = <T>(arr: T[]) => {
  let l = arr.length;
  const brr = arr;
  while (l > 0) {
    const index = Math.floor(Math.random() * l);
    const temp = brr[l - 1];
    brr[l - 1] = brr[index];
    brr[index] = temp;
    l -= 1;
  }
  return brr;
};

const [dustella, ...toshuffle] = friends;
const friendRenderList = [dustella, ...shuffle(toshuffle)];
</script>

<style module>
.card {
  background-color: var(--bg-color-blur);
  transition: all 0.25s;
  padding: 0.5rem 0.5rem 0.25rem 0.5rem;
  outline: 1px solid var(--border-color);
  overflow-wrap: break-word;
}

.card:hover {
  box-shadow: 0 1px 3px 1px var(--card-shadow);
  text-decoration: underline;
}

.card:hover .title {
  text-decoration: underline;
}

.card:hover .content {
  text-decoration: underline;
}

.content {
  color: var(--text-color);
  margin-top: 0.25rem;
  font-size: 14px;
}

.title {
  font-size: 16px;
  font-weight: var(--n-title-font-weight);
  transition: color 0.3s var(--n-bezier);
  color: var(--theme-color);
}

.stack {
  display: flex;
  flex-direction: column;
}

.stack a {
  margin-top: 0.5rem;
}

.stack a.firstElement {
  margin-top: 0;
}

.cardLayer1 {
  display: inline-flex;
  flex-direction: row;
}

.cardLayer2 {
  display: inline-flex;
  flex-direction: column;
}

.avatar {
  margin-right: 0.75rem;
}
</style>
