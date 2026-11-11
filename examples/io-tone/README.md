# Test Tone · 声核 IO 最小样例

在 Windows x64 的 **x64 Native Tools Command Prompt** 中进入本目录并编译。

```bat
cl /nologo /O2 /LD tone.c /link /OUT:tone.in.audcore /EXPORT:audcore_io_entry
```

把 `tone.in.audcore` 和 `tone.io.json` 放进声核状态目录的 `extensions/io`。便携版状态目录为程序旁的 `Audcore-data`，安装版为 `%LOCALAPPDATA%\AudCore`。重新启动声核，在通道输入菜单选 **Test Tone**。开启音频后，通道应出现低电平的 440 Hz 单声道测试音。

在 **设置 → 输入输出 → 扩展输入输出** 可以卸载样例。

[IO 开发说明](https://audcore.utae.cn/io-dev/)
