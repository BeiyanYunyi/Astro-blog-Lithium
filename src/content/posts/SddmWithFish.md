---
title: 如何在使用 Fish 作为 Default Shell 的同时使用 SDDM
date: 2025-01-19 06:34:00
tag: [教程]
description: >
  不知为何，从几年前开始，我就无法正常使用 SDDM。每次输入密码尝试登录时，SDDM 会闪退，然后重新回到登录界面，又或者直接回到 TTY。后来我知道这个问题叫“Failed to start Session”。这个问题一直困扰着我，直到我找到了原因与解决方案。
---

不知为何，从几年前开始，我就无法正常使用 [SDDM](https://github.com/sddm/sddm)。每次输入密码尝试登录时，SDDM 会闪退，然后重新回到登录界面，又或者直接回到 TTY。后来我知道这个问题叫“Failed to start Session”。这个问题一直困扰着我，直到我找到了原因与解决方案。

最难的是定位问题。我一开始以为这是 NVIDIA 的兼容性造成的，但即使我禁用独显，问题也依然存在。直到后来我发现，这个问题只有在将 Fish 设置为默认 Shell 以后才会出现。所以很显然，这是 SDDM 对 Fish 的兼容性问题。

经过检索，我发现早在 2023 年，就已经有人对 SDDM 提出了这个 [Pull Request](https://github.com/sddm/sddm/pull/1779)，而直到 2025 年的今天，它也没有被合并。

接下来要做的就很简单了：直接从 Arch Linux 的 Repository 中拿下 PKGBUILD，修改之，加上来自上述 PR 的 Patch，重新编译安装即可。

详情请参照：<https://github.com/BeiyanYunyi/sddm-1779-PKGBUILD>
