export type McpServer = {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  enabled: boolean
  source: 'preset' | 'user'
  description?: string
}

export const presetMcpServers: McpServer[] = [
  {
    id: 'sqlite',
    name: 'sqlite',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', '/path/to/your/database.db'],
    enabled: true,
    source: 'preset',
    description: '提供对 SQLite 数据库的只读或读写访问，使模型能查询数据库 Schema 并执行 SQL。',
  },
  {
    id: 'fetch',
    name: 'fetch',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    enabled: true,
    source: 'preset',
    description: '使模型能通过 HTTP/HTTPS 抓取网页内容，并自动转换为 Markdown 格式供模型阅读。',
  },
  {
    id: 'google-search',
    name: 'google-search',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-google-search'],
    env: {
      GOOGLE_API_KEY: 'your-api-key',
      GOOGLE_CSE_ID: 'your-cse-id',
    },
    enabled: false,
    source: 'preset',
    description: '使模型能执行谷歌搜索，获取最新的网页搜索结果。需要配置 API 密钥和 CSE ID。',
  },
  {
    id: 'filesystem',
    name: 'filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/directory'],
    enabled: false,
    source: 'preset',
    description: '安全地暴露指定的本地目录给模型，使模型能读取和写入该目录下的文件。',
  },
]
