import React, { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import api from '../api'

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const r = await api.post('/auth/login', { username, password })
      localStorage.setItem('sys_auth', JSON.stringify(r.data))
      onLogin(r.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'เข้าสู่ระบบไม่สำเร็จ')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-steel-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/thoth-icon.png" alt="Thoth" className="w-20 h-20 rounded-2xl mx-auto mb-4 object-cover shadow-lg" />
          <h1 className="text-2xl font-bold text-white">Thoth Article Manager</h1>
          <p className="text-steel-400 text-sm mt-1">Structural Steel Manufacturing — SYS</p>
        </div>

        <div className="bg-steel-800 border border-steel-700 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-6">เข้าสู่ระบบ</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-steel-400 mb-1">ชื่อผู้ใช้ / Email</label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="input"
                placeholder="username@syssteel.com"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-steel-400 mb-1">รหัสผ่าน</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 py-2.5"
            >
              {loading && <RefreshCw size={16} className="animate-spin" />}
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
          <p className="text-xs text-steel-500 text-center mt-4">
            ใช้ข้อมูล Active Directory ของบริษัท
          </p>
        </div>
      </div>
    </div>
  )
}
