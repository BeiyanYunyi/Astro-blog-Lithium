---
title: LUKS2 YubiKey 手稿
date: 2024-02-10 06:37:55
tag:
  - 教程
description: 让我看看是谁除夕了还在重装系统：archlinux, LUKS2, Unified Kernel Image, Secure Boot (sbctl), YubiKey, btrfs (with subvolume), UEFI, Snapper
---

## 前言

自从[发现自己随时可能被中华*人民*共和国*人民*警察们搜查](/posts/CornerOfTheWorld)以来，我的安全偏执就复发了。我决定用 LUKS2 和 YubiKey 武装我的电脑。可能的话，我还要把这枚 YubiKey 改造得易于摧毁。

不过，配置环境起码要两天左右，我手头上的事太多了，[中间还有一个半月在医院度过](/posts/SurgeryNote)，因此迟迟没有动手。4 个月后，我终于有时间了。于是开干。

## 准备工作

我阅读了几篇文章：

- [archlinux Wiki CN: dm-crypt](https://wiki.archlinuxcn.org/wiki/Dm-crypt/%E5%8A%A0%E5%AF%86%E6%95%B4%E4%B8%AA%E7%B3%BB%E7%BB%9F#Btrfs%E5%AD%90%E5%8D%B7%EF%BC%8C%E5%B8%A6swap)
- [User:ZachHilman/Installation - Btrfs + LUKS2 + Secure Boot](https://wiki.archlinux.org/title/User:ZachHilman/Installation_-_Btrfs_%2B_LUKS2_%2B_Secure_Boot#Install_More_Packages)

结合两者优劣，得出了自己的方案。事先在虚拟机里尝试了两遍，最终得到了比较满意的结果。

## 方案介绍

本方案会使用 LUKS2 加密 EFI 分区以外的整个硬盘，使用 Unified Kernel Image 引导。引导+系统启动只需要输入一次密码（使用 YubiKey 则可配置为不需要密码，也可配置为 2FA）。EFI 分区中会存在一个 `main.efi`，里面包含了 `initramfs`、`microcode` 和 `kernel`。会使用 `sbctl` 对它们进行签名，从而支持 `Secure Boot`，最后，配置 `YubiKey` 用于解密 `LUKS2`。

本方案会使用 `linux-zen` 而非 `linux` 内核。

本方案不会使用 `TPM`。

本文是手稿，不是操作说明。本文中的命令仅作示意，实际操作过程中可能会有所不同。

本文作于 2024 年 2 月 10 日。你阅读这篇文章时，内容可能已经过时。

## 安装系统

首先，遵循安装指南，至[安装指南#建立硬盘分区](https://wiki.archlinuxcn.org/wiki/%E5%AE%89%E8%A3%85%E6%8C%87%E5%8D%97#%E5%BB%BA%E7%AB%8B%E7%A1%AC%E7%9B%98%E5%88%86%E5%8C%BA)为止。

```bash
lsblk
cfdisk /dev/nvme0n1
```

第一个分区分 1G 或者 0.5G，剩下的全分给第二个。不再分一个 Swap 分区的原因是当前 btrfs 已经支持 swapfile，并且我 RAM 充足。

```bash
mkfs.vfat -n EFI /dev/nvme0n1p1 # 假设这是第一个分区
```

创建、挂载、格式化 LUKS2 容器，默认设置已经基本满足需求：

```bash
cryptsetup luksFormat /dev/nvme0n1p2 # 假设这是第二个分区
cryptsetup open /dev/nvme0n1p2 system
mkfs.btrfs --label system /dev/mapper/system
```

**临时**挂载 btrfs 根，创建 subvolume（子卷）：

```bash
mount /dev/mapper/system /mnt
btrfs subvolume create /mnt/@root
btrfs subvolume create /mnt/@home
btrfs subvolume create /mnt/@var
```

具体建多少子卷，建哪些，见仁见智。

然后，卸载根、挂载子卷和 ESP 分区：

```bash
umount -R /mnt
mount --mkdir -o defaults,compress=zstd,ssd,noatime,subvol=@root /dev/mapper/system /mnt
mount --mkdir -o defaults,compress=zstd,ssd,noatime,subvol=@home /dev/mapper/system /mnt/home
mount --mkdir -o defaults,compress=zstd,ssd,noatime,subvol=@var /dev/mapper/system /mnt/var
mount --mkdir /dev/nvme0n1p1 /mnt/efi
```

设置镜像站，安装系统并 chroot：

```bash
vim /etc/pacman.d/mirrorlist
pacstrap -K /mnt base linux-zen linux-firmware intel-ucode btrfs-progs
```

此后，遵循[安装指南#配置系统](https://wiki.archlinuxcn.org/wiki/%E5%AE%89%E8%A3%85%E6%8C%87%E5%8D%97#%E9%85%8D%E7%BD%AE%E7%B3%BB%E7%BB%9F)，对系统进行配置。配置好以后，别急着 `umount` 和重启。你需要配置引导。

```bash
pacman -Syu networkmanager base-devel vim sbctl efibootmgr
systemctl enable NetworkManager
vim /etc/mkinitcpio.conf
```

将它的 `HOOKS` 一栏配置为如下形式：

```systemd
HOOKS=(base udev autodetect modconf kms keyboard keymap consolefont block encrypt filesystems fsck)
```

先不加入 `plymouth` 和 配置 `ykfde`（YubiKey），等引导成功后再加入。创建 `/etc/kernel/cmdline`，写入：

```plaintext
fbcon=nodefer rw rd.luks.allow-discards cryptdevice=/dev/nvme0n1p2:system bgrt_disable root=LABEL=system rootflags=subvol=@root,rw splash vt.global_cursor_default=0
```

创建 `/etc/crypttab.initramfs`，写入：

```plaintext
system /dev/nvme0n1p2 none timeout=180
```

创建密钥并生成 Unified Kernel Image，加入引导：

```bash
sbctl create-keys
# 因为用的是 linux-zen 而非 linux，所以需要指定内核和 initramfs 文件名
sbctl bundle -k /boot/vmlinuz-linux-zen -i /boot/intel-ucode.img -f /boot/initramfs-linux-zen.img -s /efi/main.efi
sbctl sign-all -g
efibootmgr --disk /dev/nvme0n1 --part 1 --create --label "Arch Linux" --loader /efi/main.efi
exit # 退出 chroot
umount -R /mnt
reboot
```

这次应该能启动进入系统。启动过程中会要求你输入此前 `cryptsetup luksFormat` 时设置的密码。

进入系统后，可以遵循如下步骤连接到无线网络：

```bash
systemctl enable --now NetworkManager
nmtui
```

设置 NTP：

```bash
timedatectl set-ntp true
```

遵循 [Yubikey#Challenge-response_2](https://wiki.archlinux.org/title/YubiKey#Challenge-response_2) 配置 YubiKey（ykfde），可以配置为 1FA 或 2FA。过程中可以加入 Plymouth。

可以通过 `cryptsetup luksChangeKey /dev/nvme0n1p2` 来修改密码，改个强一点的，最好你自己也记不住的，然后写在纸上（最好用遇水能洇开的墨水），放在安全但又随手可及的地方。

可以用如下命令生成：

```bash
openssl rand -base64 16
```

## 当那一天来临

如果需要紧急销毁密钥，正确的步骤是：

1. 找到前述写有密码的纸条，将其销毁。
2. 掰断的 YubiKey，确保其芯片（内部的硅片）破碎。如果你此前配置的是 1FA，那么这步应当先做。
