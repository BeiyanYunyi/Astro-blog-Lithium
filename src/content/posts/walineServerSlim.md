---
title: 如何把waline服务端的体积缩小60%
date: 2025-10-26 10:17:04
description: waline是我的博客目前使用的评论系统。它有比较丰富的生态和比较高的适应性（可以部署在各类托管环境中），但在我的使用环境下，它有非常多可以精简的地方。
image: ../../assets/walineServerSlim.svg
tag:
  - 项目
  - 教程
---

[waline](https://github.com/walinejs/waline) 是我的博客目前使用的评论系统。它有比较丰富的生态和比较高的适应性（可以部署在各类托管环境中），但在我的使用环境下，它有非常多可以精简的地方。

## 首先，让它跑起来

[它的官方文档](https://waline.js.org/guide/deploy/vps.html#%E7%9B%B4%E6%8E%A5%E8%BF%90%E8%A1%8C-%E6%8E%A8%E8%8D%90)会告诉你，随便新建一个包，在里面加入 @waline/vercel这个依赖，然后 `node node_modules/@waline/vercel/vanilla.js` 就能跑起来。让我们来看看它的代码：

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

代码大概可以分为两部分，一部分是引用thinkjs，从自己的目录中创建服务，一部分是加载命令执行目录下的config.js，如果config.js不存在，就不加载。

出于审美因素，我并不希望使用诸如 `node node_modules/@waline/vercel/vanilla.js` 这样的方式来运行它。在我眼里，node_modules最好保持一个封闭的黑盒状态，而不应该从外部执行其中的库。waline完全可以使用package.json里的bin字段，将vanilla.js重命名为waline.js，再定义为一个bin，此后用npm exec waline就可以启动了。

于是我把它复制出来，改写一下，命名为index.js，并且加入thinkjs这个依赖：

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

注意这里的require.resolve实际上也可以用import.meta.resolve（目前处于rc状态）来替代，作用是获取 @waline/vercel这个依赖的路径（在node_modules里），并将它传递给thinkjs，完成创建。

这样以后，可以先启动一下，看看效果（指定SQLITE_PATH这个环境变量，让waline使用SQLite）：

```bash
SQLITE_PATH="./data" node index.js
```

在data目录中已经[存在waline.sqlite](https://waline.js.org/guide/database.html#sqlite) 的情况下，这样应该能顺利运行。

这时，我的 [waline-docker-slim](https://github.com/BeiyanYunyi/waline-docker-slim) 总共包含562个依赖，node_modules体积大概是200MB。

## 移除ljharb和不必要的数据库sdk

显然，我们首先要做的是执行 [nolyfill](https://github.com/SukkaW/nolyfill)，把ljharb的毫无必要的兼容库（目的是让依赖它的库具有对Node.js 4的兼容性，而我在使用Node.js 24）移除：

```bash
pnpm dlx nolyfill install
pnpm i
pnpm dedupe
pnpm prune
```

现在依赖项减少到了533个，node_modules体积变化不大（小了一两M）。

让我们执行antfu的node-modules-inspector，看看现在node_modules里面都有啥：

```bash
pnpm dlx node-modules-inspector
```

![image](https://s3.penclub.club/alist/blog/image-20251024172810-nfi9v9i.png)

显然，leancloud-storage占了半壁江山，很符合我对国产npm包的想象（ref：腾讯云挨喷的那个SDK）。我使用SQLite作为我的数据库，因此完全不需要它。在这种情况下，我们可以用和nolyfill一样的方式，在package.json中通过pnpm.overrides把它移除（"-" 表示不安装）：

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

这一下子就少了67个依赖。剩余依赖466个，node_modules体积小了74M，剩余125.9M。

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

显然，这个src/service/storage/leancloud.js被谁给加载（执行）了，并且它自己require了leancloud-storage，这就是前面报错的来源。为此，我们需要修改 @waline/vercel这个包（报错栈路径第一个版本号前面的就是包名），移除对leancloud的依赖：

```bash
pnpm patch @waline/vercel
```

然而在整个包中，我们并没有找到任何加载leancloud.js的代码。看来，这是thinkjs内部的动态加载机制，直接加载service下的所有js。这样一来，我们直接把leancloud.js删掉就好。在这之后，通过 `pnpm patch-commit <路径>` 来应用修改。

```bash
pnpm patch-commit <路径>
SQLITE_PATH="./data" node index.js
```

这下没有报错、能正常运行了。

OK，让我们如法炮制，移除掉其他的存储依赖，留下一个sqlite即可。

不过，waline对MongoDB的引入比较特殊，使用了think-mongo这个库，需要在src/config/extend.js里修改并应用，这里给出patch文件的一部分：

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

这时，依赖剩下393个（-73），node_modules剩余115.9M（-10M）

## 重写akismet

让我们把目光投向node-modules-inspector的树状图，其中akismet这个依赖特别引人注目：它只有一个request作为直接依赖，但request却依赖了大量其他库。这就意味着，如果我们能去除这个request依赖，我们就能砍掉几十个依赖项。

![image](https://s3.penclub.club/alist/blog/image-20251026002909-wyoszkv.png)

request这个库显然是远古时代拿来发请求的，过去一看确实如此。让我们用Node 16开始已经自带的fetch，把akismet重写一遍。当然由于接口有更改（从回调改成了Promise），waline里面也要改一部分。可见于[这个commit](https://github.com/BeiyanYunyi/waline-docker-slim/commit/189ba46062865036fc3bf8ea0e9179668de5c24f)。

这样以后，production依赖剩余357个（-36），node_modules剩余111M（-5M）。

## 移除mathjax

![image](https://s3.penclub.club/alist/blog/image-20251026132253-zws8g16.png)

现在，让我们把目光投向剩下的那个最大的依赖：mathjax。这是用于 $\LaTeX$ 公式渲染的库，但对于轻量需求，$\KaTeX$ 已经足够，我博客内的公式也使用 $\KaTeX$。

注意到mathjax既是 @waline/vercel的直接依赖，又是 @waline/vercel通过 @mdit/plugin-mathjax的间接依赖：

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

因此我需要同时移除这两个库（在package.json的pnpm.overrides里）：

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

这提示我们要去修改这两个文件，用之前pnpm patch的方法修改如下：

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

删除markdown/mathjax.js，修改markdown/index.js。

这样以后，依赖数剩余338个（-19），node_modules剩余67.3M（-43.7M）。

## 移除sqlite3

最新的Node.js和Bun中都已经内置了SQLite支持，不再需要 `sqlite3`​ 这个库（就算需要，也应该用 `better-sqlite3`​ 而不是 `sqlite3`）。

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

把它重写一次，用Bun自带的sqlite来代替。可见于[这个commit](https://github.com/BeiyanYunyi/waline-docker-slim/commit/75ff14e67531a54022e71d4c8d1f955412f253f0)。

最终的结果如下：

|                      | 精简前 | 精简后 |
| -------------------- | ------ | ------ |
| Docker镜像解包后大小 | ~360MB | ~160MB |
| production依赖数目   | 540    | 252    |
| node_modules体积     | ~180MB | ~64MB  |

Docker镜像体积减小的200M中，有 ~120MB来自node_modules的精简，有 ~50MB来自从Node.js切换到Bun带来的运行时精简，其余30-40MB可能来自打包方式的改变。

## 后记

就服务器成本而言，我并不需要这么做，因为200MB的体积无伤大雅，何况RAM占用几乎不变。waline也有了一个由第三方完成的，体积不到10M、RAM占用不到6M的Rust重写：[waline-mini](https://github.com/JQiue/waline-mini)。

不过我觉得这很酷，是我近来前端基础设施经验的一次体现。此外，我还针对waline进行了更多定制，去除了恶俗的IP地址记录和属地展示，增加了对缠扰者王旷逸的屏蔽措施，“可扩展性”也是waline-mini所欠缺的。

容易看出，就我的需求而言，dy-node-ip2region这个依赖（用于计算IP属地）也是可以删除的，留作习题答案略，读者自证不难。
