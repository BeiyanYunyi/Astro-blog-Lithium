# 欢迎访问 hexo-plugin-gitalk 官网 👋

[![npm:version](https://img.shields.io/npm/v/hexo-plugin-gitalk.svg)](https://www.npmjs.com/package/hexo-plugin-gitalk)
[![npm:download](https://img.shields.io/npm/dt/hexo-plugin-gitalk.svg)](https://www.npmjs.com/package/hexo-plugin-gitalk)
[![github:documentation](https://img.shields.io/badge/documentation-yes-brightgreen.svg)](https://github.com/snowdreams1006/hexo-plugin-gitalk#readme)
[![github:maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/snowdreams1006/hexo-plugin-gitalk/graphs/commit-activity)
[![npm:license](https://img.shields.io/npm/l/hexo-plugin-gitalk.svg)](https://github.com/snowdreams1006/hexo-plugin-gitalk/blob/master/LICENSE)
[![github:snodreams1006](https://img.shields.io/badge/github-snowdreams1006-brightgreen.svg)](https://github.com/snowdreams1006)
[![微信公众号:雪之梦技术驿站-brightgreen.svg](https://img.shields.io/badge/%E5%BE%AE%E4%BF%A1%E5%85%AC%E4%BC%97%E5%8F%B7-%E9%9B%AA%E4%B9%8B%E6%A2%A6%E6%8A%80%E6%9C%AF%E9%A9%BF%E7%AB%99-brightgreen.svg)](https://snowdreams1006.github.io/snowdreams1006-wechat-public.jpeg)

> Hexo 整合 gitalk 组件实现博客评论功能

### 🏠 [主页](https://github.com/snowdreams1006/hexo-plugin-gitalk#readme)

## 效果

![gitalk-use-preview.png](gitalk-use-preview.png)

## 用法

### Step #1 - 更新 `_config.yml` 配置文件

在 `_config.yml` 配置文件中,配置 `gitalk` 插件相关信息,详情见 [gitalk](https://github.com/gitalk/gitalk).

```yml
plugins:
  gitalk:
    clientID: GitHub Application Client ID
    clientSecret: GitHub Application Client Secret
    repo: GitHub repo
    owner: GitHub repo owner
    admin: 
      - GitHub repo owner and collaborators, only these guys can initialize github issues
    distractionFreeMode: false
```

> 注意: 前往 [gitalk](https://github.com/gitalk/gitalk) 申请开通 `gitalk` 功能后,**一定要替换成自己的相关配置**!

其中,主要配置参数含义如下: 

- **clientID** `String` 

  **必须**. GitHub Application Client ID.

- **clientSecret** `String` 

  **必须**. GitHub Application Client Secret.

- **repo** `String` 

  **必须**. GitHub repository.

- **owner** `String` 

  **必须**. GitHub repository 所有者，可以是个人或者组织。

- **admin** `Array` 

  **必须**. GitHub repository 的所有者和合作者 (对这个 repository 有写权限的用户)。

- **distractionFreeMode** `Boolean` 
  
  Default: false。

  类似Facebook评论框的全屏遮罩效果.

### Step #2 - 运行 hexo 相关命令

- 运行 `npm install` 命令安装到本地项目

```bash
$ npm install hexo-plugin-gitalk --save
```

- 运行 `hexo generate` 命令构建本地项目或者 `hexo server` 启动本地服务.

```bash
$ hexo generate
```

或者

```bash
$ hexo server
```

> 注意: 本地测试时无法正常运行,必须是线上环境才会生效,且必须由管理员登录github进行初始化.

## 示例

不仅 [hexo-plugin-gitalk](https://github.com/snowdreams1006/hexo-plugin-gitalk) **官方文档**已整合 `gitalk` 版权保护插件,此外还提供了示例项目,详情参考 `example` 目录.

- [官方文档](https://github.com/snowdreams1006/hexo-plugin-gitalk/tree/master/docs)
- [官方示例](https://github.com/snowdreams1006/hexo-plugin-gitalk/tree/master/example)

## 作者

👤 **snowdreams1006**

- Github: [@snowdreams1006](https://github.com/snowdreams1006)
- Email: [snowdreams1006@163.com](mailto:snowdreams1006@163.com)

## 🤝 贡献

如果你想贡献自己的一份力量,欢迎提交 [`Issues`](https://github.com/snowdreams1006/hexo-plugin-gitalk/issues) 或者 `Pull Request` 请求!

## 支持

如果本项目对你有所帮助,欢迎 ⭐️ [hexo-plugin-gitalk](https://github.com/snowdreams1006/hexo-plugin-gitalk) 项目,感谢你的支持与认可!

## 📝 版权

Copyright © 2019 [snowdreams1006](https://github.com/snowdreams1006).

This project is [MIT](https://github.com/snowdreams1006/hexo-plugin-gitalk/blob/master/LICENSE) licensed.