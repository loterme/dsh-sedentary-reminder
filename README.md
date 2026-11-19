# 久坐提醒 · dsh-sedentary-reminder

一个安静的久坐计时器：输入框下方一枚小胶囊记着坐了多久，到点从**页面底部滑出一张卡片**，请你去走走。没有声音，不发系统通知，也不联网。

A quiet sitting timer for DeepSeek Harness: a slim pill under the composer keeps the time, and every 30–90 minutes a card slides up from the bottom and invites you to stand up and move. No sound, no system notifications, no network.

![提醒卡片停在输入框上方，三个选择：去走走、再坐 10 分钟、暂停 1 小时](assets/reminder-card.png)

## 安装 / Install

```sh
dsh plugin add github:loterme/dsh-sedentary-reminder
```

或者在本机的**插件 → 插件市场**里搜「久坐提醒」安装（收录后）。

## 怎么用 / How it works

- 输入框下方的小胶囊显示当前的久坐时长，点它就能打开设置。/ The pill under the composer shows the sitting time; click it to open settings.
- 连续坐满 45 分钟（可选 30 / 45 / 60 / 90），底部滑出一张卡片，给你三个选择：**去走走 · 5 分钟**、**再坐 10 分钟**、**暂停 1 小时**。按 `Esc` 收起卡片等于「再坐 10 分钟」。
- **休息倒计时按真实时间走**：切到别的应用、甚至刷新页面，它都接着走，回来刚好结束。
- **只在真的有人时计时**：页面不可见、或者连续 5 分钟没有任何输入，计时会自动清零——空着的桌子不会被提醒打扰。
- 设置保存在本地（`localStorage`），没有声音、不发系统通知、不联网。

## 设置项 / Settings

| 选项 | 可选值 |
| --- | --- |
| 提醒间隔 | 30 / 45 / 60 / 90 分钟（默认 45） |
| 休息时长 | 3 / 5 / 10 分钟（默认 5） |
| 提醒开关 | 开 / 关 |

关掉开关后胶囊显示「提醒已关」，设置卡里只剩一个恢复按钮，其他一概不动。

## 界面状态 / States

| 状态 | 胶囊 | 卡片 |
| --- | --- | --- |
| 计时中 | `久坐 12:34` | — |
| 到点 | `该起来啦` | 提示起身，三个选择 |
| 休息中 | `休息 04:51`（绿环） | 大字倒计时 + 进度条 + 「结束休息」 |
| 暂停中 | `暂停中 · 55 分` | — |
| 已关闭 | `提醒已关` | — |

## 结构 / Layout

- 常驻入口挂在 `conversation.composer.dock`，底部卡片挂在 `shell.overlay`（可点击穿透的全帧浮层），卡片位置会实测输入框盒子后紧跟其上方，不压输入框。
- 样式只用 `--dsw-alias-*` 主题 token，跟随明暗主题；文案中英双语，走 `ctx.locale`。
- 没有构建步骤：`client.js` 是纯 ESM 动态模块，改完由 DSH 的 HMR 直接热加载。

## 开发 / Development

把仓库目录装进 profile 之后，改 `client.js` 保存即生效，不需要重启：

```sh
dsh plugin add <path-to-this-repo>
```

## License

MIT
