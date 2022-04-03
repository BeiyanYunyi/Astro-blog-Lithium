---
title: Cloudflare Pages 可能存在关键词审查
date: 2022-04-03 15:13:00
description: 我的《乌云典当记》歌词浅析连续部署失败三次，似乎是因为触发了关键词审查。
tag: [杂谈]
---
![图片.png-1648970121148](https://hsp.penclub.club/api/gh/https://raw.githubusercontent.com/lixiang810/fk-gfw/master/hsp/%E5%9B%BE%E7%89%87.png-1648970121148)

![Screenshot 2022-04-03 at 15-17-02 Lixiang3@outlook.com's Account Cloudflare.png-1648970243334](https://hsp.penclub.club/api/gh/https://raw.githubusercontent.com/lixiang810/fk-gfw/master/hsp/Screenshot%202022-04-03%20at%2015-17-02%20Lixiang3%40outlook.com's%20Account%20Cloudflare.png-1648970243334)

从图中可见，我的博客构建过程一切正常，而在“部署至全球网络”时出现了“内部错误”。

因为这也是我博文的一部分，所以具体哪些词触发了审查就不写出来了。相关的 commit 记录可以看我的 [repo](https://github.com/lixiang810/comb/commits/main)，避了好几个讳之后才构建成功。

作为一个还要吃中国饭的公司，Cloudflare 这样做无可厚非。而作为 Cloudflare 服务的重度使用者，我也不好再骂什么。不过，写这篇文章出来，提醒一下相关的使用者还是可以的。
