# X 配图：规则、共享接口与证据边界

更新日期：2026-09-26；X 基线 `5942773`。用户已批准复用正式登录 Codex 和官方图片缓存；本轮通过 `git show 1e7cc37:<path>` 复用已提交 MVP 的 `server/image-runner.mjs`、`server/image-app-server-worker.mjs`，没有复制另一工作区的未提交代码。共享执行器现已接入 X 的按对象后台图片任务。**本文件的自动测试不构成真实出图或 X 上传成功证据；真实结果以本轮验收记录为准。**

## 2026-09-26 后台图片任务

`server/x-image-service.mjs` 复用上述正式 app-server 执行器及现有 `runCodex` 图片输入视觉检查。执行器继承 Windows Job Object、工具隔离、当前完成事件和新官方缓存文件核对；不读取 token、不调用未公开模型端点、不放开文本执行器工具。只有进程显式配置 `LAUNCH_LOOP_IMAGE_PROVIDER=codex-cache` 才接受图片任务。启动不自动探测；能力 GET 只读，显式刷新才进行30秒入口探测，不启动图片生成。

普通帖单图和串帖首帖单图均只作用于指定 `documentId`。任务输入冻结 tmp revision、完整稿件 hash、当前对象有序正文/素材 hash 和语言。生成最多420秒、视觉检查最多180秒，共600秒；不自动重试。使用 X 独立构图提示，不沿用 LinkedIn 图改尺寸。生成首版无文字以便视觉理解；检查实际PNG/JPEG、手机可读性、第一帖与整串语境、事实暗示，并以当前语言的实际观察作为图片描述。

只有真实完成图片和视觉结果都匹配当前字节、正文 hash，且 `passed` 与空 findings 同时成立，才能在最终 revision 检查后附入当前 tmp。`image.visualVerification=passed`、`visualMethod=codex-image-input` 表示自动看图检查，`visualMethod=user` 是显式人工核对；都不代表保存或发布授权。未知结果、看图失败、取消、关闭、恢复导致 tmp 失效、任何正文/版本/素材变化均不附入迟到图片。失败的真实图片及检查只留执行 tmp，不用占位图替代。其他内容对象和明确无图选择不会被图片接口修改；首次文本生成后的默认图片调度仅在生成完成时触发，局部改稿不触发自动出图。

显式重试只继承相同 tmp、documentId、sourceRevision、documentHash 的最近真实视觉失败发现；中间一次网络失败不抹去发现，其他对象和旧版本不混用。重启将 queued/running 标 interrupted，不自动续跑。取消不删除既有图片或 tmp。

| HTTP | 契约 |
|---|---|
| `GET /api/x-images/capabilities` | `{capability:{available,checking,status,reason,canRefresh,provider}}`，只读 |
| `POST /api/x-images/capabilities/refresh`，`{}` | 202，显式探测；并发共用本次检查 |
| `POST /api/x-images/jobs` | `{requestId,tmpId,revision,documentId,mode?:'generate'|'check'}` → 202 `{job}`；同请求幂等，同tmp并行任务拒绝 |
| `GET /api/x-images/jobs?tmpId=...`／`GET /api/x-images/jobs/:id` | `{items}`／`{job}`；状态 queued/running/ready/failed/cancelled/interrupted，stage区分generating/checking |
| `POST /api/x-images/jobs/:id/cancel`，`{}` | 持久取消，迟到结果不附图 |
| 既有 `/tmp/:id/prepare`、`bind`、`verify` | 仍按当前document和revision作用；prepare仅更新brief，不触发真实出图，不把显式无图改为生成 |

服务内部 `createXImageService({content,dataDir,env,testOnlyGenerate?,testOnlyCheck?,testOnlyProbe?})`；`create`返回任务，`wait(id)`供首次生成串行调度，`refreshCapability()`和`waitCapability()`返回Promise；`interruptAll()`供恢复保护，`close()`中断任务和能力检查。持久执行目录为 `dataDir/tmp/x-images/<jobId>/`，不写正式数据库或备份；成功素材仍通过已有content upload/updateTmp接口进入同一tmp。测试入口必须显式注入替身，不能用能力探测成功宣称出图通过。

