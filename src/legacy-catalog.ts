import type {ModuleId} from './workflow';
export type Resource={id:string;name:string;kind:'Skill'|'产品'|'现有能力';stages:ModuleId[];summary:string;reuse:string;limit:string;effort:string;availability:string;url:string;license?:string;pricing?:string;workflow?:string;integration?:string;approval?:string;coverage?:Record<string,string>;sources?:{label:string;url:string}[]};
export const resources:Resource[]=[
  {
    "id": "product-marketing",
    "name": "product-marketing",
    "kind": "Skill",
    "stages": [
      "research"
    ],
    "summary": "从仓库或现有材料形成产品、受众、定位、品牌语言和证据背景文件，供其他营销技能复用。",
    "reuse": "首选；只作为五阶段共享背景，不另建第六个模块。",
    "limit": "不是独立市场调查；自动草稿中的受众和定位仍需材料或本人确认。",
    "effort": "低：Agent读取文件；需要产品材料，无必需付费API。",
    "availability": "未安装候选",
    "url": "https://github.com/coreyhaines31/marketingskills/blob/main/skills/product-marketing/SKILL.md",
    "license": "MIT，已核查仓库LICENSE",
    "sources": [
      {
        "label": "许可说明",
        "url": "https://github.com/coreyhaines31/marketingskills/blob/main/LICENSE"
      }
    ]
  },
  {
    "id": "content-strategy",
    "name": "content-strategy",
    "kind": "Skill",
    "stages": [
      "research"
    ],
    "summary": "把关键词、访谈、论坛和竞品材料整理成主题、优先选题和受众阶段，并记录选题理由。",
    "reuse": "首选；首版只产出本周3至5个候选，不照搬庞大内容战略。",
    "limit": "不等于已经获得关键词数据库或平台热度数据；不是文章生成器。",
    "effort": "低至中：可从用户材料开始；网上研究需要搜索能力；关键词量化可另导入数据。",
    "availability": "未安装候选",
    "url": "https://github.com/coreyhaines31/marketingskills/blob/main/skills/content-strategy/SKILL.md",
    "license": "MIT，已核查仓库LICENSE",
    "sources": [
      {
        "label": "许可说明",
        "url": "https://github.com/coreyhaines31/marketingskills/blob/main/LICENSE"
      }
    ]
  },
  {
    "id": "customer-research",
    "name": "customer-research",
    "kind": "Skill",
    "stages": [
      "research",
      "feedback"
    ],
    "summary": "分析已有访谈、评论、问卷和工单；提取原话、痛点、主题、矛盾和研究缺口，标记置信度与样本局限。",
    "reuse": "按需启用；适合让真实评论回流选题，避免虚构用户画像。",
    "limit": "不自带访问私有社群、CRM或评论平台的权限；不会自动招募访谈对象。",
    "effort": "低至中：已有文本即可分析；线上采集需搜索或相应连接器。",
    "availability": "未安装候选",
    "url": "https://github.com/coreyhaines31/marketingskills/blob/main/skills/customer-research/SKILL.md",
    "license": "MIT，已核查仓库LICENSE",
    "sources": [
      {
        "label": "许可说明",
        "url": "https://github.com/coreyhaines31/marketingskills/blob/main/LICENSE"
      }
    ]
  },
  {
    "id": "competitor-profiling",
    "name": "competitor-profiling",
    "kind": "Skill",
    "stages": [
      "research"
    ],
    "summary": "按竞品URL采集官网、定价和评论，结合SEO数据生成逐个竞品档案，保存带日期的原始资料。",
    "reuse": "后置；第一版人工提供2至3个竞品页面即可，暂不复制完整采集链。",
    "limit": "技能不附带采集和SEO账号；流量、外链等估值不能当成竞品经营事实。",
    "effort": "高：原工作流明显依赖Firecrawl及DataForSEO MCP、密钥和可能的服务费用。",
    "availability": "未安装候选",
    "url": "https://github.com/coreyhaines31/marketingskills/blob/main/skills/competitor-profiling/SKILL.md",
    "license": "MIT，已核查仓库LICENSE",
    "sources": [
      {
        "label": "许可说明",
        "url": "https://github.com/coreyhaines31/marketingskills/blob/main/LICENSE"
      }
    ]
  },
  {
    "id": "copywriting",
    "name": "copywriting",
    "kind": "Skill",
    "stages": [
      "creation"
    ],
    "summary": "为营销页面组织标题、正文、行动号召与备选版本，说明主要文案选择。",
    "reuse": "按需用于落地页/产品介绍；不必成为每条内容的必经步骤。",
    "limit": "主要针对营销页面；不能代替原创采访、技术验证或普通长文写作的证据。",
    "effort": "低：产品背景、目标受众、已有证据；无需必需API。",
    "availability": "未安装候选",
    "url": "https://github.com/coreyhaines31/marketingskills/blob/main/skills/copywriting/SKILL.md",
    "license": "MIT，已核查仓库LICENSE",
    "sources": [
      {
        "label": "许可说明",
        "url": "https://github.com/coreyhaines31/marketingskills/blob/main/LICENSE"
      }
    ]
  },
  {
    "id": "social",
    "name": "social",
    "kind": "Skill",
    "stages": [
      "creation",
      "publishing",
      "feedback"
    ],
    "summary": "从长材料拆成平台文案、轮播图脚本或短视频脚本；给排期模板、发布队列建议与周复盘问题。",
    "reuse": "首选；复用跨平台改写和复盘方法，平台频率/最佳时间不作为固定真理。",
    "limit": "不自带登录授权或发布执行器；主要示例面向海外平台，不能直接视为小红书、公众号、知乎的已验证规则。",
    "effort": "低至中：生成文案只需材料；实际发帖、排程与指标读取另需平台或工具。",
    "availability": "未安装候选",
    "url": "https://github.com/coreyhaines31/marketingskills/blob/main/skills/social/SKILL.md",
    "license": "MIT，已核查仓库LICENSE",
    "sources": [
      {
        "label": "许可说明",
        "url": "https://github.com/coreyhaines31/marketingskills/blob/main/LICENSE"
      }
    ]
  },
  {
    "id": "analytics",
    "name": "analytics",
    "kind": "Skill",
    "stages": [
      "feedback"
    ],
    "summary": "定义事件、转化与UTM命名，给GA4/GTM实现和验证参考，输出测量计划。",
    "reuse": "后置；第一版用平台导出与少量指标即可，有落地页转化后再接。",
    "limit": "偏测量方案与埋点实施，不能直接把各社交账号数据拉成看板；数据访问需另接工具。",
    "effort": "中至高：分析导出数据门槛低，网站埋点需要网站权限、GA4/GTM等账号或连接器。",
    "availability": "未安装候选",
    "url": "https://github.com/coreyhaines31/marketingskills/blob/main/skills/analytics/SKILL.md",
    "license": "MIT，已核查仓库LICENSE",
    "sources": [
      {
        "label": "许可说明",
        "url": "https://github.com/coreyhaines31/marketingskills/blob/main/LICENSE"
      }
    ]
  },
  {
    "id": "readme-skills",
    "name": "readme-skills",
    "kind": "现有能力",
    "stages": [
      "research",
      "creation",
      "review"
    ],
    "summary": "从仓库代码和文档核实产品主张，制作、审查或同步多语言README，区分已验证、推断、缺失与冲突。",
    "reuse": "按需；软件产品可用来建立产品事实依据，通用工作台不能把它设为所有项目默认。",
    "limit": "不适用于所有内容形式；不会自动提交、推送或发布GitHub变更。",
    "effort": "低至中：需读取实际仓库；验证命令依项目条件。",
    "availability": "本机已可用",
    "url": "https://github.com/Shiaoming123/readme-skills/blob/main/SKILL.md",
    "license": "MIT，本机frontmatter及原仓库均已核查",
    "sources": [
      {
        "label": "许可说明",
        "url": "https://github.com/Shiaoming123/readme-skills/blob/main/LICENSE"
      }
    ]
  },
  {
    "id": "shuorenhua",
    "name": "说人话 / shuorenhua",
    "kind": "现有能力",
    "stages": [
      "review"
    ],
    "summary": "中英文表达编辑或只标问题，保留事实、责任主体、条件、数字、术语和原作者意图。",
    "reuse": "首选；直接复用，另外保留简短事实与发布格式检查。",
    "limit": "不做事实调查，也不判断AI含量；不自动检查平台禁限词或合规。",
    "effort": "低：提供待审文本及编辑范围即可。",
    "availability": "本机已可用",
    "url": "",
    "license": "未知：本机SKILL.md未声明，目录未发现LICENSE；未核查公开发行来源。",
    "sources": []
  },
  {
    "id": "imagegen",
    "name": "imagegen",
    "kind": "现有能力",
    "stages": [
      "creation"
    ],
    "summary": "生成或编辑封面、配图、插画和位图素材，支持参考图与保留编辑约束。",
    "reuse": "首选但按需；不为每篇内容强制生成图片。",
    "limit": "不是排版或发布系统；图片中的文字和产品细节仍需检查。",
    "effort": "低：本机默认使用内置image_gen，无需另填API密钥；显式选择CLI/API方式才需要OPENAI_API_KEY。",
    "availability": "本机已可用",
    "url": "",
    "license": "Apache-2.0，已核查本机LICENSE.txt；这是技能代码许可，不是模型服务或生成素材条款的判断。",
    "sources": []
  },
  {
    "id": "spreadsheets",
    "name": "Spreadsheets",
    "kind": "现有能力",
    "stages": [
      "feedback"
    ],
    "summary": "读取CSV/XLSX等实际数据，做计算、汇总、图表和可追溯的反馈报表。",
    "reuse": "首选；首版一张内容明细表配少量汇总就够，不建复杂BI。",
    "limit": "不等于社交平台数据连接器；需要手工录入、导出数据或另接来源。",
    "effort": "低：本机已有依赖加载器和表格运行时；创建文件按技能加载相应运行环境。",
    "availability": "本机已可用",
    "url": "",
    "license": "未知：本次未核查该打包插件的再分发许可。",
    "sources": []
  },
  {
    "id": "doc-coauthoring",
    "name": "doc-coauthoring",
    "kind": "Skill",
    "stages": [
      "creation",
      "review"
    ],
    "summary": "分上下文收集、逐节写作、陌生读者测试三个阶段，适合说明文、提案、操作文档。",
    "reuse": "备选；复用陌生读者检查思路，首版不引入完整多轮共创流程。",
    "limit": "不是渠道运营技能；没有发布或取数功能，完整对话流程对日常短内容偏重。",
    "effort": "低至中：文本材料即可；陌生读者测试最好有独立Agent或新会话；共享文档还需连接器。",
    "availability": "未安装候选",
    "url": "https://github.com/anthropics/skills/blob/main/skills/doc-coauthoring/SKILL.md",
    "license": "未完全核实：原仓库说明许多示例为Apache-2.0，但本次未取到该目录独立LICENSE，暂标未知；docx/pdf/pptx/xlsx明确为source-available而非开源。",
    "sources": [
      {
        "label": "许可说明",
        "url": "https://github.com/anthropics/skills/blob/main/README.md"
      }
    ]
  },
  {
    "id": "buffer",
    "name": "Buffer",
    "kind": "产品",
    "stages": [
      "creation",
      "review",
      "publishing",
      "feedback"
    ],
    "summary": "多平台运营首选，最容易交给非技术同事",
    "reuse": "一个内容对象从想法到发布贯穿全过程；审核待办独立于日历；评论可回流选题；每个平台的预览与失败状态明确",
    "limit": "Community 是已连接自有账号的评论管理，不代表全网舆情、任意竞品评论或私信全量读取。Bluesky 仅拉取通过 Buffer 发出的帖子的评论。帮助中心说明读/回评论在产品内完成，不通过当前 API；不要把评论数量当评论正文。 官方 MCP 文档列出 includeMetrics 和 get_aggregated_post_metrics；聚合指标每日刷新、可能延迟一天；不同渠道指标不同。旧帮助文档/营销 API 页面仍有 analytics 未开放的文字，首接需要实测具体端点。",
    "effort": "低：编辑、审核、排期、评论都在产品界面。API/MCP 初次配置由你完成即可。",
    "availability": "已调研 · 未连接",
    "url": "https://buffer.com/pricing",
    "pricing": "按连接频道、月/年订阅；Free/Essentials/Team。Team 提供审批和团队权限，不必在工作台重建。",
    "license": "托管 SaaS；本次未查到可自部署完整产品版本。",
    "workflow": "Ideas/看板收集素材 → Composer 改成各平台草稿 → Needs Approval → 审批者安排队列 → Insights 看效果 / Community 处理评论",
    "integration": "官方 GraphQL API、远程 MCP（https://mcp.buffer.com/mcp）；支持 Zapier/Make/n8n 等。API 可用计划及配额见定价页。",
    "approval": "Needs Approval 角色通过网页、移动端、API、MCP 创建的帖子均落为待审批草稿；Team 套餐提供审批。",
    "coverage": {
      "research": "选题/素材库，非完整联网研究",
      "creation": "原生草稿与 AI 改写",
      "review": "Team 原生审批与权限",
      "publishing": "原生日历、队列、排期、发布",
      "feedback": "内容指标 + 自有频道 Community 评论箱；读取评论 API 不等于已开放"
    },
    "sources": [
      {
        "label": "官方 MCP 端点及统计",
        "url": "https://developers.buffer.com/guides/integrations/mcp.html"
      },
      {
        "label": "审批规则",
        "url": "https://support.buffer.com/en-us/articles/managing-and-approving-draft-posts-57li7M8tDA"
      },
      {
        "label": "API 能力边界",
        "url": "https://support.buffer.com/en-us/articles/what-is-buffers-api-GtIYIQilz5"
      },
      {
        "label": "Community 评论边界",
        "url": "https://support.buffer.com/en-us/articles/using-community-on-the-buffer-mobile-app-mCNla9C1We"
      }
    ]
  },
  {
    "id": "typefully",
    "name": "Typefully",
    "kind": "产品",
    "stages": [
      "creation",
      "review",
      "publishing",
      "feedback"
    ],
    "summary": "文字内容、X/LinkedIn 个人品牌优先的轻量备选",
    "reuse": "按品牌/项目组织 Social Set；Write 和 Write & Publish 权限分离；草稿行内批注；日历可按团队、状态、标签筛选",
    "limit": "API 所列 comment threads / selected_text 是 Typefully 草稿内协作批注，不是已发布社媒内容的用户评论。 官方帮助文档与 API 说明目前仅 X analytics，不含 community posts；UI 可发布 X、LinkedIn、Threads、Bluesky、Mastodon、Substack Notes，API 支持列表不应直接套用 UI 列表。",
    "effort": "低：适合熟悉文档编辑的运营；跨工具审批的维护成本比 Buffer 原生审批高。",
    "availability": "已调研 · 未连接",
    "url": "https://support.typefully.com/en/articles/8717333-collaborating-in-teams",
    "pricing": "分套餐订阅；官方团队文档确认邀请协作者需 Business（或 legacy Team/Agency）。定价页正文未被公开抓取完整，不报具体数字。",
    "license": "托管 SaaS；本次未查到完整产品自部署版本。",
    "workflow": "按品牌创建 Social Set → 写草稿并生成平台版本 → 共享草稿/行内批注 → 有发布权限的人排期 → Analyze",
    "integration": "官方 REST API v2、OAuth 远程 MCP（https://mcp.typefully.com/mcp）、Zapier、Webhooks。",
    "approval": "Business 可邀请团队，Write 用户只能写，Write & Publish 可排期发布；官方另示范标签 + Zapier + Slack 批准后排期。不要假设所有草稿天然有强制审批状态机。",
    "coverage": {
      "research": "非完整研究系统",
      "creation": "强编辑器、AI 写作、跨平台草稿",
      "review": "内部批注、团队权限、可组合审批",
      "publishing": "日历与排期",
      "feedback": "内容分析目前主要限定 X；未核实公共社媒评论正文读取"
    },
    "sources": [
      {
        "label": "API",
        "url": "https://typefully.com/docs/api"
      },
      {
        "label": "MCP",
        "url": "https://support.typefully.com/en/articles/13128440-typefully-mcp-server"
      },
      {
        "label": "Zapier 审批流程",
        "url": "https://support.typefully.com/en/articles/8718280-automate-typefully-with-zapier"
      },
      {
        "label": "统计范围",
        "url": "https://support.typefully.com/en/articles/8718148-analytics-page-metrics"
      },
      {
        "label": "发布范围",
        "url": "https://support.typefully.com/en/articles/8728077-what-and-where-can-i-publish-with-typefully"
      },
      {
        "label": "定价",
        "url": "https://typefully.com/pricing"
      }
    ]
  },
  {
    "id": "postiz",
    "name": "Postiz",
    "kind": "产品",
    "stages": [
      "creation",
      "review",
      "publishing",
      "feedback"
    ],
    "summary": "开源可控、发布渠道广；托管优先，自部署放后",
    "reuse": "一组选定平台存成 Posting Set；平台设置表单与 API payload 共用向导；素材库、草稿和发布记录相连",
    "limit": "定价页的 Post comments 是自动添加首条或后续评论；analytics 中 Comments 是数量，均不能据此声称可读取全量用户评论。 GET /analytics/post/{postId} 返回 likes/comments/shares/impressions 等数字序列，随平台而异；还有平台级统计。",
    "effort": "托管中低；自部署高，非技术运营能用 UI，但不能独立接手运维和平台应用审核。",
    "availability": "已调研 · 未连接",
    "url": "https://github.com/gitroomhq/postiz-app",
    "pricing": "托管按套餐、频道与功能额度订阅；开源自部署另承担基础设施、模型和平台成本。",
    "license": "原始仓库 gitroomhq/postiz-app，AGPL-3.0；可自部署，也有官方托管。自部署仍需服务器维护与各社媒开发应用配置/审核。",
    "workflow": "连接频道 → 写作/生成素材 → 选择 Posting Set → 平台设置与预览 → Calendar 排期 → Analytics",
    "integration": "官方 REST API、Node.js SDK、n8n 节点、发布 Webhooks、OAuth 远程 MCP（https://mcp.postiz.com/mcp-oauth-dynamic）。",
    "approval": "官方可见团队成员协作，但本次未确认能像 Buffer Needs Approval 一样强制拦截 API/MCP 发布；若采用，应在上游保留人工审核门。",
    "coverage": {
      "research": "RSS 可作为输入；非完整研究",
      "creation": "AI copilot、图像/视频与剪辑",
      "review": "团队协作；本次未核实强制审批",
      "publishing": "多平台排期发布",
      "feedback": "API 原生内容统计；完整评论收件箱未核实"
    },
    "sources": [
      {
        "label": "API",
        "url": "https://docs.postiz.com/public-api/introduction"
      },
      {
        "label": "统计端点",
        "url": "https://docs.postiz.com/public-api/analytics/post"
      },
      {
        "label": "官方 MCP",
        "url": "https://postiz.com/mcp"
      },
      {
        "label": "定价与自部署说明",
        "url": "https://postiz.com/pricing"
      }
    ]
  },
  {
    "id": "n8n",
    "name": "n8n",
    "kind": "产品",
    "stages": [
      "research",
      "creation",
      "review",
      "publishing",
      "feedback"
    ],
    "summary": "流程稳定后的后台编排，不是第一版运营工作台",
    "reuse": "执行记录显示每步输入输出；失败可单独定位；人工待办与后台执行分离",
    "limit": "HTTP/MCP/节点不会自动获得社媒评论权限；无原文来源时不能生成真实用户意见总结。 自带执行成功率、日志等是工作流运行统计；社媒效果仍从 Buffer/Postiz/平台接入。",
    "effort": "搭建中高、日常填表/审批低；让运营使用表单/待办，不必让接手者编辑流程图。",
    "availability": "已调研 · 未连接",
    "url": "https://n8n.io/ai/",
    "pricing": "托管按整条 workflow executions 计费，通常不是每个节点；Community 自部署可免费使用但有维护成本和许可条件。",
    "license": "Cloud 或 self-hosted Community；官方称 fair-code/source-available，不应直接称为无条件开源。",
    "workflow": "模板/触发器 → 搜集节点 → AI 处理 → 人工审批 → 调用发布服务 → 记录执行结果/失败 → 定期聚合",
    "integration": "API、HTTP/GraphQL、Webhook、预制节点、MCP 调用和工作流连接能力。",
    "approval": "官方支持在 Agent tool call 前插入人工审核；具体传递内容与批准后的动作仍需配置。",
    "coverage": {
      "research": "连接搜索/RSS/资料源",
      "creation": "模型节点",
      "review": "Human in the Loop 工具审批",
      "publishing": "调用发布产品 API/MCP",
      "feedback": "仅能分析接入得到的数据"
    },
    "sources": [
      {
        "label": "人工审核操作",
        "url": "https://blog.n8n.io/production-ai-playbook-human-oversight/"
      },
      {
        "label": "部署选择",
        "url": "https://docs.n8n.io/choose-how-to-use-n8n"
      },
      {
        "label": "原仓库",
        "url": "https://github.com/n8n-io/n8n"
      },
      {
        "label": "定价",
        "url": "https://n8n.io/pricing/"
      }
    ]
  },
  {
    "id": "relevance-ai",
    "name": "Relevance AI",
    "kind": "产品",
    "stages": [
      "research",
      "creation",
      "review",
      "publishing",
      "feedback"
    ],
    "summary": "把研究、写作、审查做成可交接的专职 Agent，适合更复杂团队",
    "reuse": "岗位化 Agent 与共享知识；逐工具设置自动/人工；将待批准、需帮助、错误集中呈现",
    "limit": "只处理连接器/导入提供的评论、工单、访谈等；是否可读某社媒评论由该工具权限决定。 平台评估/成本/任务通过率是 Agent 运行指标；内容效果要外接数据。",
    "effort": "日常中低，配置中等；比自建 Agent 后端好交接，但小团队初版可能偏重。",
    "availability": "已调研 · 未连接",
    "url": "https://relevanceai.com/agents",
    "pricing": "套餐/Actions/Vendor Credits 模式；当前 pricing 主页偏 Enterprise 报价，另一个 pricing-new 页面存在多套套餐文案，具体金额应结账核实。",
    "license": "官方托管，当前 Tool Builder 明确 Managed platform, not self-hosted。",
    "workflow": "选择/描述 Agent → 设置共享知识、工具 → 每个工具设 Autopilot 或 Human in the Loop → Workforce 连线 → Tasks 看审批/错误",
    "integration": "官方支持 REST/GraphQL 自定义工具、MCP 接入、API/SDK/CLI 和 webhook/cron/app triggers。",
    "approval": "可按工具要求人工批准，并在 workforce 连线设置 Approval required；不把 Let agent decide 当必经发布门。",
    "coverage": {
      "research": "Agent + 搜索/网页/知识工具",
      "creation": "Agent + 共享品牌知识",
      "review": "原生每工具审批/升级人工",
      "publishing": "依赖外部服务的工具",
      "feedback": "导入反馈后分析；非原生社媒收件箱"
    },
    "sources": [
      {
        "label": "Approval Mode",
        "url": "https://relevanceai.com/docs/build/agents/give-your-agent-tasks/approval-mode"
      },
      {
        "label": "Workforce 连线",
        "url": "https://relevanceai.com/docs/build/workforces/build-an-ai-workforce/edge-settings"
      },
      {
        "label": "工具和部署",
        "url": "https://relevanceai.com/tool"
      },
      {
        "label": "定价",
        "url": "https://relevanceai.com/pricing"
      },
      {
        "label": "另一官方价格页（文案不一致）",
        "url": "https://relevanceai.com/pricing-new"
      }
    ]
  },
  {
    "id": "gumloop",
    "name": "Gumloop",
    "kind": "产品",
    "stages": [
      "research",
      "creation",
      "review",
      "publishing",
      "feedback"
    ],
    "summary": "非技术接手的轻量 Agent/自动化层备选，与 Relevance AI 二选一",
    "reuse": "将复杂流程包成用户输入表单；Pending Approval 集中待办；每次批准显示将执行的工具和参数",
    "limit": "MCP 连接器可取哪些数据取决于实际工具；不能把连接器列表当成全网评论访问。 AI Spend Insights/usage analytics 是平台使用统计，非社媒内容统计；需另接数据。",
    "effort": "日常低，初次配置中等；当前价格页将旧画布 Workflows 标为 Legacy，新方案宜以 Agent/connector 为主要入口。",
    "availability": "已调研 · 未连接",
    "url": "https://www.gumloop.com/blog/human-in-the-loop",
    "pricing": "Pro/Enterprise，订阅含 credits，并有 orchestration fee；以官方当日价格页为准。",
    "license": "托管 SaaS；Enterprise 有可选 VPC，未查到公开自部署完整产品。",
    "workflow": "模板或自然语言建 Agent → Connectors/知识/工具 → 设置批准动作 → 非技术用户聊天或填接口表单 → Pending Approval → 结果及运行记录",
    "integration": "官方 MCP 连接器/托管/代理；Gumloop API 可触发 Agent/Workflow，生成 API key 要 Pro+；webhook 调用路径官方有文档。",
    "approval": "官方已支持 Agent 暂停、逐工具批准和 App Rules；后台运行遇批准可通过通知或已连接 Slack 请求。",
    "coverage": {
      "research": "搜索连接器/研究模板",
      "creation": "Agent/模型写作",
      "review": "工具级人工批准",
      "publishing": "连接发布服务",
      "feedback": "分析实际传入的数据"
    },
    "sources": [
      {
        "label": "API 和套餐门槛",
        "url": "https://support.gumloop.com/articles/9675038509-how-to-find-and-generate-your-gumloop-api-key"
      },
      {
        "label": "研究连接器",
        "url": "https://www.gumloop.com/mcp/exa"
      },
      {
        "label": "研究模板",
        "url": "https://www.gumloop.com/templates/ai-research-agent-with-automated-report-generation"
      },
      {
        "label": "定价",
        "url": "https://www.gumloop.com/pricing"
      }
    ]
  }
];
