import React, { useState, useEffect } from 'react'
import { UserPlus, Trash2, Shield, RefreshCw, Search, Tag, FolderOpen, BookOpen, Pencil, Check, X, Plus } from 'lucide-react'
import api from '../api'

const ROLE_BADGE = {
  admin: 'bg-purple-900/50 text-purple-300 border-purple-700',
  user: 'bg-steel-700 text-steel-300 border-steel-600',
}

// ── Users Tab ──────────────────────────────────────────────────────────────
function UsersTab({ auth, lang }) {
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ username: '', display_name: '', role: 'user' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const headers = { 'x-username': auth.username }

  const load = async () => {
    try { const r = await api.get('/auth/users', { headers }); setUsers(r.data) }
    catch { setError('โหลดข้อมูลไม่สำเร็จ') }
  }
  useEffect(() => { load() }, [])

  const handleAdd = async (e) => {
    e.preventDefault(); setError(''); setSuccess(''); setLoading(true)
    try {
      await api.post('/auth/users', form, { headers })
      setSuccess(`เพิ่มผู้ใช้ "${form.username}" สำเร็จ`)
      setForm({ username: '', display_name: '', role: 'user' }); load()
    } catch (e) { setError(e.response?.data?.detail || 'เกิดข้อผิดพลาด') }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><UserPlus size={16} className="text-blue-400" />{lang === 'th' ? 'เพิ่มผู้ใช้ใหม่' : 'Add New User'}</h2>
        <form onSubmit={handleAdd} className="flex gap-3 flex-wrap">
          <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="email@syssteel.com" required className="input flex-1 min-w-48" />
          <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder={lang === 'th' ? 'ชื่อแสดง' : 'Display name'} className="input flex-1 min-w-32" />
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="input w-auto">
            <option value="user">User</option><option value="admin">Admin</option>
          </select>
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <UserPlus size={14} />}{lang === 'th' ? 'เพิ่ม' : 'Add'}
          </button>
        </form>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        {success && <p className="text-green-400 text-xs mt-2">{success}</p>}
      </div>
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-steel-700 flex items-center justify-between">
          <h2 className="font-semibold text-sm">{lang === 'th' ? `ผู้ใช้ทั้งหมด (${users.length})` : `All Users (${users.length})`}</h2>
          <button onClick={load} className="text-steel-400 hover:text-white p-1"><RefreshCw size={14} /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-steel-700/50 border-b border-steel-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-steel-400">Username</th>
                <th className="px-4 py-3 text-left text-xs text-steel-400">{lang === 'th' ? 'ชื่อ' : 'Name'}</th>
                <th className="px-4 py-3 text-left text-xs text-steel-400">Role</th>
                <th className="px-4 py-3 text-left text-xs text-steel-400">Status</th>
                <th className="px-4 py-3 text-left text-xs text-steel-400">{lang === 'th' ? 'สร้างเมื่อ' : 'Created'}</th>
                <th className="px-4 py-3 text-xs text-steel-400"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-700">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-steel-700/30">
                  <td className="px-4 py-3 text-steel-200 font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3 text-steel-200">{u.display_name || '—'}</td>
                  <td className="px-4 py-3">
                    <select value={u.role} onChange={e => { api.put(`/auth/users/${u.id}`, { role: e.target.value }, { headers }).then(load) }}
                      className={`text-xs px-2 py-0.5 rounded-full border bg-transparent cursor-pointer ${ROLE_BADGE[u.role] || ROLE_BADGE.user}`}>
                      <option value="user">user</option><option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => api.put(`/auth/users/${u.id}`, { is_active: !u.is_active }, { headers }).then(load)}
                      className={`text-xs px-2 py-0.5 rounded-full border ${u.is_active ? 'bg-green-900/40 text-green-400 border-green-700' : 'bg-red-900/40 text-red-400 border-red-700'}`}>
                      {u.is_active ? (lang === 'th' ? 'ใช้งาน' : 'Active') : (lang === 'th' ? 'ปิดใช้' : 'Inactive')}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-steel-500">{u.created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => { if (confirm(`ลบ "${u.username}"?`)) api.delete(`/auth/users/${u.id}`, { headers }).then(load) }} className="text-steel-500 hover:text-red-400 p-1"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Tags Tab ───────────────────────────────────────────────────────────────