本轮自动验证：图片任务9项、既有绑定14项、HTTP兼容4项共27项通过；从明确提交复用的执行器/协议/Windows失败分类26项通过。共53项，包含取消、迟到、重启、格式字节、真实观察结果契约、作用域、能力探测去重及相同版本视觉发现继承。均为合成材料／明确执行替身，无本轮真实模型或X上传。

## 能力与风格

首版支持普通帖单图、串帖首帖单图。串帖其他条、多图、动画、视频均未启用。规则源为 [`rules/x-images/v1/catalog.mjs`](../../rules/x-images/v1/catalog.mjs)，固定版本 `x-images-v1.0.0`；并非将 LinkedIn 旧图改尺寸。

图像表达由当前首帖和全串语境决定：说明关系时用简明示意，表达概念时用可理解的主体，有真实产品素材时保留其实际内容。手机缩小后仍须看清一个重点。保留已有品牌颜色与标识，未知时不编造品牌或界面。默认少字或无字；确需文字时采用稿件语言。双语无文字图只有语义一致并分别检查关联后才能复用。正文未证实的数字、增长趋势、截图、客户及完成状态不能画成证据。

3:2／16:9、留足裁切余量是本项目设计偏好，不是平台强制尺寸或传播保证。图片规则不承诺曝光，不以算法猜测或固定营销形式衡量质量。原图来源和模型能力状态分别保留。

## 已实读来源与取舍

