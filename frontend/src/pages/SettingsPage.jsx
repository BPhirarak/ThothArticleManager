import React, { useState, useEffect } from 'react'
import { Settings, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import api from '../api'

export default function SettingsPage({ lang }) {
  const [stats, setStats] = useState(null)
  const [rebuilding, setRebuilding] = useState(false)

  useEffect(() => {
    api.get('/health').then(() => {
      api.get('/articles').then(r => {
        setStats({ articles: r.data.length })
      })
    }).catch(() => {})
  }, [])

  const rebuildGraph = async () => {
    setRebuilding(true)
    try {
      await api.post('/graph/rebuild')
    } catch (e) {}
    setRebuilding(false)
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-6">{lang === 'th' ? 'ตั้งค่าระบบ' : 'Settings'}</h1>

      {/* Stats */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-4">{lang === 'th' ? 'สถิติระบบ' : 'System Statistics'}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-steel-700 rounded-lg p-3">
            <p className="text-2xl font-bold text-blue-400">{stats?.articles ?? '—'}</p>
            <p className="text-sm text-steel-400">{lang === 'th' ? 'บทความทั้งหมด' : 'Total Articles'}</p>
          </div>
          <div className="bg-steel-700 rounded-lg p-3">
            <p className="text-2xl font-bold text-green-400">SQLite</p>
            <p className="text-sm text-steel-400">{lang === 'th' ? 'ฐานข้อมูล' : 'Database'}</p>
          </div>
        </div>
      </div>

      {/* LLM Config */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-3">{lang === 'th' ? 'การตั้งค่า LLM' : 'LLM Configuration'}</h2>
        <p className="text-sm text-steel-400 mb-3">
          {lang === 'th'
            ? 'แก้ไขไฟล์ backend/.env เพื่อเปลี่ยน API keys และ model'
            : 'Edit backend/.env to change API keys and model settings'}
        </p>
        <div className="bg-steel-900 rounded-lg p-4 font-mono text-xs text-green-400 space-y-1">
          <div>LLM_PROVIDER=openai  <span className="text-steel-500"># or "bedrock"</span></div>
          <div>OPENAI_API_KEY=sk-...</div>
          <div>OPENAI_MODEL=gpt-4o</div>
          <div className="text-steel-500"># AWS Bedrock (Claude)</div>
          <div>AWS_ACCESS_KEY_ID=...</div>
          <div>BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-6</div>
        </div>
      </div>

      {/* Graph */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-3">{lang === 'th' ? 'Knowledge Graph' : 'Knowledge Graph'}</h2>
        <p className="text-sm text-steel-400 mb-3">
          {lang === 'th'
            ? 'Rebuild graph เมื่อเพิ่มหรือลบบทความจำนวนมาก'
            : 'Rebuild the graph after adding or removing multiple articles'}
        </p>
        <button
          onClick={rebuildGraph}
          disabled={rebuilding}
          className="btn-secondary flex items-center gap-2 disabled:opacity-50"
        >
          {rebuilding ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {lang === 'th' ? 'Rebuild Knowledge Graph' : 'Rebuild Knowledge Graph'}
        </button>
      </div>

      {/* AIST */}
      <div className="card">
        <h2 className="font-semibold mb-3">AIST Credentials</h2>
        <p className="text-sm text-steel-400 mb-3">
          {lang === 'th' ? 'ตั้งค่าใน backend/.env' : 'Configured in backend/.env'}
        </p>
        <div className="bg-steel-900 rounded-lg p-4 font-mono text-xs text-green-400 space-y-1">
          <div>AIST_USER=153585</div>
          <div>AIST_PASSWORD=********</div>
        </div>
      </div>
    </div>
  )
}
