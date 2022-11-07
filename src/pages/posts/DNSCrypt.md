---
title: 在 Windows 上实现国内外 DNS 分流
date: 2022-02-22 22:57:00
tag: [教程]
---

众所周知，中国大陆存在 DNS 污染。而根据我自己的经验，一些运营商还在此之上加了一层。对抗 DNS 污染的方法有很多，用翻墙软件直接代理 DNS 请求是其中一种，但出于谨慎，我并不会让翻墙软件常开或与国产软件同时运行，切换起来相当麻烦。

于是我使用了 DoH（DNS Over HTTPS）等加密 DNS 技术，然而，DoH 对 CDN 的支持却不好，如果全局 DoH，访问国内网站的体验会严重下降。而且，我的学校有些网页依赖于学校路由器的 DNS 劫持而运作，如果全局 DoH，它们就没法运行。

为此，我需要 DNS 分流：对国内域名的 DNS 请求走普通 DNS，对国外域名的 DNS 请求走 DoH。

在 2019 年左右，我已经在 Linux 实现了 DNS 分流：使用 cloudflared 作为 DoH Proxy，把 DNS 请求转换为 DoH 请求，再使用 dnsmasq 进行分流，国内域名走普通 DNS，国外域名则向 cloudflared 请求。

然而 dnsmasq 并不支持 windows。即使支持，上述方案也未免臃肿。今天我在 cloudflare 官网上发现了[DNSCrypt-proxy](https://github.com/DNSCrypt/dnscrypt-proxy)，它完美解决了我的需求，除此以外，我之前使用的[dnsmasq-china-list](https://github.com/felixonmars/dnsmasq-china-list)也提供了将其内容转译为 DNSCrypt-proxy 的 makefile，事情就这么成了。

以下步骤的操作环境是纯 windows，没有使用 WSL。

首先，你需要安装[Git for Windows](https://gitforwindows.org/)，记得把 Git Bash 装上，后面会用到的。

然后把`dnsmasq-china-list`clone 到本地：

```bash
# 设定 depth 来避免 clone 下历史，缩短 clone 时间
git clone https://github.com/felixonmars/dnsmasq-china-list --depth=1
```

为了使用 make 转译 dnsmasq-china-list 的内容，你需要安装 make，这可以从 GnuWin32 获取，这之后记得把`C:\Program Files (x86)\GnuWin32\bin`加入`PATH`，然后重启电脑。

在 Git Bash 中打开刚刚 clone 下来的文件夹，在里面运行

```bash
make SERVER=$ADDRESS NEWLINE=DOS dnscrypt-proxy
```

其中，$ADDRESS 是你希望国内域名分流去的 DNS 服务器地址。这以后，打开这个文件夹下刚生成的`dnscrypt-proxy-forwarding-rules.txt`，如果每行末多了一个`n`，就把上面那条命令里的`NEWLINE=DOS`去掉，再运行一次。

在[这里](https://github.com/DNSCrypt/dnscrypt-proxy/releases/)下载 DNSCrypt-Proxy，解压，把上一步得到的`dnscrypt-proxy-forwarding-rules.txt`复制进去。

重命名`DNSCrypt-Proxy`目录下的`example-dnscrypt-proxy.toml`为`dnscrypt-proxy.toml`，用编辑器打开。在其中加入这么一行：`forwarding_rules = 'dnscrypt-proxy-forwarding-rules.txt'`。

这以后，`DNSCrypt-Proxy`目录里面应该是这样：

```plaintext
dnscrypt-proxy-forwarding-rules.txt
dnscrypt-proxy.exe
dnscrypt-proxy.toml
example-allowed-ips.txt
example-allowed-names.txt
example-blocked-ips.txt
example-blocked-names.txt
example-captive-portals.txt
example-cloaking-rules.txt
example-dnscrypt-proxy.toml
example-forwarding-rules.txt
LICENSE
localhost.pem
public-resolvers.md
public-resolvers.md.minisig
query.log
relays.md
relays.md.minisig
service-install.bat
service-restart.bat
service-uninstall.bat
```

如果你只想要 cloudflare 的 DoH，可以像我一样把`dnscrypt-proxy.toml`里`server_names`这个数组只留下一项`"cloudflare"`。

大功告成。运行`service-install.bat`，再将系统 DNS 修改为`127.0.0.1`即可（备用 DNS 一项可以留空）。如果必要，运行`ipconfig /flushdns`来清除系统内的 DNS 缓存。

想检验配置是否正确，可以使用`nslookup www.google.com`。如果被 DNS 污染，返回的结果应该只有一项，反之则有好几项，你还可以查询这些 ip 的归属地来确定得到了正确的 DNS 结果。

这样以后我能直连 GitHub，大多数工作已经没有阻碍了。
