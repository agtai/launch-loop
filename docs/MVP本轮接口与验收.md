# LinkedIn MVP 本轮整合

2026-09-24，基线 `5942773`，分支 `codex/mvp-integration`。本轮明确授权候选规则生产接入、后台图片、OAuth准备和有限真实生成。禁止自动commit、push、合并、正式用户稿确认、LinkedIn图片上传或实际发帖。

## 唯一文件负责人

- 主Agent：generation-service、content-store/validation、index及generation/content路由、src共享类型/API、ContentWorkspace、词典/CSS、依赖、公共文档、public/dist、最终验收。
- 文本Agent（Astra Xhigh）：新增 `server/text-pipeline.mjs`、`server/text-rules-v2.mjs`（必要辅助同前缀）、`rules/text/v2/`、对应独立测试。旧resolver/v1不覆盖。generation-runner必要变化先协调。
- 图片Agent（Astra High）：新增 `server/image-*.mjs`、对应独立测试。独立正式受控图片入口，不修改文本执行器权限。用户已批准复用Codex及官方缓存，按此做有限真实验证。
- LinkedIn Agent（Astra Xhigh）：linkedin-api、linkedin-service、linkedin-oauth、publishing-http/store、PublishingWorkspace与对应测试。词典新增项交主Agent；不改共享类型、content存储或公共文档。

## 模块接口约定

文本管线提供 `resolveIntegratedTextRules(config)` 和 `runTextPipeline({variants, context, call, checkpoint})`；精确字段在实现前由文本Agent回报主Agent。`call`由主Agent服务统一持有取消、预算、真实进程、输出暂存；管线只编排母稿→平台→本地化→冻结→每稿一次审核→集齐修订，`checkpoint`持久化阶段和已验证产物。所有来源、账本和正文只在dataDir/tmp。

图片适配提供能力探测与可取消、预算有限的生成/检查接口，返回实际文件、类型、尺寸、hash、正文hash和检查证据；由主Agent关联tmp revision并纳入同版素材。LinkedIn仍只读正式版本；素材过期或尚未完成不能伪装配图成功。图片失败保留文本。

修改提案默认精确选区，源revision冲突拒绝；接受派生tmp、拒绝保留源稿、撤回只反向派生仍匹配的选区，保留后续手改。跨语言只提示待核对；显式同步才生成独立提案。

## 验收清单与边界

1. 隔离目录执行npm ci/build/test和候选检查；外部平台仅明确替身。
2. 浏览器检查必填、资料、双语、实际进度、选区提案/接受/拒绝/撤回/冲突、tmp隔离、合成确认与历史、刷新重启、防重复、取消及失败、发布预览、页面与控制台。
3. 工作台有限真实调用：一组中英文新流程、一次局部改稿、真实后台图片及实际看图；真实稿始终tmp。
4. 分别记录内部回归、真实文本、真实图片、真实OAuth和真实发布状态。依赖缺失不标成功。
5. 未编写模块的Agent交叉复核关键变更，修复有效发现，再复测。

用户已选择复用已登录Codex并批准官方缓存例外，不使用新增付费API。用户尚未准备LinkedIn应用及HTTPS回调，要求先完成本地实现与最小配置步骤。配置仅检查必要字段存在性/有效性，不输出密钥，不开放整个工作台。实际结果和证据以[MVP验收报告](MVP验收报告.md)为准。
