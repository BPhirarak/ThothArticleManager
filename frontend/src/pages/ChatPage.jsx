import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Send, Trash2, Bot, User, RefreshCw, History, X, Globe, BookOpen,
         ChevronDown, Plus, Check, ExternalLink, Square, Search, Tag } from 'lucide-react'
import { sendMessage, getArticles, getTopics, getAllTags } from '../api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const MODELS = [
  { value: 'bedrock-sonnet', label: 'Claude Sonnet 4 (Bedrock APAC)' },
  { value: 'bedrock-opus', label: 'Claude Opus 4 (Bedrock APAC)' },
  { value: 'openai', label: 'GPT-4o (OpenAI)' },
]

// ── Markdown components ────────────────────────────────────────────────────
const mdComponents = {
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full text-xs border-collapse border border-steel-600">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-steel-700">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-steel-600 even:bg-steel-800/50">{children}</tr>,
  th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-blue-300 border border-steel-600">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 text-steel-200 border border-steel-600">{children}</td>,
  h1: ({ children }) => <h1 className="text-base font-bold text-white mt-3 mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold text-blue-300 mt-3 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-steel-200 mt-2 mb-1">{children}</h3>,
  strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-steel-300">{children}</em>,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1 text-steel-200">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1 text-steel-200">{children}</ol>,
  li: ({ children }) => <li className="text-steel-200 leading-relaxed">{children}</li>,
  code: ({ inline, children }) => inline
    ? <code className="bg-steel-700 text-amber-300 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
    : <pre className="bg-steel-900 border border-steel-700 rounded-lg p-3 overflow-x-auto my-2"><code className="text-green-400 text-xs font-mono">{children}</code></pre>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-blue-500 pl-3 my-2 text-steel-400 italic">{children}</blockquote>
  ),
  hr: () => <hr className="border-steel-600 my-3" />,
  p: ({ children }) => <p className="text-steel-200 leading-relaxed mb-1">{children}</p>,
}

