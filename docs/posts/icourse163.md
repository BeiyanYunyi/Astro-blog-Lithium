---
title: 用 JavaScript 摆烂中国大学 MOOC 互评
date: 2022-04-03 21:24:00
description: 迅速解决中国大学 MOOC 互评问题
tag: [教程]
---
![1648991841065-图片.png](https://hsp.penclub.club/api/gh/https://raw.githubusercontent.com/lixiang810/fk-gfw/master/hsp/1648991841065-%E5%9B%BE%E7%89%87.png)

如图，中国大学 MOOC 要求我们完成作业后对他人作业进行互评，还要至少评 5 份。我的这份作业，每人有 3 道题，每题有 3 道小题，评分是用 `<input type="checkbox">` 完成的，这一堆单选框一字排开，操作也不符合人体工程学。评分是一项机械劳动，而将人从机械劳动中解放出来是科学发展的目标之一。

算了不扯那么多了，直接上脚本。在评分页面打开浏览器 Console 后输入即可把每道题都评满分，并给出一个“好”字作为评语。

```javascript
Array.from(document.querySelectorAll("div.s")).forEach((ele) => {
  const c = Array.from(ele.querySelectorAll("input"));
  c[c.length - 1].checked = true;
});
Array.from(document.querySelectorAll("textarea")).forEach((ele) => {
  ele.value = "好";
});

```
