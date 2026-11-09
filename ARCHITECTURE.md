# 项目架构

项目使用 Cocos Creator 3.8.8 和 TypeScript，战斗原型入口为 `assets/Battle.scene`。

- `assets/BattleController.ts` 挂载在 Canvas 上，创建战斗界面、处理回合行动并刷新日志。
- `assets/BattleConfig.ts` 集中配置生命值、伤害、防御、怒气和重击频率。
- 玩家行动后，存活的史莱姆反击。重击前一回合预告，史莱姆名称变红。满怒时可释放蓄力攻击，命中蓄力中的史莱姆可打断重击。
- `settings/v2/packages/` 保存项目配置。构建产物输出到本地 `build/`，由 Git 忽略。
