---
title: 如何把 waline 服务端的体积缩小 60%
date: 2025-10-26 10:17:04
description: waline 是我的博客目前使用的评论系统。它有比较丰富的生态和比较高的适应性（可以部署在各类托管环境中），但在我的使用环境下，它有非常多可以精简的地方。
image: src/assets/walineServerSlim.svg
tag:
  - 项目
  - 教程
---

[waline](https://github.com/walinejs/waline) 是我的博客目前使用的评论系统。它有比较丰富的生态和比较高的适应性（可以部署在各类托管环境中），但在我的使用环境下，它有非常多可以精简的地方。

## 首先，让它跑起来

[它的官方文档](https://waline.js.org/guide/deploy/vps.html#%E7%9B%B4%E6%8E%A5%E8%BF%90%E8%A1%8C-%E6%8E%A8%E8%8D%90)会告诉你，随便新建一个包，在里面加入 @waline/vercel 这个依赖，然后 `node node_modules/@waline/vercel/vanilla.js` 就能跑起来。让我们来看看它的代码：

```javascript
const path = require('node:path')

const Application = require('thinkjs')

const instance = new Application({
  ROOT_PATH: __dirname,
  APP_PATH: path.join(__dirname, 'src'),
  proxy: true, // use proxy
  env: 'production',
})

instance.run()

let config = {}

try {
  config = require('./config.js')
}
catch {
  // do nothing
}
for (const k in config) {
  think.config(k, config[k])
}
```

代码大概可以分为两部分，一部分是引用 thinkjs，从自己的目录中创建服务，一部分是加载命令执行目录下的 config.js，如果 config.js 不存在，就不加载。

出于审美因素，我并不希望使用诸如 `node node_modules/@waline/vercel/vanilla.js` 这样的方式来运行它。在我眼里，node_modules 最好保持一个封闭的黑盒状态，而不应该从外部执行其中的库。waline 完全可以使用 package.json 里的 bin 字段，将 vanilla.js 重命名为 waline.js，再定义为一个 bin，此后用 npm exec waline 就可以启动了。

于是我把它复制出来，改写一下，命名为 index.js，并且加入 thinkjs 这个依赖：

```javascript
import { createRequire } from 'node:module'
import path from 'node:path'
import Application from 'thinkjs'

const require = createRequire(import.meta.url)

const ROOT_PATH = path.resolve(require.resolve('@waline/vercel'), '..')

const instance = new Application({
  ROOT_PATH,
  APP_PATH: path.resolve(ROOT_PATH, 'src'),
  proxy: true, // use proxy
  env: 'production',
})

instance.run()

let config = {}

try {
  const { default: conf } = await import('./config.js')
  config = conf
}
catch {
  // do nothing
}
for (const k in config) {
  think.config(k, config[k])
}
```

注意这里的 require.resolve 实际上也可以用 import.meta.resolve（目前处于 rc 状态）来替代，作用是获取 @waline/vercel 这个依赖的路径（在 node_modules 里），并将它传递给 thinkjs，完成创建。

这样以后，可以先启动一下，看看效果（指定 SQLITE_PATH 这个环境变量，让 waline 使用 SQLite）：

```bash
SQLITE_PATH="./data" node index.js
```

在 data 目录中已经[存在 waline.sqlite](https://waline.js.org/guide/database.html#sqlite) 的情况下，这样应该能顺利运行。

这时，我的 [waline-docker-slim](https://github.com/BeiyanYunyi/waline-docker-slim) 总共包含 562 个依赖，node_modules 体积大概是 200MB。

## 移除 ljharb 和不必要的数据库 sdk

显然，我们首先要做的是执行 [nolyfill](https://github.com/SukkaW/nolyfill)，把 ljharb 的毫无必要的兼容库（目的是让依赖它的库具有对 Node.js 4 的兼容性，而我在使用 Node.js 24）移除：

```bash
pnpm dlx nolyfill install
pnpm i
pnpm dedupe
pnpm prune
```

现在依赖项减少到了 533 个，node_modules 体积变化不大（小了一两 M）。

让我们执行 antfu 的 node-modules-inspector，看看现在 node_modules 里面都有啥：

```bash
pnpm dlx node-modules-inspector
```

![image](https://s3.penclub.club/alist/blog/image-20251024172810-nfi9v9i.png)

显然，leancloud-storage 占了半壁江山，很符合我对国产 npm 包的想象（ref：腾讯云挨喷的那个 SDK）。我使用 SQLite 作为我的数据库，因此完全不需要它。在这种情况下，我们可以用和 nolyfill 一样的方式，在 package.json 中通过 pnpm.overrides 把它移除（"-" 表示不安装）：

```json
{
  "pnpm": {
    "overrides": {
      "abab": "npm:@nolyfill/abab@^1",
      "deep-equal": "npm:@nolyfill/deep-equal@^1",
      "es-set-tostringtag": "npm:@nolyfill/es-set-tostringtag@^1",
      "hasown": "npm:@nolyfill/hasown@^1",
      "is-generator-function": "npm:@nolyfill/is-generator-function@^1",
      "is-nan": "npm:@nolyfill/is-nan@^1",
      "isarray": "npm:@nolyfill/isarray@^1",
      "number-is-nan": "npm:@nolyfill/number-is-nan@^1",
      "safe-buffer": "npm:@nolyfill/safe-buffer@^1",
      "safer-buffer": "npm:@nolyfill/safer-buffer@^1",
      "side-channel": "npm:@nolyfill/side-channel@^1",
      "leancloud-storage": "-"
    }
  }
}
```

这一下子就少了 67 个依赖。剩余依赖 466 个，node_modules 体积小了 74M，剩余 125.9M。

且慢！在继续下去以前，让我们先试着启动一下。

```bash
pnpm i
SQLITE_PATH="./data" node index.js
```

可以启动。真的吗？

```bash
pnpm prune
SQLITE_PATH="./data" node index.js
```

这下不行了，注意到这行报错：

```plaintext
Error: Cannot find module 'leancloud-storage'
```

以及报错栈第一行：

```plaintext
- waline-docker-slim/node_modules/.pnpm/@waline+vercel@1.32.3_encoding@0.1.13/node_modules/@waline/vercel/src/service/storage/leancloud.js
```

顺着找过去，注意到第一行：

```js
const AV = require('leancloud-storage')
```

显然，这个 src/service/storage/leancloud.js 被谁给加载（执行）了，并且它自己 require 了 leancloud-storage，这就是前面报错的来源。为此，我们需要修改 @waline/vercel 这个包（报错栈路径第一个版本号前面的就是包名），移除对 leancloud 的依赖：

```bash
pnpm patch @waline/vercel
```

然而在整个包中，我们并没有找到任何加载 leancloud.js 的代码。看来，这是 thinkjs 内部的动态加载机制，直接加载 service 下的所有 js。这样一来，我们直接把 leancloud.js 删掉就好。在这之后，通过 `pnpm patch-commit <路径>` 来应用修改。

```bash
pnpm patch-commit <路径>
SQLITE_PATH="./data" node index.js
```

这下没有报错、能正常运行了。

OK，让我们如法炮制，移除掉其他的存储依赖，留下一个 sqlite 即可。

不过，waline 对 MongoDB 的引入比较特殊，使用了 think-mongo 这个库，需要在 src/config/extend.js 里修改并应用，这里给出 patch 文件的一部分：

```diff
diff --git a/src/config/extend.js b/src/config/extend.js
index 80a472dab22bc4b2929066670e673f0e2cb91cc7..44877635a09cd4724b0dcfd3290971aae4b73c02 100644
--- a/src/config/extend.js
+++ b/src/config/extend.js
@@ -1,6 +1,5 @@
 const fetch = require('node-fetch');
 const Model = require('think-model');
-const Mongo = require('think-mongo');

 const { isNetlify, netlifyFunctionPrefix } = require('./netlify');

@@ -8,7 +7,6 @@ const isDeta = think.env === 'deta' || process.env.DETA_RUNTIME === 'true';

 module.exports = [
   Model(think.app),
-  Mongo(think.app),
   {
     context: {
       get serverURL() {
```

这时，依赖剩下 393 个（-73），node_modules 剩余 115.9M（-10M）

## 重写 akismet

让我们把目光投向 node-modules-inspector 的树状图，其中 akismet 这个依赖特别引人注目：它只有一个 request 作为直接依赖，但 request 却依赖了大量其他库。这就意味着，如果我们能去除这个 request 依赖，我们就能砍掉几十个依赖项。

![image](https://s3.penclub.club/alist/blog/image-20251026002909-wyoszkv.png)

request 这个库显然是远古时代拿来发请求的，过去一看确实如此。让我们用 Node 16 开始已经自带的 fetch，把 akismet 重写一遍。当然由于接口有更改（从回调改成了 Promise），waline 里面也要改一部分。可见于[这个 commit](https://github.com/BeiyanYunyi/waline-docker-slim/commit/189ba46062865036fc3bf8ea0e9179668de5c24f)。

这样以后，production 依赖剩余 357 个（-36），node_modules 剩余 111M（-5M）。

## 移除 mathjax

![image](https://s3.penclub.club/alist/blog/image-20251026132253-zws8g16.png)

现在，让我们把目光投向剩下的那个最大的依赖：mathjax。这是用于 $\LaTeX$ 公式渲染的库，但对于轻量需求，$\KaTeX$ 已经足够，我博客内的公式也使用 $\KaTeX$。

注意到 mathjax 既是 @waline/vercel 的直接依赖，又是 @waline/vercel 通过 @mdit/plugin-mathjax 的间接依赖：

```bash
$ pnpm why mathjax-full

Legend: production dependency, optional only, dev only

waline-docker-slim@0.0.1 <path>/waline-docker-slim

dependencies:
@waline/vercel 1.32.3
├─┬ @mdit/plugin-mathjax 0.4.8
│ └── mathjax-full 3.2.2
└── mathjax-full 3.2.2
```

因此我需要同时移除这两个库（在 package.json 的 pnpm.overrides 里）：

```json
{
  "@mdit/plugin-mathjax": "-",
  "mathjax-full": "-"
}
```

看看能否启动：

```bash
pnpm prune
SQLITE_PATH="./data" node index.js
```

显然不可以：

```bash
Error: Cannot find module 'mathjax-full/js/adaptors/liteAdaptor.js'
Require stack:
- <path>/node_modules/.pnpm/@waline+vercel@1.32.3_patch_hash=6dd1593ea56af3e67b4fe9fdc18ff84832ff34a1317c44d4caa4887d9591f79a/node_modules/@waline/vercel/src/service/markdown/mathjax.js
- <path>/node_modules/.pnpm/@waline+vercel@1.32.3_patch_hash=6dd1593ea56af3e67b4fe9fdc18ff84832ff34a1317c44d4caa4887d9591f79a/node_modules/@waline/vercel/src/service/markdown/index.js
```

这提示我们要去修改这两个文件，用之前 pnpm patch 的方法修改如下：

```diff
diff --git a/src/service/markdown/index.js b/src/service/markdown/index.js
index 4cc808b7ad03089c4a213af5a918cf0811a5431b..e6a8273399721e1be61a07b763fff6463e772e5f 100644
--- a/src/service/markdown/index.js
+++ b/src/service/markdown/index.js
@@ -5,7 +5,6 @@ const MarkdownIt = require('markdown-it');
 const emojiPlugin = require('markdown-it-emoji');

 const { resolveHighlighter } = require('./highlight.js');
-const { mathjaxPlugin } = require('./mathjax.js');
 const { sanitize } = require('./xss.js');

 const getMarkdownParser = () => {
@@ -31,7 +30,7 @@ const getMarkdownParser = () => {
     html: true,
   });

-  const { emoji, tex, mathjax, katex, sub, sup } = plugin;
+  const { emoji, tex, katex, sub, sup } = plugin;

   // parse emoji
   if (emoji !== false) {
@@ -55,7 +54,7 @@ const getMarkdownParser = () => {
       output: 'mathml',
     });
   } else if (tex !== false) {
-    markdownIt.use(mathjaxPlugin, mathjax);
+    throw new Error(`tex plugin "${tex}" is not supported`);
   }

   return (content) => sanitize(markdownIt.render(content));
diff --git a/src/service/markdown/mathjax.js b/src/service/markdown/mathjax.js
deleted file mode 100644
index 24007229b371a991f9297527af387f2f32a507eb..0000000000000000000000000000000000000000
```

删除 markdown/mathjax.js，修改 markdown/index.js。

这样以后，依赖数剩余 338 个（-19），node_modules 剩余 67.3M（-43.7M）。

## 移除 sqlite3

最新的 Node.js 和 Bun 中都已经内置了 SQLite 支持，不再需要 `sqlite3`​ 这个库（就算需要，也应该用 `better-sqlite3`​ 而不是 `sqlite3`）。

不难发现，`sqlite3`​ 是 `think-model-sqlite` 的依赖：

```bash
$ pnpm why sqlite3

Legend: production dependency, optional only, dev only

waline-docker-slim@0.0.1 <path>/waline-docker-slim

dependencies:
@waline/vercel 1.32.3
└─┬ think-model-sqlite 1.3.2
  └── sqlite3 5.1.7
```

把它重写一次，用 Bun 自带的 sqlite 来代替。可见于[这个 commit](https://github.com/BeiyanYunyi/waline-docker-slim/commit/75ff14e67531a54022e71d4c8d1f955412f253f0)。

最终的结果如下：

||精简前|精简后|
| ---------------------| ------| ------|
|Docker 镜像解包后大小|~360MB|~160MB|
|production 依赖数目|540|252|
|node_modules 体积|~180MB|~64MB|

Docker 镜像体积减小的 200M 中，有 ~120MB 来自 node_modules 的精简，有 ~50MB 来自从 Node.js 切换到 Bun 带来的运行时精简，其余 30-40MB 可能来自打包方式的改变。

## 后记

就服务器成本而言，我并不需要这么做，因为 200MB 的体积无伤大雅，何况 RAM 占用几乎不变。waline 也有了一个由第三方完成的，体积不到 10M、RAM 占用不到 6M 的 Rust 重写：[waline-mini](https://github.com/JQiue/waline-mini)。

不过我觉得这很酷，是我近来前端基础设施经验的一次体现。此外，我还针对 waline 进行了更多定制，去除了恶俗的 IP 属地展示，增加了对缠扰者王旷逸的屏蔽措施，“可扩展性”也是 waline-mini 所欠缺的。

就我的需求而言，dy-node-ip2region 这个依赖（用于计算 IP 属地）也是可以删除的，留作习题答案略，读者自证不难。