function TagsTab({ lang }) {
  const [tags, setTags] = useState([])
  const [editingTag, setEditingTag] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [newTag, setNewTag] = useState('')
  const [msg, setMsg] = useState('')

  const load = async () => {
    const r = await api.get('/articles/tags/all'); setTags(r.data)
  }
  useEffect(() => { load() }, [])

  const rename = async (old_tag) => {
    if (!editVal.trim() || editVal === old_tag) { setEditingTag(null); return }
    await api.post('/articles/admin/tags/rename', { old_tag, new_tag: editVal.trim() })
    setMsg(`✓ Renamed "${old_tag}" → "${editVal.trim()}"`); setEditingTag(null); load()
  }

  const remove = async (tag) => {
    if (!confirm(`ลบ tag "${tag}" ออกจากทุกบทความ?`)) return
    const r = await api.delete(`/articles/admin/tags/${encodeURIComponent(tag)}`)
    setMsg(`✓ Removed "${tag}" from ${r.data.updated_articles} articles`); load()
  }

  return (
    <div className="space-y-4">
      {msg && <div className="bg-green-900/30 border border-green-700 rounded-lg px-4 py-2 text-green-400 text-sm">{msg}</div>}
      <div className="card">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Tag size={15} className="text-blue-400" />{lang === 'th' ? `Tags ทั้งหมด (${tags.length})` : `All Tags (${tags.length})`}</h2>
        <p className="text-xs text-steel-500 mb-3">{lang === 'th' ? 'คลิก ✏️ เพื่อเปลี่ยนชื่อ หรือ 🗑️ เพื่อลบออกจากทุกบทความ' : 'Click ✏️ to rename or 🗑️ to remove from all articles'}</p>
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <div key={tag} className="flex items-center gap-1 bg-steel-700 border border-steel-600 rounded-full px-2 py-0.5">
              {editingTag === tag ? (
                <>
                  <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') rename(tag); if (e.key === 'Escape') setEditingTag(null) }}
                    className="bg-transparent text-xs text-white outline-none w-32" />
                  <button onClick={() => rename(tag)} className="text-green-400 hover:text-green-300"><Check size={11} /></button>
                  <button onClick={() => setEditingTag(null)} className="text-steel-400 hover:text-white"><X size={11} /></button>
                </>
              ) : (
                <>
                  <span className="text-xs text-steel-200">{tag}</span>
                  <button onClick={() => { setEditingTag(tag); setEditVal(tag) }} className="text-steel-500 hover:text-blue-400 ml-1"><Pencil size={10} /></button>
                  <button onClick={() => remove(tag)} className="text-steel-500 hover:text-red-400"><Trash2 size={10} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Categories Tab ─────────────────────────────────────────────────────────
function CategoriesTab({ lang }) {
  const [categories, setCategories] = useState([])
  const [editingCat, setEditingCat] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [newCat, setNewCat] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const r = await api.get('/articles/topics'); setCategories(r.data)
  }
  useEffect(() => { load() }, [])

  const rename = async (old_cat) => {
    if (!editVal.trim() || editVal === old_cat) { setEditingCat(null); return }
    const r = await api.post('/articles/admin/categories/rename', { old_category: old_cat, new_category: editVal.trim() })
    setMsg(`✓ Renamed "${old_cat}" → "${editVal.trim()}" (${r.data.updated_articles} articles updated)`)
    setEditingCat(null); load()
  }

  const remove = async (cat) => {
    if (!confirm(`ลบ category "${cat}"? บทความจะถูกย้ายไป "General"`)) return
    const r = await api.delete(`/articles/admin/categories/${encodeURIComponent(cat)}`)
    setMsg(`✓ Removed "${cat}", moved ${r.data.updated_articles} articles to General`); load()
  }

  const addCategory = async () => {
    const name = newCat.trim()
    if (!name) return
    setLoading(true)
    try {
      await api.post('/articles/admin/categories', { name })
      setMsg(`✓ เพิ่ม category "${name}" สำเร็จ`)
      setNewCat('')
      load()
    } catch (e) {
      setMsg(`❌ ${e.response?.data?.detail || 'เกิดข้อผิดพลาด'}`)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      {msg && <div className={`border rounded-lg px-4 py-2 text-sm ${msg.startsWith('❌') ? 'bg-red-900/30 border-red-700 text-red-400' : 'bg-green-900/30 border-green-700 text-green-400'}`}>{msg}</div>}
      <div className="card">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><FolderOpen size={15} className="text-amber-400" />{lang === 'th' ? `Categories (${categories.length})` : `Categories (${categories.length})`}</h2>
        <div className="space-y-2 mb-4">
          {categories.map(cat => (
            <div key={cat} className="flex items-center gap-2 bg-steel-700/50 rounded-lg px-3 py-2">
              {editingCat === cat ? (
                <>
                  <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') rename(cat); if (e.key === 'Escape') setEditingCat(null) }}
                    className="input flex-1 text-sm py-1" />
                  <button onClick={() => rename(cat)} className="text-green-400 hover:text-green-300 p-1"><Check size={14} /></button>
                  <button onClick={() => setEditingCat(null)} className="text-steel-400 hover:text-white p-1"><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-steel-200">{cat}</span>
                  <button onClick={() => { setEditingCat(cat); setEditVal(cat) }} className="text-steel-500 hover:text-blue-400 p-1"><Pencil size={13} /></button>
                  {cat !== 'General' && (
                    <button onClick={() => remove(cat)} className="text-steel-500 hover:text-red-400 p-1"><Trash2 size={13} /></button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        {/* Add new category */}
        <div className="border-t border-steel-700 pt-3">
          <label className="block text-xs text-steel-400 mb-2">{lang === 'th' ? 'เพิ่ม Category ใหม่' : 'Add New Category'}</label>
          <div className="flex gap-2">
            <input value={newCat} onChange={e => setNewCat(e.target.value)}
              placeholder={lang === 'th' ? 'ชื่อ category ใหม่...' : 'New category name...'}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
              className="input flex-1 text-sm" />
            <button onClick={addCategory} disabled={loading || !newCat.trim()}
              className="btn-primary flex items-center gap-1 text-sm disabled:opacity-50">
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {lang === 'th' ? 'เพิ่ม' : 'Add'}
            </button>
          </div>
          <p className="text-xs text-steel-500 mt-1">{lang === 'th' ? 'Category ใหม่จะปรากฏใน dropdown ทันที' : 'New category appears in dropdowns immediately'}</p>
        </div>
      </div>
    </div>
  )
}

// ── Articles Tab ───────────────────────────────────────────────────────────
function ArticlesTab({ lang }) {
  const [articles, setArticles] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const params = {}; if (search) params.search = search
    const r = await api.get('/articles/', { params }); setArticles(r.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const remove = async (article) => {
    if (!confirm(`ลบบทความ "${article.title}"? ไม่สามารถกู้คืนได้`)) return
    await api.delete(`/articles/${article.id}`)
    setMsg(`✓ ลบ "${article.title.slice(0, 50)}" แล้ว`)
    setArticles(prev => prev.filter(a => a.id !== article.id))
  }

  return (
    <div className="space-y-4">
      {msg && <div className="bg-green-900/30 border border-green-700 rounded-lg px-4 py-2 text-green-400 text-sm">{msg}</div>}
      <div className="card flex gap-3 items-end">
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-400" />
          <input className="input pl-8 text-sm" value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()} placeholder={lang === 'th' ? 'ค้นหาบทความ...' : 'Search articles...'} />
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {lang === 'th' ? 'โหลด' : 'Load'}
        </button>
      </div>
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-steel-700">
          <h2 className="font-semibold text-sm flex items-center gap-2"><BookOpen size={14} className="text-blue-400" />{lang === 'th' ? `บทความทั้งหมด (${articles.length})` : `All Articles (${articles.length})`}</h2>
        </div>
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-steel-700/50 border-b border-steel-700 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-steel-400">ID</th>
                <th className="px-4 py-2 text-left text-xs text-steel-400">{lang === 'th' ? 'ชื่อบทความ' : 'Title'}</th>
                <th className="px-4 py-2 text-left text-xs text-steel-400">Category</th>
                <th className="px-4 py-2 text-left text-xs text-steel-400">{lang === 'th' ? 'วันที่' : 'Date'}</th>
                <th className="px-4 py-2 text-left text-xs text-steel-400">Owner</th>
                <th className="px-4 py-2 text-left text-xs text-steel-400">Visibility</th>
                <th className="px-4 py-2 text-xs text-steel-400"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-700/50">
              {articles.map(a => (
                <tr key={a.id} className="hover:bg-steel-700/20">
                  <td className="px-4 py-2 text-steel-500 text-xs font-mono">{a.id}</td>
                  <td className="px-4 py-2 text-steel-200 max-w-xs">
                    <p className="truncate text-xs">{a.title}</p>
                  </td>
                  <td className="px-4 py-2 text-xs text-steel-400">{a.topic_category}</td>
                  <td className="px-4 py-2 text-xs text-steel-500">{a.publication_date}</td>
                  <td className="px-4 py-2 text-xs text-steel-500 font-mono">{a.owner || 'system'}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border ${a.visibility === 'private' ? 'bg-amber-900/30 text-amber-400 border-amber-700' : 'bg-green-900/30 text-green-400 border-green-700'}`}>
                      {a.visibility || 'public'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => remove(a)} className="text-steel-500 hover:text-red-400 p-1"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Logs Tab ───────────────────────────────────────────────────────────────
function LogsTab({ auth, lang }) {
  const [logs, setLogs] = useState([])
  const [filterUser, setFilterUser] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [loading, setLoading] = useState(false)
  const headers = { 'x-username': auth.username }

  const load = async () => {
    setLoading(true)
    const params = {}; if (filterUser) params.username = filterUser; if (filterAction) params.action = filterAction
    try { const r = await api.get('/auth/logs', { headers, params }); setLogs(r.data) } catch { }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const ACTION_COLORS = { login: 'text-green-400', login_failed: 'text-red-400', logout: 'text-steel-400', upload: 'text-blue-400', download: 'text-blue-400', delete: 'text-red-400', create_user: 'text-purple-400', delete_user: 'text-red-400', update_user: 'text-amber-400', chat: 'text-steel-300' }

  return (
    <div className="space-y-4">
      <div className="card flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-40">
          <label className="block text-xs text-steel-400 mb-1">Username</label>
          <div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-400" />
            <input className="input pl-8 text-sm" value={filterUser} onChange={e => setFilterUser(e.target.value)} placeholder="filter..." /></div>
        </div>
        <div>
          <label className="block text-xs text-steel-400 mb-1">Action</label>
          <select className="input w-auto text-sm" value={filterAction} onChange={e => setFilterAction(e.target.value)}>
            <option value="">{lang === 'th' ? 'ทั้งหมด' : 'All'}</option>
            {['login','login_failed','logout','upload','download','delete','create_user','delete_user','chat'].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}{lang === 'th' ? 'โหลด' : 'Load'}
        </button>
      </div>
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-steel-700"><h2 className="font-semibold text-sm">Access Logs ({logs.length})</h2></div>
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-steel-700/50 border-b border-steel-700 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-steel-400">{lang === 'th' ? 'เวลา' : 'Time'}</th>
                <th className="px-4 py-2 text-left text-steel-400">Username</th>
                <th className="px-4 py-2 text-left text-steel-400">Action</th>
                <th className="px-4 py-2 text-left text-steel-400">Detail</th>
                <th className="px-4 py-2 text-left text-steel-400">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-700/50">
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-steel-700/20">
                  <td className="px-4 py-2 text-steel-500 font-mono whitespace-nowrap">{l.created_at?.replace('T', ' ').slice(0, 19)}</td>
                  <td className="px-4 py-2 text-steel-200 font-mono">{l.username}</td>
                  <td className={`px-4 py-2 font-medium ${ACTION_COLORS[l.action] || 'text-steel-300'}`}>{l.action}</td>
                  <td className="px-4 py-2 text-steel-400 max-w-xs truncate">{l.detail}</td>
                  <td className="px-4 py-2 text-steel-500 font-mono">{l.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── System Settings Tab ────────────────────────────────────────────────────
function SettingsTab({ auth, lang }) {
  const [settings, setSettings] = useState({ CHAT_MAX_TOKENS: 4096 })
  const [msg, setMsg] = useState('')
  const headers = { 'x-username': auth.username }

  useEffect(() => {
    api.get('/auth/settings', { headers }).then(r => setSettings(r.data)).catch(() => {})
  }, [])

  const save = async () => {
    try {
      await api.post('/auth/settings', {
        CHAT_MAX_TOKENS: settings.CHAT_MAX_TOKENS,
        REPORT_MAX_TOKENS: settings.REPORT_MAX_TOKENS,
      }, { headers })
      setMsg('✓ บันทึกสำเร็จ')
    } catch (e) { setMsg('❌ ' + (e.response?.data?.detail || 'Error')) }
  }

  return (
    <div className="space-y-4 max-w-lg">
      {msg && <div className={`border rounded-lg px-4 py-2 text-sm ${msg.startsWith('❌') ? 'bg-red-900/30 border-red-700 text-red-400' : 'bg-green-900/30 border-green-700 text-green-400'}`}>{msg}</div>}
      <div className="card space-y-4">
        <h2 className="font-semibold">{lang === 'th' ? '⚙️ ตั้งค่าระบบ' : '⚙️ System Settings'}</h2>
        <div>
          <label className="block text-sm text-steel-300 mb-1">
            {lang === 'th' ? 'ความยาว Output สูงสุด — Chat (tokens)' : 'Max Output — Chat (tokens)'}
          </label>
          <p className="text-xs text-steel-500 mb-2">
            {lang === 'th' ? 'สำหรับ AI Chat ทั่วไป (256–16000)' : 'For general AI Chat (256–16000)'}
          </p>
          <div className="flex gap-3 items-center">
            <input type="number" min={256} max={16000} step={256} value={settings.CHAT_MAX_TOKENS}
              onChange={e => setSettings(s => ({ ...s, CHAT_MAX_TOKENS: parseInt(e.target.value) || 4096 }))}
              className="input w-32" />
            <input type="range" min={256} max={16000} step={256} value={settings.CHAT_MAX_TOKENS}
              onChange={e => setSettings(s => ({ ...s, CHAT_MAX_TOKENS: parseInt(e.target.value) }))}
              className="flex-1 accent-blue-500" />
            <span className="text-blue-400 font-medium text-xs w-20 text-right">{(settings.CHAT_MAX_TOKENS || 4096).toLocaleString()}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm text-steel-300 mb-1">
            {lang === 'th' ? 'ความยาว Output สูงสุด — Report (tokens)' : 'Max Output — Report (tokens)'}
          </label>
          <p className="text-xs text-steel-500 mb-2">
            {lang === 'th' ? 'สำหรับ Dashboard Report (1024–32000) ค่าสูงขึ้น = report ละเอียดขึ้น' : 'For Dashboard Reports (1024–32000). Higher = more detailed report'}
          </p>
          <div className="flex gap-3 items-center">
            <input type="number" min={1024} max={32000} step={512} value={settings.REPORT_MAX_TOKENS || 8192}
              onChange={e => setSettings(s => ({ ...s, REPORT_MAX_TOKENS: parseInt(e.target.value) || 8192 }))}
              className="input w-32" />
            <input type="range" min={1024} max={32000} step={512} value={settings.REPORT_MAX_TOKENS || 8192}
              onChange={e => setSettings(s => ({ ...s, REPORT_MAX_TOKENS: parseInt(e.target.value) }))}
              className="flex-1 accent-green-500" />
            <span className="text-green-400 font-medium text-xs w-20 text-right">{(settings.REPORT_MAX_TOKENS || 8192).toLocaleString()}</span>
          </div>
        </div>
        <div className="pt-2 border-t border-steel-700">
          <p className="text-xs text-steel-500 mb-3">
            {lang === 'th' ? 'ข้อมูล LLM ปัจจุบัน (อ่านอย่างเดียว)' : 'Current LLM info (read-only)'}
          </p>
          {['LLM_PROVIDER','OPENAI_MODEL','BEDROCK_MODEL_ID','AWS_REGION'].map(k => (
            <div key={k} className="flex gap-2 text-xs mb-1">
              <span className="text-steel-500 w-36 flex-shrink-0">{k}:</span>
              <span className="text-steel-300 font-mono">{settings[k] || '—'}</span>
            </div>
          ))}
        </div>
        <button onClick={save} className="btn-primary text-sm">
          {lang === 'th' ? 'บันทึก' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Main AdminPage ─────────────────────────────────────────────────────────
export default function AdminPage({ auth, lang }) {
  const [tab, setTab] = useState('users')
  const tabs = [
    { key: 'users', label: lang === 'th' ? '👥 Users' : '👥 Users' },
    { key: 'articles', label: lang === 'th' ? '📄 บทความ' : '📄 Articles' },
    { key: 'tags', label: lang === 'th' ? '🏷️ Tags' : '🏷️ Tags' },
    { key: 'categories', label: lang === 'th' ? '📁 Categories' : '📁 Categories' },
    { key: 'settings', label: lang === 'th' ? '⚙️ ตั้งค่า' : '⚙️ Settings' },
    { key: 'logs', label: lang === 'th' ? '📋 Logs' : '📋 Logs' },
  ]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><Shield size={20} className="text-purple-400" />{lang === 'th' ? 'จัดการระบบ' : 'Administration'}</h1>
        <p className="text-sm text-steel-400 mt-1">{lang === 'th' ? 'เฉพาะ Admin เท่านั้น' : 'Admin only'}</p>
      </div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'text-steel-400 hover:text-white bg-steel-800 border border-steel-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'users' && <UsersTab auth={auth} lang={lang} />}
      {tab === 'articles' && <ArticlesTab lang={lang} />}
      {tab === 'tags' && <TagsTab lang={lang} />}
      {tab === 'categories' && <CategoriesTab lang={lang} />}
      {tab === 'settings' && <SettingsTab auth={auth} lang={lang} />}
      {tab === 'logs' && <LogsTab auth={auth} lang={lang} />}
    </div>
  )
}
