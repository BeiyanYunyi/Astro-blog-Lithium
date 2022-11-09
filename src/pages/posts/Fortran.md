---
title: 用 VS Code + MSYS 搞定 Windows 上的 Fortran 开发
date: 2022-03-02 20:07:00
tag: [教程]
---

我是真不知道为什么现在还有人要用 Fortran，当听说要学 Fortran 时我也是震惊的。作为世界上第一门高级语言，我本以为它只能作为历史被我所知，即使是在科学计算领域。因为在《数字文明：物理学和计算机》中，郝柏林院士已经明确地说：

> 不推荐使用 Fortran。笔者是国内第一本 Fortran 中文教程的作者，近年亦开始转向 C。

但是既然学校要用，既然我所处的这个领域还有大量的 Fortran 残余，我也没办法，只能学一学了。然后就是典中典环节：学校推荐使用的 IDE 是 2003 款 Visual Fortran，它在很多同学的电脑上根本就无法安装。我连试都没试，因为我不允许这么古老的软件被塞到我电脑里。（顺带一提，学 C 的时候用的 IDE 也极其古老，我因此用了一条类似的工具链）

## Visual Studio？

看了一下，最新的支持 Fortran 的 Visual Studio 版本应该是 2016。但 VS 太大了，我用不起，告辞。

## MSYS

### MSYS 安装与配置

首先，你需要在[这里](https://www.msys2.org/)安装 msys。时刻谨记你是一个中国人，[国内镜像源](https://mirrors.ustc.edu.cn/help/msys2.html)之类的东西一定记得自己配置好。

### 安装 gfortran

安装好 msys 并配置好镜像源后，你需要打开安装目录下的`mingw64.exe`，它在安装时会被放到开始菜单（名称应该是`MSYS2 MinGW 64`），你也可以在开始菜单打开它。

打开的应该是一个命令行窗口。在 Linux 上和命令行打交道多年的我是不怎么慌的，如果没接触过命令行也不必担心，这个教程不需要你输入太多的命令。无论如何，请在这个命令行里输入这些命令，以安装 gfortran：

```bash
pacman -S mingw-w64-x86_64-gcc-fortran
```

安装好以后，你应该把 bin 加入 path 里。在我的 Windows 11 系统上，这个操作是这样进行的：

1. 右键“此电脑”（如果桌面里没有，就随便打开一个文件夹在左侧列表里找）
2. 打开“属性”
3. 在右侧，找到“高级系统设置”并左键单击
4. 点击“环境变量”
5. 在“系统变量”中，找到一个变量名为“Path”的行，左键单击选中，点击“编辑”
6. 点击“新建”并输入安装目录下的`mingw64/bin`文件夹的绝对路径，例如我是`F:\msys64\mingw64\bin`，其中`F:\msys64`是安装目录。
7. 确定-确定-确定-关闭“设置”

至此配置完成。

## Python

是的你没听错，虽然我们在学 Fortran，但为了良好的开发体验，你需要安装 Python。

### Python 安装与配置

请在[Python 官网](https://www.python.org/)下载它的最新版本。安装时，记得让它把自己加入 PATH 里。

### 安装 fortls 和 fprettify

右键单击左下角的 Windows 按钮，选择 `Windows PowerShell（管理员）` 或 `Windows 终端（管理员）` ，在里面输入：

```bash
pip install fortls fprettify
```

并回车执行。它应该会很快为你安装好这两个东西。

完成这些操作后，你需要重启电脑让前面的 path 设置生效。

## Visual Studio Code

### 安装

在[VS Code 官网](https://code.visualstudio.com/)下载并安装好 VS Code。现在的 VS Code 应该会提示你安装中文语言包，如果没有，你可以在左侧按钮点开扩展，在其中搜索 Chinese 并安装。

### 扩展及设置

同样在这个扩展页面，你需要搜索并安装`Modern Fortran`这个扩展，之后你需要打开这个扩展的设置（安装好后点击这个扩展那里的齿轮-扩展设置），在弹出的列表中找到`Fortran > Formatting: Formatter`，将默认的 findent 改成 fprettify。

需要注意的是，无论是 fprettify 还是 findent，默认缩进都是 3 格，如果和我一样嫌这个太异端了，可以在下面的`Fprettify Args`里（打开 json 编辑）像这样设置：`"fortran.formatting.fprettifyArgs": ["--indent=2"],` 如果这是最后一行，记得把最后的逗号去掉。不过我觉得有这个强迫症的人也知道怎么编辑 JSON 了。这个设置是把缩进配置为 2 格，如果想 4 格就把 2 改成 4，想用 Tab 缩进的话可以自己去 fprettify 的文档里找一下。

### 工作区配置

你需要新建一个文件夹，路径中最好不要包含中文，当然我没试过。

在 VS Code 里，用`文件-打开文件夹`的方式打开你刚刚新建的文件夹，并在其中新建一个名为`.vscode`的文件夹，然后在其中新建并编辑如下的两个文件：

#### launch.json

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "(gdb) Fortran",
      "type": "cppdbg",
      "request": "launch",
      "program": "${workspaceFolder}\\${fileBasenameNoExtension}.exe",
      "args": [],
      "stopAtEntry": false,
      "cwd": "${workspaceFolder}",
      "environment": [],
      "externalConsole": false,
      "MIMode": "gdb",
      "setupCommands": [
        {
          "description": "Enable pretty-printing for gdb",
          "text": "-enable-pretty-printing",
          "ignoreFailures": true
        }
      ],
      "preLaunchTask": "compile"
    }
  ]
}
```

#### tasks.json

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "compile",
      "type": "shell",
      "command": "gfortran",
      "args": ["-g", "${file}", "-o", "${workspaceRoot}\\${fileBasenameNoExtension}.exe"],
      "problemMatcher": [],
      "group": {
        "kind": "build",
        "isDefault": true
      }
    }
  ]
}
```

保存即可。

顺带一提，如果你是 Linux/Mac 用户，上面两个文件中的`\\`需要换成`/`。不过这两个系统的用户会需要看这篇文章吗？我不是很清楚。

## 开始编程

这以后，每当需要编程时，用 VS Code 打开这个文件夹，在里面新建`*.f90`，编完后在 VS Code 顶栏点击`运行-启动调试`，不出意外应该可以运行。

当觉得自己的代码太乱了的时候，你可以右键-格式化文档来将你的代码格式化。这就是我推荐使用`fprettify`而不是`findent`的理由，后者只管缩进，前者还会在一些地方添加空格以增加可读性。

## 总结

都配置好了我觉得也没啥人会接着看下去了，但我还是得把话撂这里：

> 2202 年还在用 Fortran 的臭老保必须死。
