import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Bot,
  CheckCircle2,
  Database,
  GraduationCap,
  Moon,
  PanelRight,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
  Wand2,
} from 'lucide-react'
import './App.css'
import type { AdmissionPayload, AdvisorResult, Band, Recommendation } from './lib/advisor'
import { buildAdvisorResult, buildFunReply, buildLocalReply, formatNumber, getProvincePolicy } from './lib/advisor'

type Mode = 'gaokao' | 'fun'
type Role = 'user' | 'assistant'

type ChatMessage = {
  id: string
  role: Role
  content: string
  createdAt: number
  result?: AdvisorResult
  webNotes?: string[]
  aiEnhanced?: boolean
}

type Conversation = {
  id: string
  name: string
  mode: Mode
  messages: ChatMessage[]
  updatedAt: number
}

type SettingsState = {
  baseUrl: string
  apiKey: string
  model: string
  tavilyKey: string
}

const STORAGE = {
  conversations: 'xf_web_conversations',
  currentId: 'xf_web_current',
  mode: 'xf_web_mode',
  settings: 'xf_web_settings',
  theme: 'xf_web_theme',
}

const DEFAULT_SETTINGS: SettingsState = {
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-chat',
  tavilyKey: '',
}

const STARTER_PROMPTS = [
  '浙江655分，位次10500，想学计算机电子，帮我盘冲稳保',
  '山东物理类580分，位次28000，普通家庭，计算机和电气怎么选',
  '黑龙江历史类520分，想考编，法学和汉语言哪个稳',
]

const BAND_COPY: Record<Band, { title: string; hint: string }> = {
  chong: { title: '冲', hint: '录取位次高于你，适合少量尝试' },
  wen: { title: '稳', hint: '位次贴近，作为主体填报' },
  bao: { title: '保', hint: '位次更宽，负责兜底' },
}

function createId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createConversation(mode: Mode): Conversation {
  return {
    id: createId('chat'),
    name: mode === 'gaokao' ? '新报考咨询' : '轻松问答',
    mode,
    messages: [],
    updatedAt: Date.now(),
  }
}

function readStoredConversations() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE.conversations) || '[]') as Conversation[]
    if (Array.isArray(parsed) && parsed.length) return parsed
  } catch {
    localStorage.removeItem(STORAGE.conversations)
  }
  return [createConversation('gaokao')]
}

function readStoredSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE.settings) || '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function sanitizeConversationName(text: string) {
  return text.replace(/\s+/g, ' ').slice(0, 18) || '新对话'
}

