import React, { useState, useEffect, useRef, useMemo } from 'react'
import { LayoutDashboard, Download, RefreshCw, CheckSquare, Square, Globe, Printer, ChevronRight, Search, X } from 'lucide-react'
import { getArticles, generateReport, getAllTags, getTopics } from '../api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import FloatingChat from '../components/FloatingChat'

// McKinsey-style report markdown components
const reportComponents = {
  h1: ({ children }) => (
    <div className="mb-8 pb-4 border-b-2 border-blue-500">
      <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">SYS Knowledge Hub</div>
      <h1 className="text-2xl font-bold text-white leading-tight">{children}</h1>
    </div>
  ),
  h2: ({ children }) => (
    <div className="mt-8 mb-4">
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 bg-blue-500 rounded-full flex-shrink-0" />
        <h2 className="text-lg font-bold text-white">{children}</h2>
      </div>
    </div>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-bold text-blue-300 uppercase tracking-wide mt-5 mb-2">{children}</h3>
  ),
  p: ({ children }) => <p className="text-steel-200 leading-relaxed mb-3 text-sm">{children}</p>,
  strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-steel-300">{children}</em>,
  ul: ({ children }) => <ul className="space-y-1.5 my-3 ml-2">{children}</ul>,
  ol: ({ children }) => <ol className="space-y-1.5 my-3 ml-2 list-decimal list-inside">{children}</ol>,
  li: ({ children }) => (
    <li className="flex items-start gap-2 text-sm text-steel-200">
      <span className="text-blue-400 mt-1 flex-shrink-0">▸</span>
      <span>{children}</span>
    </li>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-4 rounded-lg border border-steel-600">
      <table className="min-w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-blue-900/60">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-steel-700">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-steel-700/30 transition-colors">{children}</tr>,
  th: ({ children }) => <th className="px-4 py-3 text-left text-xs font-bold text-blue-300 uppercase tracking-wide">{children}</th>,
  td: ({ children }) => <td className="px-4 py-3 text-sm text-steel-200">{children}</td>,
  blockquote: ({ children }) => (
    <div className="my-4 bg-blue-900/20 border-l-4 border-blue-500 rounded-r-lg px-4 py-3">
      <div className="text-steel-300 italic text-sm">{children}</div>
    </div>
  ),
  hr: () => <div className="my-6 border-t border-steel-700" />,
  code: ({ inline, children }) => inline
    ? <code className="bg-steel-700 text-amber-300 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
    : <pre className="bg-steel-900 border border-steel-700 rounded-lg p-4 overflow-x-auto my-3 text-xs font-mono text-green-400">{children}</pre>,
}

export default function DashboardPage({ lang }) {
  const [articles, setArticles] = useState([])
  const [selected, setSelected] = useState([])
  const [title, setTitle] = useState('SYS Knowledge Hub — Research Report')
  const [generating, setGenerating] = useState(false)
  const [reportEn, setReportEn] = useState('')
  const [reportTh, setReportTh] = useState('')
  const [reportLang, setReportLang] = useState('en')
  const [error, setError] = useState('')
  const reportRef = useRef(null)

  // Filter state
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterTags, setFilterTags] = useState(new Set()) // multi-tag
  const [allCategories, setAllCategories] = useState([])
  const [allTags, setAllTags] = useState([])

  useEffect(() => {
    getArticles().then(r => setArticles(r.data)).catch(() => {})
    getTopics().then(r => setAllCategories(r.data)).catch(() => {})
    getAllTags().then(r => setAllTags(r.data)).catch(() => {})
  }, [])

  // Filtered articles — OR logic: article must have AT LEAST ONE of the selected tags
  const filteredArticles = useMemo(() => {
    return articles.filter(a => {
      const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase())
      const matchCat = !filterCategory || a.topic_category === filterCategory
      const matchTags = filterTags.size === 0 || [...filterTags].some(t => (a.tags || []).includes(t))
      return matchSearch && matchCat && matchTags
    })
  }, [articles, search, filterCategory, filterTags])

  // Tag autocomplete state
  const [tagInput, setTagInput] = useState('')
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const tagRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (tagRef.current && !tagRef.current.contains(e.target)) setShowTagDropdown(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredTagSuggestions = useMemo(() =>
    tagInput.length >= 1
      ? allTags.filter(t => t.toLowerCase().includes(tagInput.toLowerCase())).slice(0, 20)
      : [],
    [allTags, tagInput]
  )

  const addTag = (tag) => {
    setFilterTags(prev => new Set([...prev, tag]))
    // keep tagInput so user can keep browsing similar tags
  }

  const removeTag = (tag) => {
    setFilterTags(prev => { const s = new Set(prev); s.delete(tag); return s })
  }

  const clearFilters = () => { setSearch(''); setFilterCategory(''); setFilterTags(new Set()); setTagInput('') }
  const toggleAll = () => {
    const visibleIds = filteredArticles.map(a => a.id)
    const allSelected = visibleIds.every(id => selected.includes(id))
    if (allSelected) setSelected(prev => prev.filter(id => !visibleIds.includes(id)))
    else setSelected(prev => [...new Set([...prev, ...visibleIds])])
  }
  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const generate = async () => {
    if (!selected.length) return
    setGenerating(true)
    setReportEn('')
    setReportTh('')
    setError('')
    try {
      // Generate both languages in parallel
      const [resEn, resTh] = await Promise.all([
        generateReport({ article_ids: selected, title, format: 'markdown', language: 'en' }),
        generateReport({ article_ids: selected, title, format: 'markdown', language: 'th' }),
      ])
      setReportEn(resEn.data.markdown)
      setReportTh(resTh.data.markdown)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
    setGenerating(false)
  }

  const currentReport = reportLang === 'th' ? reportTh : reportEn
  const hasReport = reportEn || reportTh

  const downloadReport = () => {
    const blob = new Blob([currentReport], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report_${reportLang}.md`
    a.click()
  }

  const printReport = () => window.print()

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-72 border-r border-steel-700 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-steel-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-sm">{lang === 'th' ? 'เลือกบทความ' : 'Select Articles'}</h2>
            <button onClick={toggleAll} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              {filteredArticles.every(a => selected.includes(a.id)) && filteredArticles.length > 0
                ? <><CheckSquare size={12} /> {lang === 'th' ? 'ยกเลิก' : 'Deselect'}</>
                : <><Square size={12} /> {lang === 'th' ? 'เลือกทั้งหมด' : 'Select all'}</>}
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steel-400" />
            <input
              className="input pl-7 text-xs py-1.5"
              placeholder={lang === 'th' ? 'ค้นหาชื่อบทความ...' : 'Search title...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Category filter */}
          <select
            className="input text-xs py-1.5 mb-2"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="">{lang === 'th' ? 'ทุก Category' : 'All Categories'}</option>
            {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Tag filter — search + button grid */}
          <div ref={tagRef}>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steel-400" />
              <input
                className="input pl-7 text-xs py-1.5"
                placeholder={lang === 'th' ? 'พิมพ์เพื่อค้นหา tag...' : 'Type to search tags...'}
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
              />
              {tagInput && (
                <button onClick={() => setTagInput('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-steel-400 hover:text-white">
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Tag suggestions as buttons — shown while typing */}
            {filteredTagSuggestions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {filteredTagSuggestions.map(tag => {
                  const isSelected = filterTags.has(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => isSelected ? removeTag(tag) : addTag(tag)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-steel-700 text-steel-300 border-steel-600 hover:bg-steel-600 hover:text-white'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}{tag}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Selected tags badges */}
            {filterTags.size > 0 && (
              <div className="mt-1.5">
                <p className="text-xs text-steel-500 mb-1">{lang === 'th' ? 'Tags ที่เลือก (OR):' : 'Selected tags (OR):'}</p>
                <div className="flex flex-wrap gap-1">
                  {[...filterTags].map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-xs bg-blue-900/50 text-blue-300 border border-blue-700 px-2 py-0.5 rounded-full">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-red-400"><X size={9} /></button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Active filters indicator */}
          {(search || filterCategory || filterTags.size > 0) && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-amber-400">
                {filteredArticles.length} / {articles.length} {lang === 'th' ? 'บทความ' : 'articles'}
              </span>
              <button onClick={clearFilters} className="text-xs text-steel-400 hover:text-white flex items-center gap-1">
                <X size={11} /> {lang === 'th' ? 'ล้าง' : 'Clear'}
              </button>
            </div>
          )}
        </div>

        {/* Article list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredArticles.length === 0 ? (
            <p className="text-xs text-steel-500 text-center py-6">{lang === 'th' ? 'ไม่พบบทความ' : 'No articles found'}</p>
          ) : filteredArticles.map(a => (
            <label key={a.id} className="flex items-start gap-2 cursor-pointer group p-1.5 rounded-lg hover:bg-steel-700/50">
              <input
                type="checkbox"
                checked={selected.includes(a.id)}
                onChange={() => toggle(a.id)}
                className="mt-0.5 accent-blue-500 flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs text-steel-200 group-hover:text-white leading-snug">{a.title}</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  <span className="text-xs text-steel-500">{a.topic_category}</span>
                  {filterTags.size > 0 && [...filterTags].filter(t => (a.tags || []).includes(t)).map(t => (
                      <span key={t} className="text-xs bg-blue-900/40 text-blue-300 px-1 rounded">{t}</span>
                    ))}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="p-3 border-t border-steel-700 text-xs text-steel-500">
          {selected.length} {lang === 'th' ? 'บทความที่เลือก' : 'selected'} · {articles.length} {lang === 'th' ? 'ทั้งหมด' : 'total'}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="border-b border-steel-700 px-6 py-3 flex items-center gap-3 flex-wrap bg-steel-800/30">
          <input
            className="input flex-1 min-w-48 text-sm"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Report title..."
          />
          <button
            onClick={generate}
            disabled={!selected.length || generating}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 text-sm"
          >
            {generating ? <RefreshCw size={14} className="animate-spin" /> : <LayoutDashboard size={14} />}
            {lang === 'th' ? 'สร้าง Report' : 'Generate'}
          </button>
          {hasReport && (
            <>
              {/* Language toggle */}
              <div className="flex items-center gap-1 bg-steel-700 rounded-lg p-1">
                <button
                  onClick={() => setReportLang('en')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${reportLang === 'en' ? 'bg-blue-600 text-white' : 'text-steel-400 hover:text-white'}`}
                >
                  🇬🇧 EN
                </button>
                <button
                  onClick={() => setReportLang('th')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${reportLang === 'th' ? 'bg-blue-600 text-white' : 'text-steel-400 hover:text-white'}`}
                >
                  🇹🇭 ไทย
                </button>
              </div>
              <button onClick={downloadReport} className="btn-secondary flex items-center gap-2 text-sm">
                <Download size={14} /> .md
              </button>
              <button onClick={printReport} className="btn-secondary flex items-center gap-2 text-sm">
                <Printer size={14} /> {lang === 'th' ? 'พิมพ์' : 'Print'}
              </button>
            </>
          )}
        </div>

        {/* Report content */}
        <div className="flex-1 overflow-y-auto" ref={reportRef}>
          {error && (
            <div className="m-6 bg-red-900/40 border border-red-700 rounded-xl p-4 text-red-300 text-sm">{error}</div>
          )}
          {generating && (
            <div className="flex flex-col items-center justify-center h-full text-steel-400 gap-3">
              <RefreshCw size={28} className="animate-spin text-blue-400" />
              <p className="text-sm">{lang === 'th' ? 'กำลังสร้าง report ทั้ง 2 ภาษา...' : 'Generating report in both languages...'}</p>
            </div>
          )}
          {hasReport && !generating && (
            <div className="max-w-4xl mx-auto px-8 py-8 print:px-0 print:py-0">
              {/* Report header bar */}
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-steel-700 print:hidden">
                <div className="flex items-center gap-2 text-xs text-steel-400">
                  <Globe size={12} />
                  <span>{reportLang === 'th' ? 'ภาษาไทย' : 'English'}</span>
                  <ChevronRight size={12} />
                  <span>{selected.length} {lang === 'th' ? 'บทความ' : 'articles'}</span>
                </div>
                <div className="text-xs text-steel-500">{new Date().toLocaleDateString('th-TH')}</div>
              </div>

              {/* Actual report */}
              <div className="report-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={reportComponents}>
                  {currentReport}
                </ReactMarkdown>
              </div>

              {/* Footer */}
              <div className="mt-12 pt-4 border-t border-steel-700 flex items-center justify-between text-xs text-steel-500">
                <span>SYS Knowledge Hub · Structural Steel Manufacturing</span>
                <span>{new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            </div>
          )}
          {!hasReport && !generating && !error && (
            <div className="flex flex-col items-center justify-center h-full text-steel-500 gap-3">
              <LayoutDashboard size={48} className="opacity-30" />
              <p className="text-sm">{lang === 'th' ? 'เลือกบทความและกด Generate' : 'Select articles and click Generate'}</p>
              <p className="text-xs text-steel-600">{lang === 'th' ? 'ระบบจะสร้าง report ทั้งภาษาไทยและอังกฤษ' : 'Report will be generated in both Thai and English'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating AI Chat — appears after report is generated */}
      {hasReport && (
        <FloatingChat
          articleIds={selected}
          contextLabel={`${selected.length} articles · ${title}`}
          reportText={currentReport}
          lang={lang}
        />
      )}
    </div>
  )
}

