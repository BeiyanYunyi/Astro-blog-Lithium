---
title: 2018荣耀magicbook锐龙版archlinux卡死解决方案
date: 2020-05-13 20:37:55
tag: [教程]
description: >
  我的2018款魔法书锐龙版对linux的兼容性极差。
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

　　经过多方查找如[bugzilla](https://bugzilla.redhat.com/show_bug.cgi?id=1562530#c66)、[manjaro forum](https://forum.manjaro.org/t/amd-ryzen-problems-and-fixes/55533)，我决定：

* 修改内核参数  

*/etc/default/grub*
```
……
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash ……"
改为“noacpi nosplash idle=nomwait irqpoll ……”
……
```
然后`sudo grub-mkconfig -o /boot/grub/grub.cfg`

* 禁用C6状态  

```bash
$ yay zenstates-git
# vim /etc/modules-load.d/modules.conf（可能是新文件）加入如下单词：“msr”。
# vim /etc/systemd/system/disable_c6.service （新文件）
```

内容如下：

```
[Unit]
Description=Ryzen Disable C6
DefaultDependencies=no
After=sysinit.target local-fs.target
Before=basic.target

[Service]
Type=oneshot
ExecStart=/usr/bin/zenstates --c6-disable

[Install]
WantedBy=basic.target

```

　　然后

```
# systemctl enable disable_c6.service
```

　　最后重启。  
　　这是我病急乱投医综合三四个回答的结果。修改后，目前暂时一切正常。  
> 修订于2020年5月16日

　　然而并没有。  
　　于是我把kde的混成器设置从OpenGL3.1改成了2.0，现在暂时没事了。  
　　然后还有吧友提供了[另一个方案](https://tieba.baidu.com/p/6686363600)  
　　（/etc/default/grub）：  

```  
acpi_osi=\"Windows 2015\" reboot=kbd ivrs_ioapic[32]=00:14.0 amd_iommu=on idle=nomwait amdgpu.vm_fragment_size=9 initrd=/boot/amd-ucode.img
```  

　　然后`sudo grub-mkconfig -o /boot/grub/grub.cfg` 

> 修订于2020年5月26日

　　然而还是有问题！！！！！！！

　　然后我又找到了一个内核参数，使用方法同上，加入 `/etc/default/grub`里然后 `grub-mkconfig -o /boot/grub/grub.cfg`吧：

`amdgpu.noretry=0`

> 修订于 2020 年 5 月 27 日  

　　目前问题再未复现。可认为已经得到彻底解决。加上笔记本即将卖出，本文宣布完结。    
　　几个关键点：  
1. 设置 idle=nomwait 或禁用 C6 。  
2. 将混成器由 OpenGL3.1 改为 2.0。  

> 修订于 2020 年 6 月 12 日