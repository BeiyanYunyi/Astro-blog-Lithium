---
title: 如何在使用Fish作为Default Shell的同时使用SDDM
date: 2025-01-19 06:34:00
tag: [教程]
description: >
  不知为何，从几年前开始，我就无法正常使用SDDM。每次输入密码尝试登录时，SDDM会闪退，然后重新回到登录界面，又或者直接回到TTY。后来我知道这个问题叫“Failed to start Session”。这个问题一直困扰着我，直到我找到了原因与解决方案。
---

不知为何，从几年前开始，我就无法正常使用 [SDDM](https://github.com/sddm/sddm)。每次输入密码尝试登录时，SDDM会闪退，然后重新回到登录界面，又或者直接回到TTY。后来我知道这个问题叫“Failed to start Session”。这个问题一直困扰着我，直到我找到了原因与解决方案。

最难的是定位问题。我一开始以为这是NVIDIA的兼容性造成的，但即使我禁用独显，问题也依然存在。直到后来我发现，这个问题只有在将Fish设置为默认Shell以后才会出现。所以很显然，这是SDDM对Fish的兼容性问题。

经过检索，我发现早在2023年，就已经有人对SDDM提出了这个 [Pull Request](https://github.com/sddm/sddm/pull/1779)，而直到2025年的今天，它也没有被合并。

接下来要做的就很简单了：直接从Arch Linux的Repository中拿下PKGBUILD，修改之，加上来自上述PR的Patch，重新编译安装即可。

详情请参照：<https://github.com/BeiyanYunyi/sddm-1779-PKGBUILD>
