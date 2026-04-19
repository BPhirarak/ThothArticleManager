/**
 * FloatingChat — context-aware AI assistant bubble
 *
 * Props:
 *   articleIds   : number[]   — article IDs to use as context (optional)
 *   contextLabel : string     — shown in header e.g. "3 articles selected"
 *   reportText   : string     — raw report markdown to inject as context (optional)
 *   lang         : 'th'|'en'
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, RefreshCw, Globe, StopCircle, Maximize2, Minimize2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { sendMessage } from '../api'

const BOT_AVATAR = '/thoth-icon.png'

const mdComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0 text-sm leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5 text-sm">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5 text-sm">{children}</ol>,
  li: ({ children }) => <li className="text-sm">{children}</li>,
  strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
  code: ({ inline, children }) => inline
    ? <code className="bg-steel-700 text-amber-300 px-1 rounded text-xs font-mono">{children}</code>
    : <pre className="bg-steel-900 rounded p-2 text-xs font-mono text-green-400 overflow-x-auto my-1">{children}</pre>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-blue-400 underline hover:text-blue-300">{children}</a>
  ),
}

// Default / maximized sizes
const DEFAULT_SIZE = { w: 400, h: 600 }
const MAX_SIZE = { w: Math.min(window.innerWidth - 48, 900), h: window.innerHeight - 48 }

export default function FloatingChat({ articleIds = [], contextLabel = '', reportText = '', lang = 'en' }) {
  const [open, setOpen] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [size, setSize] = useState(DEFAULT_SIZE)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [webSearch, setWebSearch] = useState(false)
  const abortRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const sessionId = useRef(`float_${Date.now()}`)
  const resizeRef = useRef(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Initial greeting when first opened
  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting = lang === 'th'
        ? `สวัสดีครับ! ผมคือ Thoth AI Assistant 🤖\nมีคำถามเกี่ยวกับ${contextLabel ? `"${contextLabel}"` : 'บทความ'}นี้ไหมครับ?`
        : `Hi! I'm Thoth AI Assistant 🤖\nAsk me anything about ${contextLabel ? `"${contextLabel}"` : 'this content'}.`
      setMessages([{ role: 'assistant', content: greeting, isGreeting: true }])
    }
  }, [open])

  // Resize drag handler (top-left corner)
  const startResize = useCallback((e) => {
    if (maximized) return
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const startW = size.w
    const startH = size.h

    const onMove = (ev) => {
      const newW = Math.max(320, Math.min(window.innerWidth - 48, startW - (ev.clientX - startX)))
      const newH = Math.max(400, Math.min(window.innerHeight - 48, startH - (ev.clientY - startY)))
      setSize({ w: newW, h: newH })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [size, maximized])

  const toggleMaximize = () => {
    setMaximized(m => !m)
  }

  const currentSize = maximized
    ? { w: window.innerWidth - 48, h: window.innerHeight - 48 }
    : size

  const stop = () => {
    abortRef.current?.abort()
    setLoading(false)
  }

  const send = useCallback(async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    const userMsg = { role: 'user', content: q }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      // Build payload — inject report text as extra context if available
      const payload = {
        message: q,
        model: 'bedrock',
        session_id: sessionId.current,
        web_search: webSearch,
        article_ids: articleIds.length > 0 ? articleIds : undefined,
      }

      // If we have report text, prepend it to the message as context
      if (reportText) {
        payload.message = `[Context — Research Report]\n${reportText.slice(0, 6000)}\n\n---\nUser question: ${q}`
      }

      const res = await sendMessage(payload, { signal: controller.signal })
      const data = res.data

      const webSources = data.web_sources?.filter(s => s.url) || []
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        sources: data.sources || [],
        webSources,
      }])
    } catch (e) {
      if (e.name !== 'CanceledError' && e.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: lang === 'th' ? '❌ เกิดข้อผิดพลาด กรุณาลองใหม่' : '❌ Error — please try again.' }])
      }
    }
    setLoading(false)
  }, [input, loading, articleIds, reportText, webSearch, lang])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      {/* Floating bubble button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 shadow-xl flex items-center justify-center transition-all hover:scale-110 group"
          title={lang === 'th' ? 'ถามเกี่ยวกับบทความนี้' : 'Ask about this content'}
        >
          <img src={BOT_AVATAR} alt="AI" className="w-8 h-8 rounded-full object-cover" onError={e => { e.target.style.display='none' }} />
          <MessageCircle size={24} className="text-white absolute opacity-0 group-hover:opacity-100 transition-opacity" />
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-20" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed z-50 flex flex-col rounded-2xl shadow-2xl border border-steel-600 bg-steel-800 overflow-hidden"
          style={{
            bottom: maximized ? '24px' : '24px',
            right: maximized ? '24px' : '24px',
            width: currentSize.w,
            height: currentSize.h,
            transition: maximized ? 'all 0.2s ease' : 'none',
          }}
        >
          {/* Resize handle — top-left corner (only when not maximized) */}
          {!maximized && (
            <div
              onMouseDown={startResize}
              className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10 group"
              title="Drag to resize"
            >
              <div className="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 border-steel-500 group-hover:border-blue-400 rounded-tl transition-colors" />
            </div>
          )}
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-900/80 to-steel-800 border-b border-steel-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <img src={BOT_AVATAR} alt="Thoth" className="w-7 h-7 rounded-full object-cover" onError={e => { e.target.style.display='none' }} />
              <div>
                <p className="text-sm font-semibold text-white">Thoth AI</p>
                {contextLabel && (
                  <p className="text-xs text-blue-300 truncate max-w-52">{contextLabel}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Web search toggle */}
              <button
                onClick={() => setWebSearch(v => !v)}
                title={lang === 'th' ? 'ค้นหาออนไลน์' : 'Online search'}
                className={`p-1.5 rounded-lg transition-colors ${webSearch ? 'bg-green-600 text-white' : 'text-steel-400 hover:text-white'}`}
              >
                <Globe size={14} />
              </button>
              {/* Maximize/restore */}
              <button
                onClick={toggleMaximize}
                title={maximized ? 'Restore' : 'Maximize'}
                className="text-steel-400 hover:text-white p-1"
              >
                {maximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button onClick={() => setOpen(false)} className="text-steel-400 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'assistant' && (
                  <img src={BOT_AVATAR} alt="AI" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5"
                    onError={e => { e.target.style.display='none' }} />
                )}
                <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-steel-700 text-steel-100 rounded-tl-sm'
                }`}>
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                  {/* Web sources — only show if URL is real and title is meaningful */}
                  {msg.webSources?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-steel-600 space-y-1">
                      <p className="text-xs text-steel-400 mb-1">🌐 Sources:</p>
                      {msg.webSources
                        .filter(s => {
                          if (!s.url?.startsWith('http') || !s.title?.trim()) return false
                          // Skip mostly non-ASCII titles (Thai spam from DuckDuckGo)
                          const asciiRatio = [...s.title].filter(c => c.charCodeAt(0) < 128).length / s.title.length
                          return asciiRatio >= 0.5
                        })
                        .slice(0, 4)
                        .map((s, j) => (
                          <a key={j} href={s.url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 truncate">
                            <Globe size={9} className="flex-shrink-0" />
                            <span className="truncate">{s.title}</span>
                          </a>
                        ))}
                    </div>
                  )}
                  {/* Article sources */}
                  {msg.sources?.length > 0 && (
                    <p className="mt-1.5 text-xs text-steel-400 truncate">
                      📄 {msg.sources.slice(0, 2).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <img src={BOT_AVATAR} alt="AI" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5"
                  onError={e => { e.target.style.display='none' }} />
                <div className="bg-steel-700 rounded-2xl rounded-tl-sm px-3 py-2">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-steel-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-steel-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-steel-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-steel-700 p-3">
            {webSearch && (
              <div className="flex items-center gap-1 text-xs text-green-400 mb-2">
                <Globe size={10} /> {lang === 'th' ? 'เปิดใช้งานค้นหาออนไลน์' : 'Online search enabled'}
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                className="flex-1 bg-steel-700 border border-steel-600 rounded-xl px-3 py-2 text-sm text-white placeholder-steel-400 focus:outline-none focus:border-blue-500 resize-none"
                placeholder={lang === 'th' ? 'ถามเกี่ยวกับบทความนี้...' : 'Ask about this content...'}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
              />
              {loading ? (
                <button onClick={stop} className="p-2 rounded-xl bg-red-600 hover:bg-red-500 text-white flex-shrink-0">
                  <StopCircle size={18} />
                </button>
              ) : (
                <button
                  onClick={send}
                  disabled={!input.trim()}
                  className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex-shrink-0 disabled:opacity-40"
                >
                  <Send size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