async function callOpenAICompatible(settings: SettingsState, result: AdvisorResult, userText: string, meta?: AdmissionPayload['meta'], webNotes: string[] = []) {
  const localAnswer = buildLocalReply(result, meta)
  const endpoint = `${settings.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model || DEFAULT_SETTINGS.model,
      temperature: 0.45,
      messages: [
        {
          role: 'system',
          content:
            '你是高考志愿顾问。必须基于给定本地样本数据回答；没有数据就明说暂无数据，不能编造分数、位次和年份。回答直接、接地气、结构化。',
        },
        {
          role: 'system',
          content: `本地样本分析如下：\n${localAnswer}\n\n联网摘要：\n${webNotes.join('\n') || '未启用或无结果'}`,
        },
        { role: 'user', content: userText },
      ],
    }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => undefined)
    throw new Error(error?.error?.message || `HTTP ${response.status}`)
  }
  const data = await response.json()
  return String(data.choices?.[0]?.message?.content || '').trim()
}

async function searchTavily(query: string, key: string) {
  if (!key) return []
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      query,
      search_depth: 'basic',
      include_answer: true,
      max_results: 4,
    }),
  })
  if (!response.ok) return []
  const data = await response.json()
  const notes: string[] = []
  if (data.answer) notes.push(`[Tavily] ${data.answer}`)
  for (const item of data.results || []) {
    notes.push(`${item.title}: ${String(item.content || '').slice(0, 180)}`)
  }
  return notes.slice(0, 5)
}

function StatusPill({ icon, label, tone = 'neutral' }: { icon: ReactNode; label: string; tone?: 'neutral' | 'good' | 'warn' }) {
  return (
    <span className={`status-pill ${tone}`}>
      {icon}
      {label}
    </span>
  )
}

function Sidebar({
  conversations,
  currentId,
  mode,
  meta,
  onSelect,
  onCreate,
  onDelete,
}: {
  conversations: Conversation[]
  currentId: string
  mode: Mode
  meta?: AdmissionPayload['meta']
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}) {
  const visible = conversations.filter((conversation) => conversation.mode === mode)

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark">
          <GraduationCap size={20} />
        </div>
        <div>
          <h1>志愿规划助手</h1>
          <p>高考志愿数据工作台</p>
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-top">
          <Database size={17} />
          <span>内置样本数据</span>
        </div>
        <strong>{meta ? formatNumber(meta.sampleRows) : '加载中'} 行</strong>
        <p>{meta ? `${meta.provinces.join('、')} · ${meta.years.join(' / ')}` : '正在读取真实录取样本'}</p>
      </div>

      <div className="conversation-heading">
        <span>对话</span>
        <button type="button" title="新建对话" onClick={onCreate}>
          <Plus size={16} />
        </button>
      </div>

      <div className="conversation-list">
        {visible.map((conversation) => (
          <button
            type="button"
            className={`conversation-item ${conversation.id === currentId ? 'active' : ''}`}
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
          >
            <span>{conversation.name}</span>
            <small>{conversation.messages.length ? `${conversation.messages.length} 条` : '空'}</small>
            <span
              role="button"
              tabIndex={0}
              title="删除对话"
              className="delete-chat"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(conversation.id)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  onDelete(conversation.id)
                }
              }}
            >
              <Trash2 size={14} />
            </span>
          </button>
        ))}
      </div>

      <div className="license-note">
        <ShieldCheck size={15} />
        <span>本地样本仅作辅助参考，正式填报请复核官方来源。</span>
      </div>
    </aside>
  )
}

function TopBar({
  mode,
  dark,
  settings,
  busy,
  onMode,
  onTheme,
  onSettings,
}: {
  mode: Mode
  dark: boolean
  settings: SettingsState
  busy: boolean
  onMode: (mode: Mode) => void
  onTheme: () => void
  onSettings: () => void
}) {
  return (
    <header className="topbar">
      <div className="mode-switch" aria-label="模式切换">
        <button type="button" className={mode === 'gaokao' ? 'active' : ''} onClick={() => onMode('gaokao')}>
          <GraduationCap size={16} />
          报考
        </button>
        <button type="button" className={mode === 'fun' ? 'active' : ''} onClick={() => onMode('fun')}>
          <Wand2 size={16} />
          娱乐
        </button>
      </div>

      <div className="topbar-status">
        <StatusPill icon={<Database size={14} />} label="本地数据" tone="good" />
        <StatusPill icon={<Search size={14} />} label={settings.tavilyKey ? '联网搜索' : '未填 Tavily'} tone={settings.tavilyKey ? 'good' : 'warn'} />
        <StatusPill icon={<Bot size={14} />} label={settings.apiKey ? settings.model : '本地模拟'} tone={settings.apiKey ? 'good' : 'neutral'} />
      </div>

      <div className="topbar-actions">
        {busy ? <span className="busy-label">分析中</span> : null}
        <button type="button" title={dark ? '切换浅色' : '切换深色'} className="icon-button" onClick={onTheme}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button type="button" className="settings-button" onClick={onSettings}>
          <Settings size={17} />
          API设置
        </button>
      </div>
    </header>
  )
}

function EmptyState({ mode, onPrompt }: { mode: Mode; onPrompt: (prompt: string) => void }) {
  return (
    <div className="empty-state">
      <div className="empty-visual" aria-hidden="true">
        <span className="visual-orbit one" />
        <span className="visual-orbit two" />
        <GraduationCap size={44} />
      </div>
      <div>
        <h2>{mode === 'fun' ? '娱乐模式' : '报考模式'}</h2>
        <p>{mode === 'fun' ? '适合先快速梳理想法，正式填报请切回报考逐条核数据。' : '输入省份、分数、位次和专业偏好，系统会先查样本库再组织建议。'}</p>
      </div>
      <div className="prompt-row">
        {STARTER_PROMPTS.map((prompt) => (
          <button type="button" key={prompt} onClick={() => onPrompt(prompt)}>
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({ message, mode }: { message: ChatMessage; mode: Mode }) {
  return (
    <article className={`message ${message.role}`}>
      <div className="message-avatar">{message.role === 'user' ? <UserRound size={17} /> : mode === 'fun' ? <Sparkles size={17} /> : <Bot size={17} />}</div>
      <div className="message-body">
        <div className="message-meta">
          <span>{message.role === 'user' ? '你' : mode === 'fun' ? '娱乐顾问' : '志愿顾问'}</span>
          {message.aiEnhanced ? <small>AI增强</small> : message.role === 'assistant' ? <small>本地样本</small> : null}
        </div>
        <p>{message.content}</p>
        {message.webNotes?.length ? (
          <div className="web-notes">
            {message.webNotes.slice(0, 3).map((note) => (
              <span key={note}>{note}</span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function ChatPanel({
  conversation,
  mode,
  input,
  busy,
  onInput,
  onSubmit,
  onPrompt,
}: {
  conversation?: Conversation
  mode: Mode
  input: string
  busy: boolean
  onInput: (value: string) => void
  onSubmit: (event?: FormEvent) => void
  onPrompt: (prompt: string) => void
}) {
  return (
    <section className="chat-panel">
      <div className="chat-scroll">
        {!conversation?.messages.length ? (
          <EmptyState mode={mode} onPrompt={onPrompt} />
        ) : (
          conversation.messages.map((message) => <MessageBubble key={message.id} message={message} mode={conversation.mode} />)
        )}
        {busy ? (
          <article className="message assistant">
            <div className="message-avatar">
              <Bot size={17} />
            </div>
            <div className="message-body loading">
              <span />
              <span />
              <span />
            </div>
          </article>
        ) : null}
      </div>

      <form className="composer" onSubmit={onSubmit}>
        <textarea
          value={input}
          onChange={(event) => onInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              onSubmit()
            }
          }}
          placeholder="浙江655分 位次10500 想学计算机电子"
          rows={2}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          <Send size={18} />
          发送
        </button>
      </form>
    </section>
  )
}

function ParsedPanel({ result, meta }: { result?: AdvisorResult; meta?: AdmissionPayload['meta'] }) {
  const parsed = result?.parsed
  const policy = parsed?.province ? getProvincePolicy(parsed.province) : undefined

  return (
    <section className="parsed-panel">
      <div className="rail-heading">
        <PanelRight size={17} />
        <h2>解析</h2>
      </div>
      <div className="chip-grid">
        <DataChip label="省份" value={parsed?.province || '待识别'} />
        <DataChip label="分数" value={parsed?.score ? `${parsed.score} 分` : '待补充'} />
        <DataChip label="位次" value={parsed?.rank ? `${formatNumber(parsed.rank)} 位` : '待补充'} />
        <DataChip label="方向" value={parsed?.majors.length ? parsed.majors.join('、') : '未限定'} />
      </div>
      <div className="policy-box">
        <strong>{policy ? `${policy.mode} · ${policy.count} 个志愿` : '省份政策待识别'}</strong>
        <span>{parsed?.subject || '科类未识别'} {parsed?.avoidMajors.length ? `· 已避开 ${parsed.avoidMajors.join('、')}` : ''}</span>
      </div>
      <div className="coverage-box">
        <span>样本覆盖</span>
        <strong>{meta ? `${formatNumber(meta.sampleRows)} / ${formatNumber(meta.fullDbRows)} 行` : '读取中'}</strong>
        <p>{meta?.note || '从原项目数据库抽取轻量数据用于浏览器复刻。'}</p>
      </div>
    </section>
  )
}

function DataChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="data-chip">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function RecommendationCard({ row }: { row: Recommendation }) {
  return (
    <article className="rec-card">
      <div className="rec-topline">
        <strong>{row.school}</strong>
        <span>{row.year}</span>
      </div>
      <p>{row.major}</p>
      <div className="rec-metrics">
        <span>{row.score} 分</span>
        <span>{formatNumber(row.rank)} 位</span>
      </div>
      <div className="rec-source">
        <CheckCircle2 size={13} />
        <span>{row.matchedBy}</span>
        <small>{row.distanceLabel}</small>
      </div>
    </article>
  )
}

function RecommendationColumn({ band, rows }: { band: Band; rows: Recommendation[] }) {
  const copy = BAND_COPY[band]
  return (
    <section className={`rec-column ${band}`}>
      <header>
        <h3>{copy.title}</h3>
        <span>{copy.hint}</span>
      </header>
      <div className="rec-list">
        {rows.length ? rows.map((row) => <RecommendationCard key={`${row.school}-${row.major}-${row.year}-${row.rank}`} row={row} />) : <p className="empty-rec">暂无命中</p>}
      </div>
    </section>
  )
}

function InsightRail({ result, meta }: { result?: AdvisorResult; meta?: AdmissionPayload['meta'] }) {
  const recommendations = result?.recommendations ?? { chong: [], wen: [], bao: [] }

  return (
    <aside className="insight-rail">
      <ParsedPanel result={result} meta={meta} />
      <div className="recommendation-grid">
        <RecommendationColumn band="chong" rows={recommendations.chong} />
        <RecommendationColumn band="wen" rows={recommendations.wen} />
        <RecommendationColumn band="bao" rows={recommendations.bao} />
      </div>
      <section className="source-panel">
        <h2>数据来源</h2>
        {result?.sourceNotes.length ? (
          result.sourceNotes.slice(0, 6).map((note) => <p key={note}>{note}</p>)
        ) : (
          <p>发送问题后会列出本地样本命中的数据来源。</p>
        )}
      </section>
    </aside>
  )
}

function SettingsDialog({
  open,
  settings,
  testing,
  status,
  onClose,
  onChange,
  onTest,
}: {
  open: boolean
  settings: SettingsState
  testing: boolean
  status: string
  onClose: () => void
  onChange: (settings: SettingsState) => void
  onTest: () => void
}) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <h2 id="settings-title">API设置</h2>
          <p>兼容 DeepSeek、通义、智谱和 OpenAI 风格接口；Key 只存在浏览器本地。</p>
        </div>
        <label>
          Base URL
          <input value={settings.baseUrl} onChange={(event) => onChange({ ...settings, baseUrl: event.target.value })} placeholder="https://api.deepseek.com" />
        </label>
        <label>
          API Key
          <input type="password" value={settings.apiKey} onChange={(event) => onChange({ ...settings, apiKey: event.target.value })} placeholder="sk-..." />
        </label>
        <label>
          Model
          <input value={settings.model} onChange={(event) => onChange({ ...settings, model: event.target.value })} placeholder="deepseek-chat" />
        </label>
        <label>
          Tavily Key
          <input type="password" value={settings.tavilyKey} onChange={(event) => onChange({ ...settings, tavilyKey: event.target.value })} placeholder="tvly-..." />
        </label>
        <div className="modal-help">
          填 Tavily 后会尝试联网搜索学校近况和专业信息；不填也能用本地样本跑冲稳保。
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary" onClick={onTest} disabled={testing || !settings.baseUrl || !settings.apiKey}>
            {testing ? '测试中' : '保存并测试'}
          </button>
        </div>
        {status ? <p className="settings-status">{status}</p> : null}
      </section>
    </div>
  )
}

function App() {
  const [payload, setPayload] = useState<AdmissionPayload>()
  const [conversations, setConversations] = useState<Conversation[]>(readStoredConversations)
  const [currentId, setCurrentId] = useState(() => localStorage.getItem(STORAGE.currentId) || '')
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem(STORAGE.mode) as Mode) || 'gaokao')
  const [settings, setSettings] = useState<SettingsState>(readStoredSettings)
  const [dark, setDark] = useState(() => localStorage.getItem(STORAGE.theme) === 'dark')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const [settingsStatus, setSettingsStatus] = useState('')

  useEffect(() => {
    let mounted = true
    fetch('/data/admissions.json')
      .then((response) => response.json())
      .then((data: AdmissionPayload) => {
        if (mounted) setPayload(data)
      })
      .catch(() => {
        if (mounted) setPayload({ meta: { generatedFrom: '', fullDbRows: 0, sampleRows: 0, provinces: [], years: [], keywords: [], note: '样本数据加载失败。' }, rows: [] })
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem(STORAGE.theme, dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    localStorage.setItem(STORAGE.conversations, JSON.stringify(conversations))
  }, [conversations])

  useEffect(() => {
    localStorage.setItem(STORAGE.currentId, currentId)
  }, [currentId])

  useEffect(() => {
    localStorage.setItem(STORAGE.mode, mode)
  }, [mode])

  useEffect(() => {
    localStorage.setItem(STORAGE.settings, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    const current = conversations.find((conversation) => conversation.id === currentId)
    if (current?.mode === mode) return
    const existing = conversations.find((conversation) => conversation.mode === mode)
    if (existing) {
      setCurrentId(existing.id)
      return
    }
    const created = createConversation(mode)
    setConversations((items) => [...items, created])
    setCurrentId(created.id)
  }, [conversations, currentId, mode])

  const currentConversation = useMemo(() => conversations.find((conversation) => conversation.id === currentId), [conversations, currentId])
  const latestResult = useMemo(() => [...(currentConversation?.messages ?? [])].reverse().find((message) => message.result)?.result, [currentConversation])

  function createChat() {
    const created = createConversation(mode)
    setConversations((items) => [created, ...items])
    setCurrentId(created.id)
  }

  function deleteChat(id: string) {
    setConversations((items) => {
      const next = items.filter((conversation) => conversation.id !== id)
      return next.length ? next : [createConversation(mode)]
    })
    if (currentId === id) {
      const fallback = conversations.find((conversation) => conversation.id !== id && conversation.mode === mode)
      setCurrentId(fallback?.id || '')
    }
  }

  function updateConversation(id: string, updater: (conversation: Conversation) => Conversation) {
    setConversations((items) => items.map((conversation) => (conversation.id === id ? updater(conversation) : conversation)))
  }

  async function handleSend(event?: FormEvent) {
    event?.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setBusy(true)

    const targetId = currentConversation?.id || currentId
    const result = buildAdvisorResult(payload?.rows ?? [], text)
    const userMessage: ChatMessage = { id: createId('msg'), role: 'user', content: text, createdAt: Date.now() }

    updateConversation(targetId, (conversation) => ({
      ...conversation,
      name: conversation.messages.length ? conversation.name : sanitizeConversationName(text),
      messages: [...conversation.messages, userMessage],
      updatedAt: Date.now(),
    }))

    let webNotes: string[] = []
    if (settings.tavilyKey && mode === 'gaokao') {
      webNotes = await searchTavily(text, settings.tavilyKey).catch(() => [])
    }

    let content = mode === 'fun' ? buildFunReply(text, result) : buildLocalReply(result, payload?.meta)
    let aiEnhanced = false

    if (settings.apiKey && mode === 'gaokao') {
      try {
        const aiContent = await callOpenAICompatible(settings, result, text, payload?.meta, webNotes)
        if (aiContent) {
          content = aiContent
          aiEnhanced = true
        }
      } catch (error) {
        content = `${content}\n\nAI增强失败：${error instanceof Error ? error.message : '接口不可用'}。已保留本地样本结果。`
      }
    }

    const assistantMessage: ChatMessage = {
      id: createId('msg'),
      role: 'assistant',
      content,
      createdAt: Date.now(),
      result,
      webNotes,
      aiEnhanced,
    }

    updateConversation(targetId, (conversation) => ({
      ...conversation,
      messages: [...conversation.messages, assistantMessage],
      updatedAt: Date.now(),
    }))
    setBusy(false)
  }

  async function testSettings() {
    setTesting(true)
    setSettingsStatus('正在测试连接...')
    try {
      const endpoint = `${settings.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model || DEFAULT_SETTINGS.model,
          max_tokens: 8,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setSettingsStatus('连接OK，已保存到浏览器本地。')
      window.setTimeout(() => setSettingsOpen(false), 700)
    } catch (error) {
      setSettingsStatus(`连接失败：${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        currentId={currentId}
        mode={mode}
        meta={payload?.meta}
        onSelect={setCurrentId}
        onCreate={createChat}
        onDelete={deleteChat}
      />

      <main className="workspace">
        <TopBar mode={mode} dark={dark} settings={settings} busy={busy} onMode={setMode} onTheme={() => setDark((value) => !value)} onSettings={() => setSettingsOpen(true)} />
        <div className="workspace-grid">
          <ChatPanel conversation={currentConversation} mode={mode} input={input} busy={busy} onInput={setInput} onSubmit={handleSend} onPrompt={setInput} />
          <InsightRail result={latestResult} meta={payload?.meta} />
        </div>
      </main>

      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        testing={testing}
        status={settingsStatus}
        onClose={() => setSettingsOpen(false)}
        onChange={setSettings}
        onTest={testSettings}
      />
    </div>
  )
}

export default App
