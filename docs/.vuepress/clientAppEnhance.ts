import { defineClientAppEnhance } from '@vuepress/client';
import Friends from '../../src/Friends.vue';

export default defineClientAppEnhance(({ app, router, siteData }) => {
  app.component('Friends', Friends);
});
