import React, { useState, useCallback, useEffect } from 'react'
import { Upload, Bot, CheckCircle, XCircle, RefreshCw, FileText, Plus, X, Download, Database, Trash2, Search, Globe, BookOpen, ExternalLink } from 'lucide-react'
import { uploadArticle, startAistSearch, getAgentStatus, downloadAndImport, getTopics, startResearchSearch, startResearchDownload } from '../api'

const DEFAULT_TOPICS = [
  'Safety & Environment',
  'Energy, Control & Digitalization',
  'Plant Services & Reliability',
  'Material Movement & Transportation',
  'Iron Making',
  'Steel Making',
  'Rolling & Processing',
  'General',
]

const CUSTOM_TOPICS_KEY = 'sys_custom_topics'
function loadCustomTopics() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_TOPICS_KEY) || '[]') } catch { return [] }
}

// Hook to fetch topics from API (always up-to-date)
function useTopics() {
  const [topics, setTopics] = useState([...DEFAULT_TOPICS, ...loadCustomTopics()])
  useEffect(() => {
    getTopics().then(r => { if (r.data?.length) setTopics(r.data) }).catch(() => {})
  }, [])
  return topics
}

function UploadTab({ lang, auth }) {
  const allTopics = useTopics()
  // Multi-file state: array of { file, topic, pubDate, visibility, status, result }
  const [fileRows, setFileRows] = useState([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [globalVisibility, setGlobalVisibility] = useState('public')

  const addFiles = (newFiles) => {
    const pdfs = Array.from(newFiles).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    setFileRows(prev => [
      ...prev,
      ...pdfs.map(f => ({
        id: `${f.name}_${Date.now()}_${Math.random()}`,
        file: f,
        topic: 'General',
        pubDate: '',
        visibility: 'public',
        status: 'pending', // pending | uploading | done | error
        result: null,
      }))
    ])
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [])

  const removeRow = (id) => setFileRows(prev => prev.filter(r => r.id !== id))

  const updateRow = (id, changes) => setFileRows(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r))

  const handleUploadAll = async () => {
    const pending = fileRows.filter(r => r.status === 'pending')
    if (!pending.length) return
    setUploading(true)

    for (const row of pending) {
      updateRow(row.id, { status: 'uploading' })
      const fd = new FormData()
      fd.append('file', row.file)
      fd.append('topic_category', row.topic)
      fd.append('publication_date', row.pubDate)
      fd.append('visibility', row.visibility)
      try {
        const res = await uploadArticle(fd)
        updateRow(row.id, { status: 'done', result: res.data })
      } catch (e) {
        updateRow(row.id, { status: 'error', result: { error: e.response?.data?.detail || e.message } })
      }
    }
    setUploading(false)
  }

  const pendingCount = fileRows.filter(r => r.status === 'pending').length
  const doneCount = fileRows.filter(r => r.status === 'done').length

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
          dragging ? 'border-blue-500 bg-blue-500/10' : 'border-steel-600 hover:border-steel-500'
        }`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('multi-file-input').click()}
      >
        <Upload size={36} className="mx-auto text-steel-500 mb-2" />
        <p className="text-steel-300 font-medium">{lang === 'th' ? 'ลาก PDF มาวางที่นี่ หรือคลิกเพื่อเลือก' : 'Drop PDFs here or click to browse'}</p>
        <p className="text-steel-500 text-xs mt-1">{lang === 'th' ? 'รองรับหลายไฟล์พร้อมกัน' : 'Multiple files supported'}</p>
        <input
          id="multi-file-input"
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {/* File table */}
      {fileRows.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-steel-700 flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              {lang === 'th' ? `ไฟล์ที่เลือก (${fileRows.length})` : `Selected Files (${fileRows.length})`}
              {doneCount > 0 && <span className="ml-2 text-xs text-green-400">✓ {doneCount} {lang === 'th' ? 'เสร็จแล้ว' : 'done'}</span>}
            </h3>
            <button onClick={() => setFileRows([])} className="text-xs text-steel-500 hover:text-red-400">
              {lang === 'th' ? 'ล้างทั้งหมด' : 'Clear all'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-steel-700/50 border-b border-steel-700">
                <tr>
                  <th className="px-3 py-2 text-left text-xs text-steel-400">{lang === 'th' ? 'ไฟล์' : 'File'}</th>
                  <th className="px-3 py-2 text-left text-xs text-steel-400">Category</th>
                  <th className="px-3 py-2 text-left text-xs text-steel-400">{lang === 'th' ? 'วันที่' : 'Date'}</th>
                  <th className="px-3 py-2 text-left text-xs text-steel-400">Visibility</th>
                  <th className="px-3 py-2 text-xs text-steel-400">Status</th>
                  <th className="px-3 py-2 text-xs text-steel-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-700/50">
                {fileRows.map(row => (
                  <tr key={row.id} className={row.status === 'done' ? 'bg-green-900/10' : row.status === 'error' ? 'bg-red-900/10' : ''}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-blue-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-white truncate max-w-48">{row.file.name}</p>
                          <p className="text-xs text-steel-500">{(row.file.size / 1024 / 1024).toFixed(1)} MB</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="input text-xs py-1 w-44"
                        value={row.topic}
                        onChange={e => updateRow(row.id, { topic: e.target.value })}
                        disabled={row.status !== 'pending'}
                      >
                        {allTopics.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="month"
                        className="input text-xs py-1 w-36"
                        value={row.pubDate}
                        onChange={e => updateRow(row.id, { pubDate: e.target.value })}
                        disabled={row.status !== 'pending'}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="input text-xs py-1 w-28"
                        value={row.visibility}
                        onChange={e => updateRow(row.id, { visibility: e.target.value })}
                        disabled={row.status !== 'pending'}
                      >
                        <option value="public">🌐 Public</option>
                        <option value="private">🔒 Private</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.status === 'pending' && <span className="text-xs text-steel-400">—</span>}
                      {row.status === 'uploading' && <RefreshCw size={14} className="animate-spin text-blue-400 mx-auto" />}
                      {row.status === 'done' && (
                        <div>
                          <CheckCircle size={14} className="text-green-400 mx-auto" />
                          {row.result?.title && <p className="text-xs text-green-400 mt-0.5 max-w-32 truncate">{row.result.title}</p>}
                        </div>
                      )}
                      {row.status === 'error' && (
                        <div title={row.result?.error}>
                          <XCircle size={14} className="text-red-400 mx-auto" />
                          <p className="text-xs text-red-400 mt-0.5 max-w-32 truncate">{row.result?.error}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.status === 'pending' && (
                        <button onClick={() => removeRow(row.id)} className="text-steel-500 hover:text-red-400 p-1">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Upload button */}
          {pendingCount > 0 && (
            <div className="px-4 py-3 border-t border-steel-700">
              <button
                onClick={handleUploadAll}
                disabled={uploading}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {uploading ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploading
                  ? (lang === 'th' ? 'กำลัง upload...' : 'Uploading...')
                  : (lang === 'th' ? `Upload ${pendingCount} ไฟล์` : `Upload ${pendingCount} file(s)`)}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AgentTab({ lang }) {
  const TOPICS = useTopics()
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState('')
  const [selectedTopics, setSelectedTopics] = useState([])
  const [running, setRunning] = useState(false)
  const [scanTaskId, setScanTaskId] = useState(null)
  const [progress, setProgress] = useState([])
  const [foundArticles, setFoundArticles] = useState([])
  const [status, setStatus] = useState('')
  // Download phase
  const [selectedForDownload, setSelectedForDownload] = useState([])
  const [articleCategories, setArticleCategories] = useState({}) // { article_id: category }
  const [downloading, setDownloading] = useState(false)
  const [dlProgress, setDlProgress] = useState([])
  const [dlStatus, setDlStatus] = useState('')
  const [importedArticles, setImportedArticles] = useState([])

  const toggleTopic = (t) => setSelectedTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  const toggleDownload = (id) => {
    setSelectedForDownload(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      // Set default category when selecting
      if (!prev.includes(id) && !articleCategories[id]) {
        setArticleCategories(c => ({ ...c, [id]: 'General' }))
      }
      return next
    })
  }
  const toggleAllDownload = () => {
    const available = foundArticles.filter(a => !a.in_db).map(a => a.article_id)
    if (selectedForDownload.length === available.length) {
      setSelectedForDownload([])
    } else {
      setSelectedForDownload(available)
      // Set default category for all
      const defaults = {}
      available.forEach(id => { if (!articleCategories[id]) defaults[id] = 'General' })
      setArticleCategories(c => ({ ...c, ...defaults }))
    }
  }

  const startAgent = async () => {
    setRunning(true)
    setProgress([])
    setFoundArticles([])
    setSelectedForDownload([])
    setImportedArticles([])
    setDlProgress([])
    setStatus('running')
    try {
      const res = await startAistSearch({ year: parseInt(year), month: month ? parseInt(month) : null, topics: selectedTopics })
      const tid = res.data.task_id
      setScanTaskId(tid)
      let pollCount = 0
      const MAX_POLLS = 300 // 10 minutes max (2s interval)
      const poll = setInterval(async () => {
        if (++pollCount > MAX_POLLS) {
          clearInterval(poll); setStatus('error'); setRunning(false)
          setProgress(prev => [...prev, '❌ Timeout'])
          return
        }
        try {
          const { data } = await getAgentStatus(tid)
          setProgress(data.progress || [])
          if (data.status === 'done') {
            setFoundArticles(data.articles || [])
            setStatus('done'); setRunning(false); clearInterval(poll)
          } else if (data.status === 'error') {
            setStatus('error'); setRunning(false); clearInterval(poll)
            if (data.error) setProgress(prev => [...prev, `❌ ${data.error}`])
          }
        } catch { clearInterval(poll); setRunning(false) }
      }, 2000)
    } catch { setStatus('error'); setRunning(false) }
  }

  const startDownload = async () => {
    if (!selectedForDownload.length || !scanTaskId) return
    setDownloading(true)
    setDlProgress([])
    setDlStatus('running')
    setImportedArticles([])
    try {
      const pubDate = month ? `${year}-${String(month).padStart(2, '0')}` : `${year}`
      const res = await downloadAndImport({
        task_id: scanTaskId,
        article_ids: selectedForDownload,
        topic_categories: articleCategories,
        publication_date: pubDate,
      })
      const tid = res.data.task_id
      let pollCount = 0
      const poll = setInterval(async () => {
        if (++pollCount > 150) { // 5 min
          clearInterval(poll); setDlStatus('error'); setDownloading(false)
          return
        }
        try {
          const { data } = await getAgentStatus(tid)
          setDlProgress(data.progress || [])
          if (data.status === 'done') {
            setImportedArticles(data.imported || [])
            setDlStatus('done'); setDownloading(false); clearInterval(poll)
            // Mark imported articles in foundArticles
            const importedIds = new Set((data.imported || []).map(a => a.article_id))
            setFoundArticles(prev => prev.map(a => importedIds.has(a.article_id) ? { ...a, in_db: true, status: 'imported' } : a))
            setSelectedForDownload([])
          } else if (data.status === 'error') {
            setDlStatus('error'); setDownloading(false); clearInterval(poll)
          }
        } catch { clearInterval(poll); setDownloading(false) }
      }, 2000)
    } catch { setDlStatus('error'); setDownloading(false) }
  }

  const newArticles = foundArticles.filter(a => !a.in_db)
  const alreadyInDb = foundArticles.filter(a => a.in_db)

  return (
    <div className="space-y-4">
      {/* Config card */}
      <div className="card">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Bot size={18} className="text-blue-400" />
          {lang === 'th' ? 'ตั้งค่าการค้นหา AIST' : 'AIST Search Configuration'}
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm text-steel-400 mb-1">{lang === 'th' ? 'ปี' : 'Year'}</label>
            <input type="number" className="input" value={year} onChange={e => setYear(e.target.value)} min="2020" max="2030" />
          </div>
          <div>
            <label className="block text-sm text-steel-400 mb-1">{lang === 'th' ? 'เดือน (ถ้าต้องการ)' : 'Month (optional)'}</label>
            <select className="input" value={month} onChange={e => setMonth(e.target.value)}>
              <option value="">{lang === 'th' ? 'ทุกเดือน' : 'All months'}</option>
              {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
        <label className="block text-sm text-steel-400 mb-2">{lang === 'th' ? 'เลือก Topics' : 'Select Topics'}</label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {TOPICS.slice(0, 6).map(t => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selectedTopics.includes(t)} onChange={() => toggleTopic(t)} className="accent-blue-500" />
              <span className="text-sm text-steel-200">{t}</span>
            </label>
          ))}
        </div>
        <button onClick={startAgent} disabled={running || selectedTopics.length === 0}
          className="btn-primary flex items-center gap-2 disabled:opacity-50">
          {running ? <RefreshCw size={16} className="animate-spin" /> : <Bot size={16} />}
          {running ? (lang === 'th' ? 'กำลังค้นหา...' : 'Scanning...') : (lang === 'th' ? 'เริ่ม AIST Agent' : 'Start AIST Agent')}
        </button>
        {!month && (
          <p className="text-xs text-amber-400 mt-2">
            ⚠️ {lang === 'th' ? 'ไม่ระบุเดือน: จะค้นหาทั้งปี อาจใช้เวลา 5-10 นาที แนะนำให้ระบุเดือนเพื่อความเร็ว' : 'No month selected: scanning full year may take 5-10 min. Specify a month for faster results.'}
          </p>
        )}
      </div>

      {/* Scan progress */}
      {progress.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">{lang === 'th' ? 'ความคืบหน้าการค้นหา' : 'Scan Progress'}</h3>
            {status === 'done' && <span className="text-xs text-green-400">✓ {lang === 'th' ? 'เสร็จสิ้น' : 'Complete'}</span>}
            {status === 'error' && <span className="text-xs text-red-400">❌ Error</span>}
          </div>
          <div className="bg-steel-900 rounded-lg p-3 max-h-40 overflow-y-auto font-mono text-xs space-y-0.5">
            {progress.map((p, i) => (
              <div key={i} className={p.startsWith('❌') ? 'text-red-400' : p.startsWith('✓') ? 'text-green-400' : 'text-green-300'}>
                {p.startsWith('❌') || p.startsWith('✓') ? p : `▸ ${p}`}
              </div>
            ))}
            {running && <div className="animate-pulse text-green-400">▸ _</div>}
          </div>
        </div>
      )}

      {/* Found articles — select to download */}
      {foundArticles.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">
              {lang === 'th' ? `พบ ${foundArticles.length} บทความ` : `Found ${foundArticles.length} articles`}
              {newArticles.length > 0 && (
                <span className="ml-2 text-xs text-blue-400">({newArticles.length} {lang === 'th' ? 'ใหม่' : 'new'})</span>
              )}
            </h3>
            {newArticles.length > 0 && (
              <button onClick={toggleAllDownload} className="text-xs text-blue-400 hover:text-blue-300">
                {selectedForDownload.length === newArticles.length
                  ? (lang === 'th' ? 'ยกเลิกทั้งหมด' : 'Deselect all')
                  : (lang === 'th' ? 'เลือกทั้งหมด' : 'Select all new')}
              </button>
            )}
          </div>

          <div className="space-y-2 mb-4">
            {foundArticles.map((a, i) => (
              <div key={i} className={`rounded-lg transition-colors ${
                a.in_db ? 'bg-steel-700/30 opacity-60' : 'bg-steel-700/50'
              }`}>
                <label className="flex items-start gap-3 p-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={a.in_db}
                    checked={selectedForDownload.includes(a.article_id)}
                    onChange={() => toggleDownload(a.article_id)}
                    className="mt-0.5 accent-blue-500 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white leading-snug">{a.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-steel-500 font-mono">{a.article_id}</span>
                      {a.in_db && (
                        <span className="text-xs text-green-500 flex items-center gap-1">
                          <Database size={10} /> {lang === 'th' ? 'มีในฐานข้อมูลแล้ว' : 'Already in DB'}
                        </span>
                      )}
                      {a.status === 'imported' && (
                        <span className="text-xs text-blue-400 flex items-center gap-1">
                          <CheckCircle size={10} /> {lang === 'th' ? 'นำเข้าแล้ว' : 'Imported'}
                        </span>
                      )}
                    </div>
                  </div>
                </label>
                {/* Per-article category selector — shown only when checked */}
                {selectedForDownload.includes(a.article_id) && (
                  <div className="px-3 pb-2.5 flex items-center gap-2">
                    <span className="text-xs text-steel-400 flex-shrink-0">Category:</span>
                    <select
                      className="input text-xs py-1 flex-1"
                      value={articleCategories[a.article_id] || 'General'}
                      onChange={e => setArticleCategories(c => ({ ...c, [a.article_id]: e.target.value }))}
                    >
                      {TOPICS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Download button */}
          {selectedForDownload.length > 0 && (
            <div className="border-t border-steel-700 pt-3">
              <button
                onClick={startDownload}
                disabled={downloading}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {downloading ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                {downloading
                  ? (lang === 'th' ? 'กำลัง download และ import...' : 'Downloading & importing...')
                  : (lang === 'th' ? `Download & Import ${selectedForDownload.length} บทความ` : `Download & Import ${selectedForDownload.length} article(s)`)}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Download progress */}
      {dlProgress.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">{lang === 'th' ? 'ความคืบหน้าการ Import' : 'Import Progress'}</h3>
            {dlStatus === 'done' && <span className="text-xs text-green-400">✓ {lang === 'th' ? 'เสร็จสิ้น' : 'Complete'}</span>}
            {dlStatus === 'error' && <span className="text-xs text-red-400">❌ Error</span>}
          </div>
          <div className="bg-steel-900 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-0.5">
            {dlProgress.map((p, i) => (
              <div key={i} className={p.startsWith('❌') ? 'text-red-400' : p.startsWith('✓') ? 'text-green-400' : 'text-steel-300'}>
                {p.startsWith('❌') || p.startsWith('✓') ? p : `▸ ${p}`}
              </div>
            ))}
            {downloading && <div className="animate-pulse text-green-400">▸ _</div>}
          </div>
          {importedArticles.length > 0 && (
            <div className="mt-3 space-y-1">
              {importedArticles.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-green-400">
                  <CheckCircle size={12} />
                  <span>{a.title?.slice(0, 60)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const RESEARCH_SOURCES = [
  { id: 'arxiv',            label: 'arXiv',            url: 'https://arxiv.org/',                    note: 'Free API' },
  { id: 'core',             label: 'CORE',             url: 'https://core.ac.uk/',                   note: 'Free API' },
  { id: 'semantic_scholar', label: 'Semantic Scholar', url: 'https://www.semanticscholar.org/',      note: 'Free API' },
  { id: 'doaj',             label: 'DOAJ',             url: 'https://doaj.org/',                     note: 'Free API' },
  { id: 'google_scholar',   label: 'Google Scholar',   url: 'https://scholar.google.com/',           note: 'Scrape (may be limited)' },
]

const SUGGESTED_KEYWORDS = [
  'smart manufacturing',
  'steel production optimization',
  'supply chain resilience',
  'OT cybersecurity',
  'industrial AI',
  'predictive maintenance',
  'order tracking AI',
  'factory scheduling optimization',
]

function ResearchTab({ lang }) {
  const allTopics = useTopics()
  const [keyword, setKeyword] = useState('')
  const [selectedSources, setSelectedSources] = useState(['arxiv', 'core', 'semantic_scholar', 'doaj'])
  const [searching, setSearching] = useState(false)
  const [searchTaskId, setSearchTaskId] = useState(null)
  const [progress, setProgress] = useState([])
  const [results, setResults] = useState([])
  const [searchStatus, setSearchStatus] = useState('')
  // Selection & download
  const [selectedIndices, setSelectedIndices] = useState([])
  const [articleCategories, setArticleCategories] = useState({})
  const [pubDate, setPubDate] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [downloading, setDownloading] = useState(false)
  const [dlProgress, setDlProgress] = useState([])
  const [dlStatus, setDlStatus] = useState('')
  const [imported, setImported] = useState([])

  const toggleSource = (id) => setSelectedSources(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  )
  const toggleIndex = (i) => {
    setSelectedIndices(prev => {
      const next = prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
      if (!prev.includes(i) && !articleCategories[String(i)]) {
        setArticleCategories(c => ({ ...c, [String(i)]: 'General' }))
      }
      return next
    })
  }
  const toggleAll = () => {
    if (selectedIndices.length === results.length) {
      setSelectedIndices([])
    } else {
      const all = results.map((_, i) => i)
      setSelectedIndices(all)
      const defaults = {}
      all.forEach(i => { if (!articleCategories[String(i)]) defaults[String(i)] = 'General' })
      setArticleCategories(c => ({ ...c, ...defaults }))
    }
  }

  const startSearch = async () => {
    if (!keyword.trim() || !selectedSources.length) return
    setSearching(true)
    setProgress([])
    setResults([])
    setSelectedIndices([])
    setImported([])
    setDlProgress([])
    setSearchStatus('running')
    try {
      const res = await startResearchSearch({ keyword: keyword.trim(), sources: selectedSources })
      const tid = res.data.task_id
      setSearchTaskId(tid)
      let polls = 0
      const poll = setInterval(async () => {
        if (++polls > 60) { clearInterval(poll); setSearching(false); setSearchStatus('error'); return }
        try {
          const { data } = await getAgentStatus(tid)
          setProgress(data.progress || [])
          if (data.status === 'done') {
            setResults(data.articles || [])
            setSearchStatus('done'); setSearching(false); clearInterval(poll)
          } else if (data.status === 'error') {
            setSearchStatus('error'); setSearching(false); clearInterval(poll)
          }
        } catch { clearInterval(poll); setSearching(false) }
      }, 1500)
    } catch { setSearchStatus('error'); setSearching(false) }
  }

  const startDownload = async () => {
    if (!selectedIndices.length || !searchTaskId) return
    setDownloading(true)
    setDlProgress([])
    setDlStatus('running')
    setImported([])
    try {
      const res = await startResearchDownload({
        task_id: searchTaskId,
        selected_indices: selectedIndices,
        topic_categories: articleCategories,
        publication_date: pubDate,
        visibility,
      })
      const tid = res.data.task_id
      let polls = 0
      const poll = setInterval(async () => {
        if (++polls > 150) { clearInterval(poll); setDlStatus('error'); setDownloading(false); return }
        try {
          const { data } = await getAgentStatus(tid)
          setDlProgress(data.progress || [])
          if (data.status === 'done') {
            setImported(data.imported || [])
            setDlStatus('done'); setDownloading(false); clearInterval(poll)
            const importedIdxs = new Set((data.imported || []).map(a => a.idx))
            setSelectedIndices([])
          } else if (data.status === 'error') {
            setDlStatus('error'); setDownloading(false); clearInterval(poll)
          }
        } catch { clearInterval(poll); setDownloading(false) }
      }, 2000)
    } catch { setDlStatus('error'); setDownloading(false) }
  }

  const importedIdxSet = new Set(imported.map(a => a.idx))

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Search config */}
      <div className="card">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <BookOpen size={18} className="text-purple-400" />
          {lang === 'th' ? 'ค้นหางานวิจัย' : 'Steel Research Search'}
        </h3>

        {/* Keyword input */}
        <div className="mb-3">
          <label className="block text-sm text-steel-400 mb-1">{lang === 'th' ? 'คำค้นหา' : 'Search Keyword'}</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-400" />
              <input
                className="input pl-9 w-full"
                placeholder={lang === 'th' ? 'เช่น steel production optimization...' : 'e.g. steel production optimization...'}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && startSearch()}
              />
            </div>
            <button
              onClick={startSearch}
              disabled={searching || !keyword.trim() || !selectedSources.length}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
            >
              {searching ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
              {searching ? (lang === 'th' ? 'กำลังค้นหา...' : 'Searching...') : (lang === 'th' ? 'ค้นหา' : 'Search')}
            </button>
          </div>
        </div>

        {/* Suggested keywords */}
        <div className="mb-4">
          <p className="text-xs text-steel-500 mb-2">{lang === 'th' ? 'คำแนะนำ:' : 'Suggested:'}</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_KEYWORDS.map(kw => (
              <button
                key={kw}
                onClick={() => setKeyword(kw)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  keyword === kw
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'border-steel-600 text-steel-400 hover:border-purple-500 hover:text-purple-300'
                }`}
              >
                {kw}
              </button>
            ))}
          </div>
        </div>

        {/* Source selection */}
        <div>
          <label className="block text-sm text-steel-400 mb-2">{lang === 'th' ? 'แหล่งข้อมูล' : 'Sources'}</label>
          <div className="grid grid-cols-2 gap-2">
            {RESEARCH_SOURCES.map(src => (
              <label key={src.id} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedSources.includes(src.id)}
                  onChange={() => toggleSource(src.id)}
                  className="accent-purple-500"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-steel-200">{src.label}</span>
                  <span className="text-xs text-steel-500 ml-1.5">{src.note}</span>
                </div>
                <a href={src.url} target="_blank" rel="noreferrer"
                  className="text-steel-600 hover:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}>
                  <ExternalLink size={11} />
                </a>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Search progress */}
      {progress.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">{lang === 'th' ? 'ความคืบหน้า' : 'Search Progress'}</h3>
            {searchStatus === 'done' && <span className="text-xs text-green-400">✓ {results.length} results</span>}
          </div>
          <div className="bg-steel-900 rounded-lg p-3 max-h-32 overflow-y-auto font-mono text-xs space-y-0.5">
            {progress.map((p, i) => (
              <div key={i} className={p.startsWith('❌') ? 'text-red-400' : p.startsWith('✓') ? 'text-green-400' : p.startsWith('  ⚠') ? 'text-amber-400' : 'text-steel-300'}>
                {p}
              </div>
            ))}
            {searching && <div className="animate-pulse text-purple-400">▸ _</div>}
          </div>
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">
              {lang === 'th' ? `ผลการค้นหา (${results.length})` : `Results (${results.length})`}
            </h3>
            <button onClick={toggleAll} className="text-xs text-purple-400 hover:text-purple-300">
              {selectedIndices.length === results.length
                ? (lang === 'th' ? 'ยกเลิกทั้งหมด' : 'Deselect all')
                : (lang === 'th' ? 'เลือกทั้งหมด' : 'Select all')}
            </button>
          </div>

          <div className="space-y-2 mb-4 max-h-[480px] overflow-y-auto pr-1">
            {results.map((item, i) => {
              const isImported = importedIdxSet.has(i)
              const isSelected = selectedIndices.includes(i)
              return (
                <div key={i} className={`rounded-lg border transition-colors ${
                  isImported ? 'border-green-700/40 bg-green-900/10 opacity-70'
                  : isSelected ? 'border-purple-600/60 bg-purple-900/10'
                  : 'border-steel-700/50 bg-steel-700/30 hover:border-steel-600'
                }`}>
                  <label className="flex items-start gap-3 p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={isImported}
                      checked={isSelected}
                      onChange={() => toggleIndex(i)}
                      className="mt-0.5 accent-purple-500 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-white leading-snug font-medium">{item.title}</p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            item.source === 'arXiv' ? 'bg-red-900/50 text-red-300' :
                            item.source === 'CORE' ? 'bg-blue-900/50 text-blue-300' :
                            item.source === 'Semantic Scholar' ? 'bg-teal-900/50 text-teal-300' :
                            item.source === 'DOAJ' ? 'bg-green-900/50 text-green-300' :
                            'bg-purple-900/50 text-purple-300'
                          }`}>{item.source}</span>
                          {item.open_access && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300">OA</span>
                          )}
                        </div>
                      </div>
                      {item.abstract && (
                        <p className="text-xs text-steel-400 mt-1 line-clamp-2">{item.abstract}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5">
                        {item.year && <span className="text-xs text-steel-500">{item.year}</span>}
                        {item.authors?.length > 0 && (
                          <span className="text-xs text-steel-500 truncate max-w-48">{item.authors.join(', ')}</span>
                        )}
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noreferrer"
                            className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-0.5"
                            onClick={e => e.stopPropagation()}>
                            <ExternalLink size={10} /> View
                          </a>
                        )}
                        {item.pdf_url && (
                          <a href={item.pdf_url} target="_blank" rel="noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                            onClick={e => e.stopPropagation()}>
                            <Download size={10} /> PDF
                          </a>
                        )}
                        {isImported && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <CheckCircle size={10} /> Imported
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                  {/* Per-article settings when selected */}
                  {isSelected && !isImported && (
                    <div className="px-3 pb-3 flex flex-wrap items-center gap-3 border-t border-steel-700/50 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-steel-400">Category:</span>
                        <select
                          className="input text-xs py-1 w-44"
                          value={articleCategories[String(i)] || 'General'}
                          onChange={e => setArticleCategories(c => ({ ...c, [String(i)]: e.target.value }))}
                        >
                          {allTopics.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Bulk settings + import button */}
          {selectedIndices.length > 0 && (
            <div className="border-t border-steel-700 pt-3 space-y-3">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-steel-400">{lang === 'th' ? 'วันที่ตีพิมพ์:' : 'Pub. Date:'}</span>
                  <input type="month" className="input text-xs py-1 w-36" value={pubDate} onChange={e => setPubDate(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-steel-400">Visibility:</span>
                  <select className="input text-xs py-1 w-28" value={visibility} onChange={e => setVisibility(e.target.value)}>
                    <option value="public">🌐 Public</option>
                    <option value="private">🔒 Private</option>
                  </select>
                </div>
              </div>
              <button
                onClick={startDownload}
                disabled={downloading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors disabled:opacity-50"
              >
                {downloading ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                {downloading
                  ? (lang === 'th' ? 'กำลัง import...' : 'Importing...')
                  : (lang === 'th' ? `Import ${selectedIndices.length} บทความ` : `Import ${selectedIndices.length} article(s) to Knowledge Hub`)}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Download progress */}
      {dlProgress.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">{lang === 'th' ? 'ความคืบหน้าการ Import' : 'Import Progress'}</h3>
            {dlStatus === 'done' && <span className="text-xs text-green-400">✓ {imported.length} imported</span>}
          </div>
          <div className="bg-steel-900 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-0.5">
            {dlProgress.map((p, i) => (
              <div key={i} className={p.startsWith('❌') ? 'text-red-400' : p.startsWith('✓') ? 'text-green-400' : p.startsWith('  ⚠') ? 'text-amber-400' : 'text-steel-300'}>
                {p}
              </div>
            ))}
            {downloading && <div className="animate-pulse text-purple-400">▸ _</div>}
          </div>
          {imported.length > 0 && (
            <div className="mt-3 space-y-1">
              {imported.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-green-400">
                  <CheckCircle size={12} /> <span>{a.title?.slice(0, 70)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AddArticlePage({ lang, auth }) {
  const [tab, setTab] = useState('upload')

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">{lang === 'th' ? 'เพิ่มบทความ' : 'Add Article'}</h1>
        <p className="text-sm text-steel-400 mt-1">
          {lang === 'th' ? 'Upload PDF หรือใช้ AI Agent ดึงจาก AIST หรือค้นหางานวิจัย' : 'Upload PDF, fetch from AIST, or search academic sources'}
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        {[
          { key: 'upload',   label: '📄 Upload PDF' },
          { key: 'agent',    label: '🤖 AIST Agent' },
          { key: 'research', label: '🔬 Steel Research' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-blue-600 text-white' : 'text-steel-400 hover:text-white bg-steel-800 border border-steel-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'upload' && <UploadTab lang={lang} auth={auth} />}
      {tab === 'agent' && <AgentTab lang={lang} />}
      {tab === 'research' && <ResearchTab lang={lang} />}
    </div>
  )
}
