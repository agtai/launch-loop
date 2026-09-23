# Text rules v1

版本 `text-v1.0.0`，核查日 2026-09-23。这里是独立编写的规则整合及确定性解析器，不是第三方完整 skill 的安装包。来源逐文件 commit、metadata version、SHA-256、许可及取舍见 [sources.json](sources.json) 和 [第一轮文本规则整理](../../../docs/第一轮文本规则整理.md)。原始参考未修改。

## 可用范围

通用文本、中英文表达、LinkedIn 普通 feed 动态为 `ready`，表示本轮规则可供执行器使用，已做一次中英文会话试稿。其余四个平台、LinkedIn Pulse 和串帖均 `pending`。ready 不代表工作台连接了 Agent、平台审核通过或已发布；同一配置中只要有未适配格式，该变体整体 pending，不能偷偷只生成其中一部分。

## 纯函数接口

从 `server/rule-resolver.mjs` 导入 `resolveTextRules(config)`，无网络、文件、时间或保存副作用。输入：

```js
{
  platforms: ['linkedin'], // linkedin / x / xiaohongshu / zhihu / bilibili
  languages: ['zh', 'en'],
  formats: ['short_post'], // short_post / long_article / thread
  authorIdentities: ['product_author'], // 可选；也可team、third_party，多选合并视角要求
  styles: ['professional', 'plain', 'concise'], // 可选
  depths: ['brief'], // 可选；brief / standard / detailed，多选合并
  project: 'system1-agents', // 可选，仅此项目已整理
  terminology: { required: [], forbidden: [] }, // 可选，同词冲突报错
  referenceMode: 'structure_and_voice', // 可选
  assetMode: 'generate' // 可选；uploaded / generate，未选素材时generate来自已确认需求
}
```

产品资料、写作目的、目标读者属于执行器的创作输入，解析器不接收正文或代替执行器校验它们。CTA尚未确定为表单项，接口不添加CTA字段，省略时不强制CTA句式；这不是选择了一个全局CTA默认。平台、语言、格式为空时没有擅自补值，返回 `needs_configuration`。未知或畸形配置返回 `invalid`；不能把这两种状态当成功生成零份。

返回结构：

```js
{
  status: 'ready', // ready / pending / needs_configuration / invalid
  ruleSetVersion: 'text-v1.0.0',
  issues: [{ code, field, message }],
  variants: [{
    id: 'linkedin:zh', platform: 'linkedin', language: 'zh',
    status: 'ready', // ready / pending
    documents: [{ format: 'short_post', kind: 'linkedin_post', status: 'ready' }],
    ruleMetadata: { ruleSetVersion, fragmentIds, hash },
    instructions, // 唯一完整规则文本；pending时null，禁止执行
    auditChecks: ['facts:...', '...'],
    terminology: { required: [], forbidden: [] }
  }]
}
```

仅平台×语言增加变体，输入选项按固定目录顺序去重，格式与其他选项合并。LinkedIn `short_post`映射`linkedin_post`，`long_article`映射`linkedin_article`，thread为`kind:null`且pending。非LinkedIn格式分别映射`post`、`article`、`thread`，均pending，不代表发布适配器已支持。

存储适配：`platforms/languages/formats`可使用同名已验证标识；`ruleMetadata`可直接关联各content item。存储brief的`authorIdentity/styleTerms/lengthDepth`保留原输入文字，**不是**解析器的`authorIdentities/styles/depths`选项ID；不能直接传入或猜测映射。下一轮执行器需明确的选项ID适配或返回待解析说明，自由文字与资料另作本次创作输入保留。

hash为SHA-256，覆盖规则版本、片段ID、平台语言、各文档格式/对象/状态、术语、完整拼装文本和审核检查项；相同语义多选顺序不会改变hash。pending的hash也记录被阻止执行的候选规则，返回文本仍为null。hash不覆盖资料正文或事实版本；下一轮执行器须另记录输入资料版本和哈希。每个variant可独立映射存储content item，各格式对应documents，不把全局pending当作静默跳过不支持稿件的许可。

## 执行要求与维护

初稿、一次审核记录、修订稿、未解决项及素材全部先tmp，等待用户确认。审核检查要针对实际正文给出依据，不能把规则列表本身当审核完成。没有工具调用时不能声称linted或已生成图片。修改片段必须提升规则版本；官方规格后续需重新核查，来源证据不等于端到端验证。

运行规则测试：`node --test tests/rules.test.mjs`。测试只验证映射、确定性、状态和术语约束，不验证生成、内容质量、外部服务或平台发布。
