---
title: LUKS2 YubiKey 全盘加密手稿
date: 2024-02-10 06:37:55
tag:
  - 教程
description: 让我看看是谁除夕了还在重装系统：archlinux, LUKS2, Unified Kernel Image, Secure Boot (sbctl), YubiKey, btrfs (with subvolume), UEFI, Snapper, FIDO2
---

> 本文最近一次更新于 2024 年 8 月 6 日。

## 前言

自从[发现自己随时可能被中华*人民*共和国*人民*警察们搜查](/posts/CornerOfTheWorld)以来，我的加密偏执就复发了。我决定用 LUKS2 和 YubiKey 武装我的电脑。可能的话，我还要把这枚 YubiKey 改造得易于摧毁。

不过，配置环境起码要两天左右，我手头上的事太多了，[中间还有一个半月在医院度过](/posts/SurgeryNote)，因此迟迟没有动手。4 个月后，我终于有时间了。于是开干。

## 准备工作

我阅读了几篇文章：

- [archlinux Wiki CN: dm-crypt](https://wiki.archlinuxcn.org/wiki/Dm-crypt/%E5%8A%A0%E5%AF%86%E6%95%B4%E4%B8%AA%E7%B3%BB%E7%BB%9F#Btrfs%E5%AD%90%E5%8D%B7%EF%BC%8C%E5%B8%A6swap)
- [User:ZachHilman/Installation - Btrfs + LUKS2 + Secure Boot](https://wiki.archlinux.org/title/User:ZachHilman/Installation_-_Btrfs_%2B_LUKS2_%2B_Secure_Boot#Install_More_Packages)
- [Unlocking LUKS2 volumes with TPM2, FIDO2, PKCS#11 Security Hardware on systemd 248](https://0pointer.net/blog/unlocking-luks2-volumes-with-tpm2-fido2-pkcs11-security-hardware-on-systemd-248.html)

结合各方优劣，得出了自己的方案。事先在虚拟机里尝试了两遍，最终得到了比较满意的结果。

## 方案介绍

本方案会使用 LUKS2 加密 EFI 分区以外的整个硬盘，使用 Unified Kernel Image 引导。引导+系统启动只需要输入一次密码（使用 YubiKey 则可配置为不需要密码，也可配置为 2FA）。EFI 分区中会存在一个 `main.efi`，里面包含了 `initramfs`、`microcode` 和 `kernel`。会使用 `sbctl` 对它们进行签名，从而支持 `Secure Boot`，最后，配置 `YubiKey` 用于解密 `LUKS2`。

本方案会使用 `linux-zen` 而非 `linux` 内核。

本方案不会使用 `TPM`。`TPM` 配置不当可能导致你的加密功亏一篑。[^1]如确有需要，可参考“准备工作”一节中的第二篇文章。

尽管我会加入很多可能不必要的细节，<del>但这只是因为我的神经多样性，</del>本文的性质仍然是笔记 / 手稿，不是操作说明。本文中的命令仅作示意，实际操作过程中可能会有所不同。

本文作于 2024 年 2 月 10 日。你阅读这篇文章时，内容可能已经过时。我并不具备足够的安全知识，本文的操作无法确保安全。

## 安装系统

此时你的 Secure Boot 应该在关闭状态。我觉得不会有谁想在安装系统时开启 Secure Boot。

首先，遵循安装指南，至[安装指南#建立硬盘分区](https://wiki.archlinuxcn.org/wiki/%E5%AE%89%E8%A3%85%E6%8C%87%E5%8D%97#%E5%BB%BA%E7%AB%8B%E7%A1%AC%E7%9B%98%E5%88%86%E5%8C%BA)为止。

```bash
lsblk
cfdisk /dev/nvme0n1
```

第一个分区会作为 EFI 分区，分 1G 或者 0.5G 即可，后续 UKI 会占用 ~100MB。

剩下的空间全分给第二个分区，这将是你的加密分区。不再分一个 Swap 分区的原因是当前 btrfs 已经支持 swapfile，可在 btrfs 分卷时或完成安装后[自行配置](https://wiki.archlinux.org/title/Btrfs#Swap_file)，本文不再赘述。

```bash
mkfs.vfat -n EFI /dev/nvme0n1p1 # 假设这是第一个分区
```

创建、挂载、格式化 LUKS2 容器，默认设置已经基本满足需求：

```bash
cryptsetup luksFormat /dev/nvme0n1p2 # 假设这是第二个分区
cryptsetup open /dev/nvme0n1p2 system
mkfs.btrfs --label system /dev/mapper/system
```

`cryptsetup luksFormat /dev/nvme0n1p2` 时，会提示你输入密码。这时可以设置一个安装时临时使用的密码，配置完 YubiKey 后再改。

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
mount --mkdir -o noatime,subvol=@root /dev/mapper/system /mnt
mount --mkdir -o noatime,subvol=@home /dev/mapper/system /mnt/home
mount --mkdir -o noatime,subvol=@var /dev/mapper/system /mnt/var
mount --mkdir /dev/nvme0n1p1 /mnt/efi
```

设置镜像站，安装系统并 chroot：

```bash
vim /etc/pacman.d/mirrorlist
# 此处 -K 的含义是复制 keyring
pacstrap -K /mnt base linux-zen linux-firmware intel-ucode btrfs-progs
```

此后，遵循[安装指南#配置系统](https://wiki.archlinuxcn.org/wiki/%E5%AE%89%E8%A3%85%E6%8C%87%E5%8D%97#%E9%85%8D%E7%BD%AE%E7%B3%BB%E7%BB%9F)，对系统进行配置。配置好以后，别急着 `umount` 和重启。你需要配置引导。

```bash
# 如果遵循前述步骤，此时你应该在 arch-chroot 环境中
pacman -Syu networkmanager base-devel vim sbctl efibootmgr
vim /etc/mkinitcpio.conf
```

将它的 `HOOKS` 一栏配置为如下形式：

```systemd
HOOKS=(base systemd autodetect modconf kms keyboard sd-vconsole block sd-encrypt filesystems fsck)
```

先不加入 `plymouth`，等引导成功后再加入，便于观察输出。

```bash
vim /etc/mkinitcpio.d/linux-zen.preset
```

注释 `default_image`，并取消 `default_uki` 和 `default_options` 的注释。必要时更改 `default_image` 的路径。示例：

```ini
# mkinitcpio preset file for the 'linux-zen' package

#ALL_config="/etc/mkinitcpio.conf"
ALL_kver="/boot/vmlinuz-linux-zen"

PRESETS=('default' 'fallback')

#default_config="/etc/mkinitcpio.conf"
#default_image="/boot/initramfs-linux-zen.img"
default_uki="/efi/main.efi"
default_options="--splash /usr/share/systemd/bootctl/splash-arch.bmp"

#fallback_config="/etc/mkinitcpio.conf"
#fallback_image="/boot/initramfs-linux-zen-fallback.img"
fallback_uki="/efi/fallback.efi"
fallback_options="-S autodetect"
```

创建 `/etc/kernel/cmdline`，写入：

```plaintext
fbcon=nodefer rw rd.luks.allow-discards cryptdevice=/dev/nvme0n1p2:system bgrt_disable root=LABEL=system rootflags=subvol=@root,rw splash vt.global_cursor_default=0
```

这将是你的内核参数，以后需要配置内核参数的话就改这里。`mkinitcpio` 会自动配置好 `microcode`。安装 `intel-ucode` 或 `amd-ucode` 即可，无需额外在参数里加上。

创建 `/etc/crypttab.initramfs`，写入：

```plaintext
system /dev/nvme0n1p2 none timeout=180,fido2-device=auto
```

这一步是让 `initramfs` 启动时解密位于 `/dev/nvme0n1p2` 的 LUKS2 容器，并挂载到 `/dev/mapper/system`。

创建或编辑 `/etc/vconsole.conf`：

```plaintext
KEYMAP=us
FONT=lat2-16
```

这将能解决 `mkinitcpio` 时的警告。

创建密钥并生成 Unified Kernel Image，加入引导：

```bash
sbctl create-keys
mkinitcpio -P
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

## 配置 YubiKey

按照[建议阅读](https://wiki.archlinuxcn.org/wiki/%E5%BB%BA%E8%AE%AE%E9%98%85%E8%AF%BB)，配置好多用户与桌面。

使用如下命令确保你的 YubiKey 具备 FIDO2 功能：

```bash
sudo systemd-cryptenroll --fido2-device=list
```

你将能得到类似下面的输出：

```plaintext
PATH         MANUFACTURER PRODUCT
/dev/hidraw0 Yubico       YubiKey FIDO+CCID
```

使用如下命令将 YubiKey 添加到 LUKS2 容器的解密设备列表：

```bash
sudo systemd-cryptenroll /dev/nvme1n1p2 --fido2-device=auto --fido2-with-client-pin=no --fido2-credential-algorithm=eddsa
```

参数意义如下：

| 参数                           | 说明                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| `/dev/nvme1n1p2`               | 设备路径                                                                                     |
| `--fido2-device`               | 设备，可用 auto，或前面的 `/dev/hidraw0`                                                     |
| `--fido2-with-client-pin`      | 默认是 `yes`，此处置 `no`，从而开机时只需要触摸 YubiKey 而不需输入 PIN，可自行调整为需要 PIN |
| `--fido2-credential-algorithm` | 算法，此处选择 `eddsa`。我没有打错字，不是 `ecdsa`                                           |

可参考 [systemd-cryptenroll#FIDO2_tokens](https://wiki.archlinux.org/title/Systemd-cryptenroll#FIDO2_tokens)

`sudo mkinitcpio -P` 后重启系统，确认 YubiKey 配置成功。

确定 YubiKey 可以运行后，记得通过 `cryptsetup luksChangeKey /dev/nvme0n1p2` 来修改此前临时设置的密码。改个强一点、最好你自己也记不住的，然后写在纸上（最好用遇水能洇开的墨水），放在安全但又随手可及的地方。

可以用如下命令生成：

```bash
openssl rand -base64 16
```

## 配置 Plymouth

想看 Plymouth 的话，此时也可以配置好。我的 Plymouth 在启动时会出现方块，原因是 `initramfs` 里没有字体，解决方法为在 `mkinitcpio` 时加入。照着下面的例子编辑 `/etc/mkinitcpio.conf`：

```systemd
# 你可以改成别的字体
FILES=(/usr/share/fonts/noto/NotoSans-Regular.ttf)
```

## 配置 Snapper

Snapper 可以对你的 btrfs 进行定期快照与恢复。我使用图形化的 Btrfs Assistant 配置，因此这里没什么可以说的。

## 配置 Secure Boot

**此步操作不当可能导致你的数据丢失。**

把这放到最后一步是因为它最麻烦，并且开了 Secure Boot 以后，从系统维护盘启动进行修正会变得困难。

不使用 TPM 的前提下，配置 Secure Boot 的用处并不大，反而会带来很多麻烦。但如果使用了 TPM（把密钥写入了 TPM），那么不配置 Secure Boot 就会导致安全性下降。[^1]我也是因为 Windows 那边开了 Bitlocker（加密系统盘时，会把密钥写入 TPM）才想着配置 Secure Boot。

如果你的电脑有 Windows 系统，并且 Windows 系统盘开启了 Bitlocker，那么请备份并保管好恢复密钥，下次启动 Windows 时很可能会用到。

在 BIOS 界面，开启 Secure Boot，并重置为 Setup Mode。重启进入 Linux。使用如下命令将密钥安装进 Secure Boot：

```bash
sbctl enroll-keys -mcft
```

如果你的 Secure Boot 没被重置为 Setup Mode，那么这一步会报错。**请勿强行写入**。

各参数说明：

| 参数 | 说明                                              |
| ---- | ------------------------------------------------- |
| `-m` | Microsoft，添加微软密钥，从而使 Windows 能够启动  |
| `-c` | custom，添加自定义密钥，从而使你的 Linux 能够启动 |
| `-f` | firmware-builtin，添加固件内置密钥                |
| `-t` | tpm-eventlog，添加 TPM 事件日志                   |

`sbctl` 有一个 `Hook`，它会在每次 `mkinitcpio` 输出镜像时自动签名。因此，你不需要手动更新。你也可以参考 `sbctl` 的手册页来获得更多用法。例如，使用 `sbctl` 对 `refind` 或 `systemd-boot` 进行签名。

## 当那一天来临

如果需要紧急销毁密钥，正确的步骤是：

- 找到前述写有密码的纸条，将其销毁。
- 销毁 YubiKey，确保其芯片（内部的硅片）破碎。**如果你此前配置的是 `--fido2-with-client-pin=no`，那么这步应当先做。** YubiKey 比较坚固，你可能要用些工具，或在平时就将它改造得易于摧毁。

这以后，就可以微笑着迎接破门而入的军警宪特了。祝你不要有这一天。

---

[^1]: 可以参考[这篇文章](https://mp.weixin.qq.com/s/lLTR0XI6br46lEyaDCzfXA)（[备份链接](http://web.archive.org/web/20230713193954/https://mp.weixin.qq.com/s/lLTR0XI6br46lEyaDCzfXA)）和[这篇文章](https://blog.men.ci/luks-with-tpm2-secure-boot/#%E6%94%BB%E5%87%BB%E9%9D%A2)（[备份链接](https://archive.is/3qAJu#%E6%94%BB%E5%87%BB%E9%9D%A2)）。如果不想 TPM 变成突破口，就**不要**把密钥丢 TPM 里。
