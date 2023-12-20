---
title: Vue 对 HTML 自定义渲染
date: 2022-02-27 20:00:00
tag: [简单记录]
description: Vue 对 HTML 自定义渲染
---

```typescript
import { defineComponent, h } from 'vue';
import { NH1, NH2, NH3, NH4, NH5, NH6, NBlockquote, NP, NText, NScrollbar, NA } from 'naive-ui';
import TextSlot from '../components/TextSlot.vue';

const render: (nodeList: Node) => any = (nodeList) => {
  //@ts-ignore
  if (nodeList.nodeName === '#text') return h(TextSlot, null, () => nodeList.nodeValue);
  const childs = () => Array.from(nodeList.childNodes).map((node) => render(node));
  switch (nodeList.nodeName) {
    case 'H1':
      return h(NH1, null, childs);
    case 'H2':
      return h(NH2, null, childs);
    case 'H3':
      return h(NH3, null, childs);
    case 'H4':
      return h(NH4, null, childs);
    case 'H5':
      return h(NH5, null, childs);
    case 'H6':
      return h(NH6, null, childs);
    case 'P':
      return h(NP, null, childs);
    case 'BLOCKQUOTE':
      return h(NBlockquote, null, childs);
    case 'PRE':
      return h(NScrollbar, { xScrollable: true, style: { maxWidth: '90vw' } }, () =>
        h('pre', {
          innerHTML: (nodeList as HTMLPreElement).innerHTML,
        }),
      );
    case 'A':
      return h(
        NA,
        { href: (nodeList as HTMLAnchorElement).href },
        () => (nodeList as HTMLAnchorElement).innerText,
      );
    case 'OL':
      return h('ol', { innerHTML: (nodeList as Element).innerHTML }, childs);
    case 'UL':
      return h('ul', { innerHTML: (nodeList as Element).innerHTML }, childs);
    case 'BR':
      return h('br', null, childs);
    case 'CODE':
      return h('code', null, (nodeList as any).innerText);
    default:
      console.log(nodeList);
      return Array.from(nodeList.childNodes).map((node) => render(node));
  }
};

const parseHtml = (htmlStr: string) => {
  if (!htmlStr) return null;
  const parser = new DOMParser();
  const dom = parser.parseFromString(htmlStr, 'text/html');
  const renderedChilds = Array.from(dom.childNodes).map((node) => render(node));
  const ret = h(
    'div',
    {
      style: {
        marginLeft: '0.5rem',
        marginRight: '0.5rem',
      },
    },
    renderedChilds,
  );
  console.log(ret);
  return ret;
};

const PPPPPP = defineComponent({
  props: { htmlStr: String },
  setup() {},
  render() {
    return parseHtml(this.$props.htmlStr!) || h('div');
  },
});

export default PPPPPP;
```

上面的代码来自我[废弃的博客系统](https://github.com/BeiyanYunyi/Boron)。简简单单遍历个 DOM 树然后渲染就行了，没啥好说的。

实际上也可以用`querySelectorAll`来做，把特定元素替换成自定义元素，然后注册`Web Components`解决之。

博客系统写到一半，这边 vuepress-theme-hope 的 bug 已经被解决掉了，所以直接上 vuepress 摆烂。看看回头开发 HexoSharp 怎么样。