// ── Article/Category Selector ──────────────────────────────────────────────
function ContextSelector({ articles, topics, allTags, contextMode, setContextMode,
                           selectedArticleIds, setSelectedArticleIds,
                           selectedCategory, setSelectedCategory, lang }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('category') // 'category' | 'tag' | 'article'
  const [tagSearch, setTagSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState(new Set())
  const [articleSearch, setArticleSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const matchingTags = useMemo(() =>
    tagSearch.length >= 1
      ? allTags.filter(t => t.toLowerCase().includes(tagSearch.toLowerCase())).slice(0, 20)
      : [],
    [allTags, tagSearch]
  )

  const tagFilteredArticles = useMemo(() => {
    return articles.filter(a => {
      const matchTag = selectedTags.size === 0 || [...selectedTags].some(t => (a.tags || []).includes(t))
      const matchSearch = !articleSearch || a.title.toLowerCase().includes(articleSearch.toLowerCase())
      return matchTag && matchSearch
    })
  }, [articles, selectedTags, articleSearch])

  const toggleTag = (tag) => {
    setSelectedTags(prev => { const s = new Set(prev); s.has(tag) ? s.delete(tag) : s.add(tag); return s })
    setTab('article')
  }

  const toggleArticle = (id) => {
    setSelectedArticleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setContextMode('articles')
  }

  const toggleAllFiltered = () => {
    const ids = tagFilteredArticles.map(a => a.id)
    const allSelected = ids.every(id => selectedArticleIds.includes(id))
    if (allSelected) setSelectedArticleIds(prev => prev.filter(id => !ids.includes(id)))
    else setSelectedArticleIds(prev => [...new Set([...prev, ...ids])])
    setContextMode('articles')
  }

  const label = contextMode === 'all'
    ? (lang === 'th' ? '📚 ทุกบทความ (RAG)' : '📚 All Articles (RAG)')
    : contextMode === 'category'
    ? `🏷️ ${selectedCategory}`
    : `📄 ${selectedArticleIds.length} ${lang === 'th' ? 'บทความ' : 'article(s)'}`

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs bg-steel-700 hover:bg-steel-600 border border-steel-600 text-steel-200 px-3 py-1.5 rounded-lg transition-colors">
        <BookOpen size={13} />
        <span className="max-w-40 truncate">{label}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-steel-800 border border-steel-700 rounded-xl shadow-xl z-50 flex flex-col max-h-[520px]">
          <button onClick={() => { setContextMode('all'); setOpen(false) }}
            className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-steel-700 border-b border-steel-700 ${contextMode === 'all' ? 'text-blue-400' : 'text-steel-200'}`}>
            {contextMode === 'all' ? <Check size={14} /> : <span className="w-3.5" />}
            📚 {lang === 'th' ? 'ทุกบทความ (RAG)' : 'All Articles (RAG)'}
          </button>

          <div className="flex border-b border-steel-700">
            {[
              { key: 'category', label: lang === 'th' ? 'หมวดหมู่' : 'Category' },
              { key: 'tag', label: 'Tag' },
              { key: 'article', label: lang === 'th' ? 'บทความ' : 'Articles' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === t.key ? 'text-blue-400 border-b-2 border-blue-400' : 'text-steel-400 hover:text-white'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === 'category' && (
              <div>
                {topics.map(t => (
                  <button key={t} onClick={() => { setContextMode('category'); setSelectedCategory(t); setOpen(false) }}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-steel-700 ${contextMode === 'category' && selectedCategory === t ? 'text-blue-400' : 'text-steel-200'}`}>
                    {contextMode === 'category' && selectedCategory === t ? <Check size={14} /> : <span className="w-3.5" />}
                    {t}
                  </button>
                ))}
              </div>
            )}

            {tab === 'tag' && (
              <div className="p-2 space-y-2">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steel-400" />
                  <input className="input pl-7 text-xs py-1.5"
                    placeholder={lang === 'th' ? 'พิมพ์เพื่อค้นหา tag...' : 'Search tags...'}
                    value={tagSearch} onChange={e => setTagSearch(e.target.value)} autoFocus />
                </div>
                {selectedTags.size > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {[...selectedTags].map(tag => (
                      <span key={tag} className="flex items-center gap-1 text-xs bg-blue-900/50 text-blue-300 border border-blue-700 px-2 py-0.5 rounded-full">
                        {tag} <button onClick={() => toggleTag(tag)} className="hover:text-red-400"><X size={9} /></button>
                      </span>
                    ))}
                  </div>
                )}
                {matchingTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {matchingTags.map(tag => (
                      <button key={tag} onClick={() => toggleTag(tag)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${selectedTags.has(tag) ? 'bg-blue-600 text-white border-blue-500' : 'bg-steel-700 text-steel-300 border-steel-600 hover:bg-steel-600'}`}>
                        {selectedTags.has(tag) ? '✓ ' : '+ '}{tag}
                      </button>
                    ))}
                  </div>
                )}
                {tagSearch && matchingTags.length === 0 && (
                  <p className="text-xs text-steel-500 text-center py-2">{lang === 'th' ? 'ไม่พบ tag' : 'No tags found'}</p>
                )}
                {selectedTags.size > 0 && (
                  <p className="text-xs text-steel-400">
                    → {tagFilteredArticles.length} {lang === 'th' ? 'บทความ' : 'articles'}
                    <button onClick={() => setTab('article')} className="ml-2 text-blue-400 hover:text-blue-300">
                      {lang === 'th' ? 'ดูบทความ →' : 'View →'}
                    </button>
                  </p>
                )}
              </div>
            )}

            {tab === 'article' && (
              <div>
                <div className="p-2 space-y-1.5">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steel-400" />
                    <input className="input pl-7 text-xs py-1.5"
                      placeholder={lang === 'th' ? 'ค้นหาชื่อบทความ...' : 'Search title...'}
                      value={articleSearch} onChange={e => setArticleSearch(e.target.value)} />
                  </div>
                  {selectedTags.size > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {[...selectedTags].map(t => (
                        <span key={t} className="text-xs bg-blue-900/30 text-blue-400 border border-blue-800 px-1.5 py-0.5 rounded-full">{t}</span>
                      ))}
                      <button onClick={() => setSelectedTags(new Set())} className="text-xs text-steel-500 hover:text-red-400"><X size={10} /></button>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-steel-500">{tagFilteredArticles.length} {lang === 'th' ? 'บทความ' : 'articles'}</span>
                    <button onClick={toggleAllFiltered} className="text-xs text-blue-400 hover:text-blue-300">
                      {tagFilteredArticles.every(a => selectedArticleIds.includes(a.id)) && tagFilteredArticles.length > 0
                        ? (lang === 'th' ? 'ยกเลิกทั้งหมด' : 'Deselect all')
                        : (lang === 'th' ? 'เลือกทั้งหมด' : 'Select all')}
                    </button>
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {tagFilteredArticles.map(a => (
                    <label key={a.id} className="flex items-start gap-2 px-3 py-2 hover:bg-steel-700 cursor-pointer">
                      <input type="checkbox" checked={selectedArticleIds.includes(a.id)}
                        onChange={() => toggleArticle(a.id)} className="mt-0.5 accent-blue-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-steel-200 leading-snug">{a.title}</p>
                        <p className="text-xs text-steel-500">{a.topic_category}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {selectedArticleIds.length > 0 && (
            <div className="border-t border-steel-700 p-2">
              <button onClick={() => { setContextMode('articles'); setOpen(false) }}
                className="w-full btn-primary text-xs py-1.5">
                {lang === 'th' ? `✓ ใช้ ${selectedArticleIds.length} บทความที่เลือก` : `✓ Use ${selectedArticleIds.length} selected article(s)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── localStorage session helpers ──────────────────────────────────────────
const LS_KEY = 'sys_chat_sessions_v2'

function lsLoadSessions() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
function lsSaveSessions(sessions) {
  localStorage.setItem(LS_KEY, JSON.stringify(sessions.slice(0, 30)))
}
function lsUpsertSession(sid, messages) {
  if (messages.length <= 1) return
  const sessions = lsLoadSessions()
  const preview = messages.find(m => m.role === 'user')?.content?.slice(0, 60) || ''
  const date = new Date().toLocaleString('th-TH')
  const idx = sessions.findIndex(s => s.session_id === sid)
  const entry = { session_id: sid, messages, preview, date, message_count: messages.length }
  if (idx >= 0) sessions[idx] = entry
  else sessions.unshift(entry)
  lsSaveSessions(sessions)
}
function lsDeleteSession(sid) {
  lsSaveSessions(lsLoadSessions().filter(s => s.session_id !== sid))
}

// ── History Sidebar ────────────────────────────────────────────────────────
function HistorySidebar({ lang, currentSessionId, onLoad, onNew, onClose }) {
  const [sessions, setSessions] = useState(lsLoadSessions)

  const handleDelete = (id, e) => {
    e.stopPropagation()
    lsDeleteSession(id)
    setSessions(prev => prev.filter(s => s.session_id !== id))
  }

  return (
    <div className="w-64 border-r border-steel-700 flex flex-col bg-steel-800/50 flex-shrink-0">
      <div className="px-4 py-3 border-b border-steel-700 flex items-center justify-between">
        <span className="text-sm font-semibold">{lang === 'th' ? 'ประวัติการสนทนา' : 'Chat History'}</span>
        <div className="flex gap-1">
          <button onClick={onNew} className="text-steel-400 hover:text-blue-400 p-1" title="New chat">
            <Plus size={15} />
          </button>
          <button onClick={onClose} className="text-steel-400 hover:text-white p-1">
            <X size={15} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.length === 0 ? (
          <p className="text-xs text-steel-500 text-center py-8">{lang === 'th' ? 'ยังไม่มีประวัติ' : 'No history yet'}</p>
        ) : sessions.map(s => (
          <div
            key={s.session_id}
            onClick={() => onLoad(s)}
            className={`group p-2.5 rounded-lg cursor-pointer transition-colors ${
              s.session_id === currentSessionId ? 'bg-blue-600/20 border border-blue-600/40' : 'hover:bg-steel-700'
            }`}
          >
            <p className="text-xs text-steel-200 truncate">{s.preview || s.session_id}</p>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-xs text-steel-500">{s.date || ''}</span>
              <button
                onClick={(e) => handleDelete(s.session_id, e)}
                className="opacity-0 group-hover:opacity-100 text-steel-500 hover:text-red-400 p-0.5"
              >
                <X size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ChatPage ──────────────────────────────────────────────────────────
export default function ChatPage({ lang }) {
  const makeInitMsg = () => ({
    role: 'assistant',
    content: lang === 'th'
      ? 'สวัสดีครับ! ผมคือ AI ผู้ช่วยของ SYS Knowledge Hub ถามเรื่องเทคนิคเกี่ยวกับบทความในคลังได้เลยครับ'
      : "Hello! I'm the SYS Knowledge Hub AI assistant. Ask me anything about the articles in our library.",
  })

  const [messages, setMessages] = useState([makeInitMsg()])
  const [input, setInput] = useState('')
  const [model, setModel] = useState('bedrock-sonnet')
  const [loading, setLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [sessionId, setSessionId] = useState(() => `session_${Date.now()}`)
  const abortRef = useRef(null)  // AbortController for stop

  // Context
  const [articles, setArticles] = useState([])
  const [topics, setTopics] = useState([])
  const [allTags, setAllTags] = useState([])
  const [contextMode, setContextMode] = useState('all') // 'all' | 'category' | 'articles'
  const [selectedArticleIds, setSelectedArticleIds] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')

  // Features
  const [webSearch, setWebSearch] = useState(false)

  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    getArticles().then(r => setArticles(r.data)).catch(() => {})
    getTopics().then(r => setTopics(r.data)).catch(() => {})
    getAllTags().then(r => setAllTags(r.data)).catch(() => {})
  }, [])

  const persistSession = useCallback((msgs, sid) => {
    lsUpsertSession(sid, msgs)
  }, [])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    const newMsgs = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMsgs)
    setLoading(true)

    // Create AbortController for this request
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const payload = {
        message: userMsg,
        model,
        session_id: sessionId,
        web_search: webSearch,
      }
      if (contextMode === 'articles' && selectedArticleIds.length > 0) {
        payload.article_ids = selectedArticleIds
      } else if (contextMode === 'category' && selectedCategory) {
        payload.category = selectedCategory
      }

      const res = await sendMessage(payload, { signal: controller.signal })
      const { answer, sources, web_sources } = res.data
      const finalMsgs = [...newMsgs, { role: 'assistant', content: answer, sources, web_sources }]
      setMessages(finalMsgs)
      await persistSession(finalMsgs, sessionId)
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        // User cancelled — remove the pending user message
        setMessages(newMsgs.slice(0, -1))
        setInput(userMsg)  // restore input
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: lang === 'th' ? 'เกิดข้อผิดพลาด กรุณาตรวจสอบ API key ในไฟล์ .env' : 'Error: Please check your API key in .env file',
        }])
      }
    }
    setLoading(false)
    abortRef.current = null
  }

  const stopGeneration = () => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
  }

  const startNewChat = () => {
    persistSession(messages, sessionId)
    const newId = `session_${Date.now()}`
    setSessionId(newId)
    setMessages([makeInitMsg()])
    setInput('')
  }

  const loadSession = (session) => {
    persistSession(messages, sessionId)
    setMessages(session.messages?.length > 0 ? session.messages : [makeInitMsg()])
    setSessionId(session.session_id)
    setShowHistory(false)
  }

  const contextLabel = contextMode === 'all'
    ? (lang === 'th' ? 'ทุกบทความ' : 'All Articles')
    : contextMode === 'category'
    ? selectedCategory
    : `${selectedArticleIds.length} ${lang === 'th' ? 'บทความ' : 'articles'}`

  return (
    <div className="flex h-full">
      {showHistory && (
        <HistorySidebar
          lang={lang}
          currentSessionId={sessionId}
          onLoad={loadSession}
          onNew={() => { startNewChat(); setShowHistory(false) }}
          onClose={() => setShowHistory(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-steel-700 px-4 py-2.5 flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm">AI Chat</h1>
              <span className="text-xs text-steel-500">·</span>
              <span className="text-xs text-steel-400 truncate">{contextLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Context selector */}
            <ContextSelector
              articles={articles} topics={topics} allTags={allTags}
              contextMode={contextMode} setContextMode={setContextMode}
              selectedArticleIds={selectedArticleIds} setSelectedArticleIds={setSelectedArticleIds}
              selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
              lang={lang}
            />

            {/* Web search toggle */}
            <button
              onClick={() => setWebSearch(w => !w)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                webSearch
                  ? 'bg-green-700/30 border-green-600 text-green-400'
                  : 'bg-steel-700 border-steel-600 text-steel-400 hover:text-white'
              }`}
              title={lang === 'th' ? 'ค้นหาออนไลน์' : 'Web Search'}
            >
              <Globe size={13} />
              <span>{lang === 'th' ? 'เว็บ' : 'Web'}</span>
            </button>

            {/* Model selector */}
            <select className="input w-auto text-xs py-1.5" value={model} onChange={e => setModel(e.target.value)}>
              {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>

            {/* History */}
            <button
              onClick={() => setShowHistory(h => !h)}
              className={`p-1.5 rounded-lg transition-colors ${showHistory ? 'bg-blue-600 text-white' : 'text-steel-400 hover:text-white hover:bg-steel-700'}`}
              title={lang === 'th' ? 'ประวัติ' : 'History'}
            >
              <History size={15} />
            </button>

            {/* New chat */}
            <button onClick={startNewChat} className="p-1.5 text-steel-400 hover:text-blue-400 hover:bg-steel-700 rounded-lg" title="New chat">
              <Plus size={15} />
            </button>

            {/* Clear */}
            <button onClick={startNewChat} className="p-1.5 text-steel-400 hover:text-red-400 hover:bg-steel-700 rounded-lg" title="Clear">
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Context indicator bar */}
        {(contextMode !== 'all' || webSearch) && (
          <div className="px-4 py-1.5 bg-blue-900/20 border-b border-blue-800/30 flex items-center gap-3 text-xs">
            {contextMode !== 'all' && (
              <span className="text-blue-300 flex items-center gap-1">
                <BookOpen size={11} />
                {contextMode === 'category' ? `Category: ${selectedCategory}` : `${selectedArticleIds.length} articles selected`}
              </span>
            )}
            {webSearch && (
              <span className="text-green-400 flex items-center gap-1">
                <Globe size={11} /> {lang === 'th' ? 'เปิดใช้ค้นหาออนไลน์' : 'Web search enabled'}
              </span>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${msg.role === 'assistant' ? '' : 'bg-steel-600'}`}>
                {msg.role === 'assistant'
                  ? <img src="/thoth-icon.png" alt="Thoth" className="w-8 h-8 rounded-full object-cover" />
                  : <User size={16} />}
              </div>
              <div className={`max-w-2xl flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-xl px-4 py-3 text-sm ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-steel-800 text-steel-100 border border-steel-700'
                }`}>
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : msg.content}
                </div>
                {/* Article sources */}
                {msg.sources?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="text-xs text-steel-500">📄</span>
                    {msg.sources.map((s, si) => (
                      <span key={si} className="text-xs bg-steel-700 text-blue-300 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                )}
                {/* Web sources */}
                {msg.web_sources?.filter(s => {
                  if (!s.url?.startsWith('http') || !s.title?.trim()) return false
                  const asciiRatio = [...s.title].filter(c => c.charCodeAt(0) < 128).length / s.title.length
                  return asciiRatio >= 0.5
                }).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="text-xs text-steel-500">🌐</span>
                    {msg.web_sources
                      .filter(s => {
                        if (!s.url?.startsWith('http') || !s.title?.trim()) return false
                        const asciiRatio = [...s.title].filter(c => c.charCodeAt(0) < 128).length / s.title.length
                        return asciiRatio >= 0.5
                      })
                      .slice(0, 5)
                      .map((s, si) => (
                        <a key={si} href={s.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs bg-green-900/30 text-green-400 border border-green-800/40 px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-green-900/50">
                          {s.title?.slice(0, 30) || s.url?.slice(0, 30)}
                          <ExternalLink size={9} />
                        </a>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                <img src="/thoth-icon.png" alt="Thoth" className="w-8 h-8 object-cover" />
              </div>
              <div className="bg-steel-800 border border-steel-700 rounded-xl px-4 py-3 flex items-center gap-3">
                <RefreshCw size={14} className="animate-spin text-steel-400" />
                <span className="text-xs text-steel-400">{lang === 'th' ? 'กำลังคิด...' : 'Thinking...'}</span>
                <button
                  onClick={stopGeneration}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/40 border border-red-800/50 px-2 py-1 rounded-lg transition-colors ml-1"
                  title={lang === 'th' ? 'หยุด' : 'Stop'}
                >
                  <Square size={11} fill="currentColor" />
                  {lang === 'th' ? 'หยุด' : 'Stop'}
                </button>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggested prompts */}
        {messages.length <= 1 && (
          <div className="px-6 pb-2 flex flex-wrap gap-2">
            {[
              lang === 'th' ? 'สรุปบทความเรื่อง hydrogen ให้หน่อย' : 'Summarize the hydrogen decarbonization article',
              lang === 'th' ? 'เปรียบเทียบบทความที่เกี่ยวกับ plant reliability' : 'Compare articles on plant reliability',
              lang === 'th' ? 'สรุปเป็นตาราง: ชื่อบทความ, หมวดหมู่, insights หลัก' : 'Summarize as table: title, category, key insights',
            ].map((prompt, i) => (
              <button key={i} onClick={() => setInput(prompt)}
                className="text-xs bg-steel-800 border border-steel-700 hover:border-blue-500 text-steel-300 px-3 py-1.5 rounded-full transition-colors">
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-steel-700 px-6 py-3">
          <div className="flex gap-3">
            <input
              className="input flex-1"
              placeholder={lang === 'th' ? 'ถามเกี่ยวกับบทความ...' : 'Ask about articles...'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            />
            <button onClick={send} disabled={loading || !input.trim()} className="btn-primary px-4 disabled:opacity-50">
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
