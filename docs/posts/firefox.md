---
title: 如何编译Mozilla Firefox
date: 2021-01-02 17:25:20
tag: [教程]
---

如何编译Mozilla Firefox

<!--more-->

文章大部翻译改编自：

[https://firefox-source-docs.mozilla.org/contributing/contribution_quickref.html](https://firefox-source-docs.mozilla.org/contributing/contribution_quickref.html)

[https://davidwalsh.name/how-to-build-firefox](https://davidwalsh.name/how-to-build-firefox)

这个过程中的某些部分，包括clone和编译，即使在现代硬件上也会花费很长的时间。如果遇到困难，任何时候都不要犹豫，去[https://chat.mozilla.org](https://chat.mozilla.org)的#introduction 频道问出来。当然，你得**懂英文**。

使用的大部分软件仓库都由Mozilla管理（并且没有镜像源），尽管并非完全无法访问，中国大陆用户依旧可能需要一定的网络加速服务及镜像源，在此简单介绍一下。

### Linux用户

代理软件：cgproxy+任何socks5/http代理均可。cgproxy使用方法请自行查找GitHub同名项目，当然，得**懂英文**。

镜像源：除了Linux发行版软件源以外，编译过程中还会用到pip的软件源，因此请逐一设置好镜像源。镜像源的作用是加速安装编译依赖的过程，而并不能对其余大多数过程起加速作用。

除了Debian系和RedHat系以外的发行版应该也能进行编译，比如我的Archlinux就成功搞定了全过程。尽管如此，我推荐新人使用Ubuntu或其衍生版（kubuntu等）

## clone源码

首先你需要安装Mercurial，canonical编写的版本管理系统。安装方式视你的发行版而定，对archlinux用户而言应该是这样：

```bash
sudo pacman -S mercurial
```

其实用Git也可以，但我懒得写了。人家这么推荐就这么用吧。

然后

```bash
hg clone https://hg.mozilla.org/mozilla-central/
```

克隆可能需要10分钟到几个小时（取决于你的连接速度），clone下来的仓库应该小于5GB，但构建后可能会占用约20GB的空间，请先确保你有这个空间。我在2021年1月2日编译后占用的大小是20.4GB。除此以外，编译器等编译依赖也需要一定的空间，因此30GB的剩余空间会是一个比较保险的条件。

## 安装依赖（Linux/Mac）

```bash
cd mozilla-central
./mash bootstrap
```

推荐使用默认选项（也就是一路回车）。

## 安装依赖（Windows）

1. 你需要64位的Windows7或更新的系统。
2. 下载并安装[Visual Studio Community Edition](https://visualstudio.microsoft.com/downloads/)。
3. 下载[MozillaBuild](https://ftp.mozilla.org/pub/mozilla.org/mozilla/libraries/win32/MozillaBuildSetup-Latest.exe)。默认安装目录是`C:\mozilla-build`
4. 进行下一步操作前，请确保你完成了[这些要求](https://firefox-source-docs.mozilla.org/setup/windows_build.html#building-firefox-on-windows)（比这篇教程还长了，不翻译）。

此后的命令你需要在mozilla-build环境里执行，也就是打开`C:\mozilla-build\start-shell.bat`再在里面输命令。

## 使用预编译组件以加速编译

如果你不打算对Firefox的C++或Rust部分进行开发，那么你可以采用如下步骤以大大缩短时间（前提是你有网络加速服务）：

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

这以后，用这个命令来运行你编译好的Firefox：

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

内存占用最高达8G，全新编译用时17分34秒。