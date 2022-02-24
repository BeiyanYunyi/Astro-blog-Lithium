import { defineNavbarConfig } from "vuepress-theme-hope";

export default defineNavbarConfig([
  "/",
  {
    text: "博客主题",
    icon: "note",
    link: "https://vuepress-theme-hope.github.io/v2/zh/",
  },
  { text: "友链", icon: "link", link: "/links" },
]);
