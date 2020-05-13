---
title: 荣耀magicbook锐龙版（2018款）archlinux卡死解决方案
date: 2020-05-13 20:37:55
tags: [教程]
---
我的2018款魔法书锐龙版对linux的兼容性极差。  
<!--more-->
1. deepin v15（注：2018款魔法书均预装windows，2019才有deepin pro）直接调不了背光。
2. opensuse tumbleweed运行中卡死，只能强制重启。
3. ubuntu同上。
4. kde neon、kubuntu、manjaro、archlinux同上。

最近才在华为论坛上找到办法，作者则是在[archwiki](https://wiki.archlinux.org/index.php/AMDGPU#Enable_Southern_Islands_(SI)_and_Sea_Islands_(CIK)_support)上看到的。不过作者打字水平不太好，文内有多处错误，我搞了之后大致如下：
```
/etc/mkinitcpio.conf
……
MODULES=(amdgpu radeon)
……
```
据wiki说在modules里面**按顺序**填上amdgpu radeon即可解决。不过在此之前我按华为论坛上作者的办法（只填amdgpu）问题依旧。我如此修改以后暂时没有出问题了。如果有问题我会删了这篇文章（