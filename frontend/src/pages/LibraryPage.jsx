import React, { useState, useEffect, useCallback } from 'react'
import { Search, Grid, List, RefreshCw, X, ExternalLink, Trash2, BookOpen, Pencil, Check } from 'lucide-react'
import { getArticles, getAllTags, getTopics, deleteArticle, getRelated, updateArticle } from '../api'
import FloatingChat from '../components/FloatingChat'

const TOPIC_COLORS = {
  'Safety & Environment': 'bg-red-900 text-red-300 border-red-700',
  'Energy, Control & Digitalization': 'bg-blue-900 text-blue-300 border-blue-700',
  'Plant Services & Reliability': 'bg-amber-900 text-amber-300 border-amber-700',
  'Material Movement & Transportation': 'bg-purple-900 text-purple-300 border-purple-700',
  'Steel Making': 'bg-slate-700 text-slate-300 border-slate-600',
  'Iron Making': 'bg-gray-700 text-gray-300 border-gray-600',
  'Rolling & Processing': 'bg-sky-900 text-sky-300 border-sky-700',
  'General': 'bg-emerald-900 text-emerald-300 border-emerald-700',
}

function ArticleDetail({ article, lang, onClose, onDelete, onUpdate }) {
  const [related, setRelated] = useState([])
  const [summaryLang, setSummaryLang] = useState(lang)
  const [editingCategory, setEditingCategory] = useState(false)
  const [allTopics, setAllTopics] = useState([])
  const [newCategory, setNewCategory] = useState(article.topic_category)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getRelated(article.id).then(r => setRelated(r.data)).catch(() => {})
    getTopics().then(r => setAllTopics(r.data)).catch(() => {})
  }, [article.id])

  const handleDelete = async () => {
    if (!confirm(`Delete "${article.title}"? This cannot be undone.`)) return
    await deleteArticle(article.id)
    onDelete(article.id)
    onClose()
  }

  const saveCategory = async () => {
    if (newCategory === article.topic_category) { setEditingCategory(false); return }
    setSaving(true)
    try {
      await updateArticle(article.id, { topic_category: newCategory })
      onUpdate(article.id, { topic_category: newCategory })
      setEditingCategory(false)
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-end z-50" onClick={onClose}>
      <div
        className="w-full max-w-2xl h-full bg-steel-800 border-l border-steel-700 overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-steel-800 border-b border-steel-700 px-6 py-4 flex items-start justify-between">
          <div className="flex-1 pr-4">
            {/* Category with edit */}
            {editingCategory ? (
              <div className="flex items-center gap-2">
                <select
                  className="input text-xs py-1 flex-1"
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  autoFocus
                >
                  {allTopics.map(t => <option key={t}>{t}</option>)}
                </select>
                <button
                  onClick={saveCategory}
                  disabled={saving}
                  className="text-green-400 hover:text-green-300 p-1"
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                </button>
                <button onClick={() => { setEditingCategory(false); setNewCategory(article.topic_category) }}
                  className="text-steel-400 hover:text-white p-1">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${TOPIC_COLORS[article.topic_category] || TOPIC_COLORS['General']}`}>
                  {article.topic_category}
                </span>
                <button
                  onClick={() => setEditingCategory(true)}
                  className="text-steel-500 hover:text-blue-400 transition-colors"
                  title={lang === 'th' ? 'เปลี่ยน category' : 'Change category'}
                >
                  <Pencil size={12} />
                </button>
              </div>
            )}
            <h2 className="mt-2 text-lg font-bold text-white leading-tight">{article.title}</h2>
            <p className="text-xs text-steel-400 mt-1">{article.publication_date}</p>
          </div>
          <button onClick={onClose} className="text-steel-400 hover:text-white mt-1">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Summary */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-steel-300 uppercase tracking-wide">Summary</h3>
              <div className="flex gap-1">
                {['th', 'en'].map(l => (
                  <button
                    key={l}
                    onClick={() => setSummaryLang(l)}
                    className={`text-xs px-2 py-0.5 rounded ${summaryLang === l ? 'bg-blue-600 text-white' : 'text-steel-400 hover:text-white'}`}
                  >
                    {l === 'th' ? '🇹🇭 ไทย' : '🇬🇧 EN'}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-steel-200 text-sm leading-relaxed whitespace-pre-line">
              {summaryLang === 'th' ? article.summary_th : article.summary_en}
            </p>
          </div>

          {/* Key Insights */}
          {article.key_insights?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-steel-300 uppercase tracking-wide mb-2">Key Insights</h3>
              <ul className="space-y-2">
                {article.key_insights.map((insight, i) => (
                  <li key={i} className="flex gap-2 text-sm text-steel-200">
                    <span className="text-blue-400 mt-0.5 flex-shrink-0">▸</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tags */}
          {article.tags?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-steel-300 uppercase tracking-wide mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {article.tags.map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Related */}
          {related.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-steel-300 uppercase tracking-wide mb-2">Related Articles</h3>
              <div className="space-y-2">
                {related.map(r => (
                  <div key={r.id} className="bg-steel-700 rounded-lg px-3 py-2">
                    <p className="text-sm text-steel-100">{r.title}</p>
                    <p className="text-xs text-steel-400 mt-0.5">
                      {r.topic_category} · Similarity: {(r.weight * 100).toFixed(0)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {article.pdf_path && (
              <a
                href={article.pdf_path}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <ExternalLink size={15} />
                Open PDF
              </a>
            )}
            <button onClick={handleDelete} className="btn-danger flex items-center gap-2 text-sm ml-auto">
              <Trash2 size={15} />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LibraryPage({ lang }) {
  const [articles, setArticles] = useState([])
  const [tags, setTags] = useState([])
  const [topics, setTopics] = useState([])
  const [search, setSearch] = useState('')
  const [selectedTopic, setSelectedTopic] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [viewMode, setViewMode] = useState('grid')
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (selectedTopic) params.topic = selectedTopic
      if (selectedTag) params.tag = selectedTag
      const [artRes, tagRes, topicRes] = await Promise.all([
        getArticles(params),
        getAllTags(),
        getTopics(),
      ])
      setArticles(artRes.data)
      setTags(tagRes.data)
      setTopics(topicRes.data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [search, selectedTopic, selectedTag])

  useEffect(() => { load() }, [load])

  const handleDelete = (id) => {
    setArticles(prev => prev.filter(a => a.id !== id))
  }

  const handleUpdate = (id, changes) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, ...changes } : a))
    setSelectedArticle(prev => prev?.id === id ? { ...prev, ...changes } : prev)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-steel-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">{lang === 'th' ? 'คลังบทความ' : 'Article Library'}</h1>
            <p className="text-sm text-steel-400">{articles.length} {lang === 'th' ? 'บทความ' : 'articles'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-600' : 'text-steel-400 hover:text-white'}`}>
              <Grid size={16} />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-600' : 'text-steel-400 hover:text-white'}`}>
              <List size={16} />
            </button>
            <button onClick={load} className="p-2 text-steel-400 hover:text-white">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-400" />
            <input
              className="input pl-9"
              placeholder={lang === 'th' ? 'ค้นหาบทความ...' : 'Search articles...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input w-auto" value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)}>
            <option value="">{lang === 'th' ? 'ทุก Topic' : 'All Topics'}</option>
            {topics.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="input w-auto" value={selectedTag} onChange={e => setSelectedTag(e.target.value)}>
            <option value="">{lang === 'th' ? 'ทุก Tag' : 'All Tags'}</option>
            {tags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {(selectedTopic || selectedTag || search) && (
            <button onClick={() => { setSearch(''); setSelectedTopic(''); setSelectedTag('') }}
              className="flex items-center gap-1 text-sm text-steel-400 hover:text-white px-2">
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-steel-400">
            <RefreshCw size={24} className="animate-spin mr-3" /> Loading...
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center text-steel-400 py-20">
            <BookOpen size={48} className="mx-auto mb-4 opacity-40" />
            <p>{lang === 'th' ? 'ไม่พบบทความ' : 'No articles found'}</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {articles.map(article => (
              <div
                key={article.id}
                className="card cursor-pointer hover:border-blue-600 transition-colors"
                onClick={() => setSelectedArticle(article)}
              >
                <span className={`text-xs px-2 py-0.5 rounded-full border ${TOPIC_COLORS[article.topic_category] || TOPIC_COLORS['General']}`}>
                  {article.topic_category}
                </span>
                <h3 className="mt-2 font-semibold text-sm text-white leading-snug line-clamp-2">{article.title}</h3>
                <p className="mt-2 text-xs text-steel-200 line-clamp-3">
                  {lang === 'th' ? article.summary_th : article.summary_en}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {(article.tags || []).slice(0, 4).map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-steel-500">{article.publication_date}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {articles.map(article => (
              <div
                key={article.id}
                className="card cursor-pointer hover:border-blue-600 transition-colors flex items-center gap-4"
                onClick={() => setSelectedArticle(article)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${TOPIC_COLORS[article.topic_category] || TOPIC_COLORS['General']}`}>
                      {article.topic_category}
                    </span>
                    <span className="text-xs text-steel-500">{article.publication_date}</span>
                  </div>
                  <h3 className="font-semibold text-sm text-white truncate">{article.title}</h3>
                </div>
                <div className="flex flex-wrap gap-1 flex-shrink-0 max-w-xs">
                  {(article.tags || []).slice(0, 3).map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedArticle && (
        <ArticleDetail
          article={selectedArticle}
          lang={lang}
          onClose={() => setSelectedArticle(null)}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />
      )}

      {/* Floating AI Chat — context = currently viewed article */}
      <FloatingChat
        articleIds={selectedArticle ? [selectedArticle.id] : []}
        contextLabel={selectedArticle ? selectedArticle.title : ''}
        lang={lang}
      />
    </div>
  )
}