| 来源／版本 | 类型与许可边界 | 采用与舍弃 |
|---|---|---|
| [仓库 LinkedIn 候选 SKILL](../../skill-preparation/linkedin-text/SKILL.md)、[assets](../../skill-preparation/linkedin-text/rules/assets.md)、[contracts](../../skill-preparation/linkedin-text/contracts.md)、[integration](../../skill-preparation/linkedin-text/integration.md)、[editing protocol](../../skill-preparation/linkedin-text/editing-protocol.md)、[option mapping](../../skill-preparation/linkedin-text/option-mapping.md)、[quality target](../../skill-preparation/linkedin-text/quality-target.md)、[validation](../../skill-preparation/linkedin-text/validation.md)，candidate.0.2.1 | 已有用户项目候选；内部复用，不作为已安装第三方技能或新授权 | 采用保真、实际读图、语言／来源／hash追踪和状态隔离；不沿用 LinkedIn feed 的具体排版，不把候选视觉验证当真实出图 |
| [X 图片帮助](https://help.x.com/en/using-x/posting-gifs-and-pictures)，2026-09-24读取 | 官方平台说明；不复制其正文或图片资产，无第三方素材许可授予 | 官方说明照片上限5MB，接受PNG/JPEG/GIF；项目保留更严格4MiB存储上限，仅静态PNG/JPEG。该帮助不证明当前应用权限 |
| [X Upload media](https://docs.x.com/x-api/media/upload-media)，2026-09-24读取 | 官方 API 契约；仅链接和原创总结 | 上传使用tweet_image类别；实际响应的ID、处理状态及有效期由发布模块检查。文档示例不等于远程上传成功 |
| [X Create Media metadata](https://docs.x.com/x-api/media/create-media-metadata)与[Create Posts](https://docs.x.com/x-api/posts/create-post)，2026-09-24读取 | 官方 API 契约；不复制来源代码 | 保留altText与generated供发布模块提交描述与made_with_ai；该字段不能通过文件扩展名猜测，已知生成来源不得降级 |
| 当前用户X需求 | 产品范围及作者偏好 | 首帖单图、手机可读、逐帖关联、默认生成意图与依赖阻塞状态；没有新增外部社区模板、强制CTA、营销配色或算法经验 |

官方文档和用户规则是不同层级；字体、色彩和比例偏好明确属于本项目。没有安装陌生技能、运行上游脚本或获取第三方图像。接入真实后端时仍须保存实际素材来源与使用权信息；URL本身不证明许可。

## 数据与接口

[`server/x-images.mjs`](../../server/x-images.mjs) 不自行保存内容、上传平台或确认正式版本。`block.assetIds` 是发布选择，首版0或1；`block.image` 保存：

```text
ruleVersion, intent, status, language,
textHash, documentHash, brief, briefHash, sourceAssetIds,
assetId, assetHash, mimeType, width, height,
visualVerification, altText, generated, errorCode
```

`textHash` 对精确UTF-8正文取SHA-256；`documentHash` 对固定键序的document id/kind/title及有序blocks的id/text/assetIds取SHA-256，不含可变image对象。编号若存在已在实际text中；不做Unicode或空白归一化。`briefHash`和`assetHash`分别绑定实际brief及字节。正式版本保留这些关系；未确认brief含正文，必须随tmp存储，不能进入执行日志或公开规则。素材沿用ContentAsset的来源与SHA-256，不建立另一套素材表。用户声明上传图由AI生成时，素材保留可选madeWithAi=true，后续解绑、换稿或重绑不得降级；source.kind仍为upload，状态仍为uploaded，不把人工导入误称后台生成。

| 导出接口 | 行为 |
|---|---|
| `prepareXImages(documents,{language,assets,getAssetBytes,backend,persistGenerated,signal,generatedAssetHashes})` | 异步返回新documents；实际PNG/JPEG输入优先绑定；无后端则brief+dependency_blocked；已有关联只校验，不静默重新生成。用户明确更新brief时，接入层移除旧image后调用；原assetIds保留 |
| `bindXImage(document,{language,asset,bytes,altText,generated})` | 返回新document；普通/串帖首块关联选定真实字节，尺寸与hash核对；状态uploaded、visualVerification=not_run。即使source.kind=generated，手工导入仍是uploaded状态，generated来源为true |
| `reconcileXImages(document,language,assets)` | 非变异；任何精确正文、顺序、图片、语言关联变化都保守标needs_update并清除目检通过，保留旧hash/brief便于追踪，不谎称已判断语义等价 |
| `verifyXImage(document,{language,assets,getAssetBytes,assetHash,textHash,altText,generated})` | 在用户显式目检确认时调用；检查当前hash及实际字节，要求实际描述，已知AI来源不可降级。passed表示用户确认，不是后台自动视觉验收 |
| `assertXImagePublishable(document,assets)` | 只对实际所选图片检查；拒失联、过期、未目检、缺描述的图。纯文本选择不因后台图片缺失而被虚构成带图或被自动添加素材 |
| `inspectXImage(bytes,mime)` | 检查PNG/JPEG头、分段边界、尺寸、4MiB/4000万像素项目上限；拒明显截断和APNG。不代替完整解码和实际目视检查 |

共享backend契约为`generate({platform:'x',language,brief,briefHash,textHash,documentHash,sourceAssetIds,mimeTypes,signal}) -> {bytes,mimeType,altText}`。只有backend和`persistGenerated`同时存在才调用；持久化回调必须将字节写当前dataDir/tmp并返回真实ContentAsset，source.kind保留generated。没有临时持久化入口不得发起调用。取消后不持久化迟到返回；失败仅给受控状态，原始供应商错误不进入用户字段。该契约目前仅测试替身执行。

## 2026-09-24 历史检查与当时依赖

本次`node --test tests/x-images.test.mjs`：14项通过，包括真实合成PNG字节关联、尺寸/hash拒绝、改文/重排/换图/语言失效、只读语义、生成来源、后端缺失/失败/取消、人工AI来源在重绑/刷新brief后保留，以及共享后端契约。合成1像素PNG只用于字节通路，不是X素材，也不是目视通过证据。测试里的passed是明确用户确认替身。

当时共享后端阻塞真实出图：已提交基线没有后台入口，内置工具缓存例外尚未由用户选择。该历史限制现由上方2026-09-26明确授权与已提交依赖覆盖；真实图片质量仍须在本工作台生成、检查手机可读性并单独记录。OAuth、远程图片上传和线上显示由发布专项独立验收。
