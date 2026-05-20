export type McpServer = {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  enabled: boolean
  source: 'preset' | 'user' | 'external'
  description?: string
}

export const presetMcpServers: McpServer[] = [
  {
    id: 'context7',
    name: 'context7',
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp'],
    env: {
      API_KEY: '',
    },
    enabled: true,
    source: 'preset',
    description: '实时检索并注入最新版本官方文档与代码示例，解决模型知识库过时问题。支持配置 API_KEY 以提升请求频次。',
  },
  {
    id: 'playwright',
    name: 'playwright',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest'],
    enabled: true,
    source: 'preset',
    description: '允许模型执行 Playwright 浏览器自动化操作，包括访问网页、交互、抓取 DOM 结构及捕获截图等。',
  },
  {
    id: 'memory',
    name: 'memory',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    enabled: true,
    source: 'preset',
    description: '使用轻量级本地知识图谱为模型提供持久化长期记忆，能够跨会话记住用户偏好、习惯与技术架构决策。',
  },
]
