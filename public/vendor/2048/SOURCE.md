# 考后奖励：2048 来源与改编

- 原项目：[gabrielecirulli/2048](https://github.com/gabrielecirulli/2048)，固定版本 `478b6ec346e3787f589e4af751378d06ded4cbbc`；2026-09-29 查询时为 13,415 个 GitHub 星标。
- 原作者：Gabriele Cirulli；许可：MIT。许可原文保存在同目录的 `LICENSE.txt`。
- 本地保留原版棋盘、移动、合并、得分的 JavaScript 规则和主要 CSS。`index.html` 改为中文课堂页面并加入可点击的方向按钮；`game_manager.js` 发送实际移动、合并次数与本次得分给本课流程图；`local_storage_manager.js` 按学生与学习轮次隔离本机续玩记录；`html_actuator.js` 将终局提示改为中文。移除原版的外站链接与额外字体资源，使用浏览器系统字体。
- 所有游戏脚本与样式均从教师电脑的本地课堂服务加载，无运行时外网依赖。游戏仅为考核后的选做体验，不改变主线积分和考核成绩。
