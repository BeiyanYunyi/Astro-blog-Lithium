---
title: 如何编译Mozilla Firefox
date: 2021-01-02 17:25:20
tag: [教程]
description: 如何编译 Mozilla Firefox
---

如何编译 Mozilla Firefox

<!--more-->

文章大部翻译改编自：

[https://firefox-source-docs.mozilla.org/contributing/contribution_quickref.html](https://firefox-source-docs.mozilla.org/contributing/contribution_quickref.html)

[https://davidwalsh.name/how-to-build-firefox](https://davidwalsh.name/how-to-build-firefox)

这个过程中的某些部分，包括 clone 和编译，即使在现代硬件上也会花费很长的时间。如果遇到困难，任何时候都不要犹豫，去[https://chat.mozilla.org](https://chat.mozilla.org)的#introduction 频道问出来。当然，你得**懂英文**。

使用的大部分软件仓库都由 Mozilla 管理（并且没有镜像源），尽管并非完全无法访问，中国大陆用户依旧可能需要一定的网络加速服务及镜像源，在此简单介绍一下。

### Linux 用户

代理软件：cgproxy+任何 socks5/http 代理均可。cgproxy 使用方法请自行查找 GitHub 同名项目，当然，得**懂英文**。

镜像源：除了 Linux 发行版软件源以外，编译过程中还会用到 pip 的软件源，因此请逐一设置好镜像源。镜像源的作用是加速安装编译依赖的过程，而并不能对其余大多数过程起加速作用。

除了 Debian 系和 RedHat 系以外的发行版应该也能进行编译，比如我的 Archlinux 就成功搞定了全过程。尽管如此，我推荐新人使用 Ubuntu 或其衍生版（kubuntu 等）

## clone 源码

首先你需要安装 Mercurial，canonical 编写的版本管理系统。安装方式视你的发行版而定，对 archlinux 用户而言应该是这样：

```bash
sudo pacman -S mercurial
```

其实用 Git 也可以，但我懒得写了。人家这么推荐就这么用吧。

然后

```bash
hg clone https://hg.mozilla.org/mozilla-central/
```

克隆可能需要 10 分钟到几个小时（取决于你的连接速度），clone 下来的仓库应该小于 5GB，但构建后可能会占用约 20GB 的空间，请先确保你有这个空间。我在 2021 年 1 月 2 日编译后占用的大小是 20.4GB。除此以外，编译器等编译依赖也需要一定的空间，因此 30GB 的剩余空间会是一个比较保险的条件。

## 安装依赖（Linux/Mac）

```bash
cd mozilla-central
./mash bootstrap
```

推荐使用默认选项（也就是一路回车）。

## 安装依赖（Windows）

1. 你需要 64 位的 Windows7 或更新的系统。
2. 下载并安装[Visual Studio Community Edition](https://visualstudio.microsoft.com/downloads/)。
3. 下载[MozillaBuild](https://ftp.mozilla.org/pub/mozilla.org/mozilla/libraries/win32/MozillaBuildSetup-Latest.exe)。默认安装目录是`C:\mozilla-build`
4. 进行下一步操作前，请确保你完成了[这些要求](https://firefox-source-docs.mozilla.org/setup/windows_build.html#building-firefox-on-windows)（比这篇教程还长了，不翻译）。

此后的命令你需要在 mozilla-build 环境里执行，也就是打开`C:\mozilla-build\start-shell.bat`再在里面输命令。

## 使用预编译组件以加速编译

如果你不打算对 Firefox 的 C++或 Rust 部分进行开发，那么你可以采用如下步骤以大大缩短时间（前提是你有网络加速服务）：

1. 用顺手的编辑器在`mozilla-central`目录下新建`mozconfig`文件。
2. 输入如下内容

```makefile
# 自动下载编译好的C++组件:
ac_add_options --enable-artifact-builds

# 将组件放进一个文件夹:
mk_add_options MOZ_OBJDIR=./objdir-frontend
```

## 编译与运行

当你完成了上述步骤，用如下命令来检查依赖关系并开始编译。这将需要一段时间：从几分钟到几个小时不等，取决于你的配置和网速。

```bash
./mach build
```

这以后，用这个命令来运行你编译好的 Firefox：

```bash
./mach run
```

大功告成。

## 我的编译用时

先说说我的电脑配置：

```
ROG玩家国度 魔霸新锐
CPU：Intel i7-10875H
GPU：NVIDIA RTX2060
RAM：16GB
操作系统：Archlinux
桌面环境：KDE Plasma
测试时间：2021年1月2日
```

内存占用最高达 8G，全新编译用时 17 分 34 秒。
