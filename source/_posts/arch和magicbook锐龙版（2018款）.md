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
*/etc/mkinitcpio.conf*
```
……
MODULES=(amdgpu radeon)
……
```
据wiki说在modules里面**按顺序**填上amdgpu radeon即可解决。不过在此之前我按华为论坛上作者的办法（只填amdgpu）问题依旧。我如此修改以后问题出现的频率有所减少，但依旧存在。  
同时，通过经验我还发现，电脑卡死的现象与过热存在一定的相关性。因此，我安装了[tlp](https://wiki.archlinux.org/index.php/TLP_(%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87))和tlpui-git（为tlp开发的一个GUI），并将各项设置调为“优先节能（power）”，目前过热的现象大大减少，卡死的现象暂未出现。(在此以后卡死现象依旧存在——5.16修订)  
不过我觉得大概还是治标不治本。这篇文章会经常更新。  
> 修订于2020年5月15日  

经过多方查找如[bugzilla](https://bugzilla.redhat.com/show_bug.cgi?id=1562530#c66)、[manjaro forum](https://forum.manjaro.org/t/amd-ryzen-problems-and-fixes/55533)，禁止cpu进入C6状态似乎是一个办法。但需要配置zenstates之类太烦，因此我姑且加内核参数了事。  

*/etc/default/grub*
```
……
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash……"
将quiet splash改为"noapic noacpi nosplash irqroll idle=nomwait"
……
```
这是我病急乱投医综合两个回答的结果。修改后，目前暂时一切正常。  
> 修订于2020年5月16日