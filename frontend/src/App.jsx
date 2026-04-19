import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import {
  BookOpen, Share2, MessageSquare, PlusCircle,
  LayoutDashboard, Settings, Menu, X, Shield, LogOut, Sun, Moon
} from 'lucide-react'
import LibraryPage from './pages/LibraryPage'
import GraphPage from './pages/GraphPage'
import ChatPage from './pages/ChatPage'
import AddArticlePage from './pages/AddArticlePage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import api from './api'

const navItems = [
  { to: '/', icon: BookOpen, label: 'คลังบทความ', labelEn: 'Library' },
  { to: '/graph', icon: Share2, label: 'Knowledge Graph', labelEn: 'Graph' },
  { to: '/chat', icon: MessageSquare, label: 'AI Chat', labelEn: 'AI Chat' },
  { to: '/add', icon: PlusCircle, label: 'เพิ่มบทความ', labelEn: 'Add Article' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', labelEn: 'Dashboard' },
]
const adminNavItems = [
  { to: '/settings', icon: Settings, label: 'ตั้งค่า', labelEn: 'Settings' },
]

export default function App() {
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sys_auth') || 'null') } catch { return null }
  })
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [lang, setLang] = useState(() => localStorage.getItem('sys_lang') || 'th')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('sys_theme') !== 'light')

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('sys_theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    localStorage.setItem('sys_lang', lang)
  }, [lang])

  useEffect(() => {
    if (auth) {
      api.defaults.headers.common['x-username'] = auth.username
      api.defaults.headers.common['x-role'] = auth.role
    } else {
      delete api.defaults.headers.common['x-username']
      delete api.defaults.headers.common['x-role']
    }
  }, [auth])

  const handleLogout = async () => {
    try { await api.post('/auth/logout') } catch { }
    localStorage.removeItem('sys_auth')
    setAuth(null)
  }

  if (!auth) return <LoginPage onLogin={setAuth} darkMode={darkMode} />

  const navActive = 'bg-blue-600 text-white'
  const navIdle = 'text-steel-300 hover:bg-steel-700 hover:text-white dark:text-steel-300 dark:hover:bg-steel-700 light:text-slate-600 light:hover:bg-slate-100 light:hover:text-slate-900'

  return (
    <BrowserRouter>
      <div className={`flex h-screen overflow-hidden ${darkMode ? 'bg-steel-900 text-steel-100' : 'bg-slate-50 text-slate-800'}`}>
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-56' : 'w-16'} flex-shrink-0 flex flex-col transition-all duration-200 ${darkMode ? 'bg-steel-800 border-r border-steel-700' : 'bg-white border-r border-slate-200 shadow-sm'}`}>
          {/* Logo */}
          <div className={`flex items-center gap-3 px-4 py-4 border-b ${darkMode ? 'border-steel-700' : 'border-slate-200'}`}>
            <img src="/thoth-icon.png" alt="Thoth" className="w-8 h-8 rounded-lg flex-shrink-0 object-cover" />
            {sidebarOpen && (
              <div className="overflow-hidden">
                <div className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-slate-800'}`}>Thoth</div>
                <div className={`text-xs ${darkMode ? 'text-steel-400' : 'text-slate-400'}`}>Article Manager</div>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 px-2 py-3 space-y-1">
            {navItems.map(({ to, icon: Icon, label, labelEn }) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? navActive : (darkMode ? 'text-steel-300 hover:bg-steel-700 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}`}>
                <Icon size={18} className="flex-shrink-0" />
                {sidebarOpen && <span className="truncate">{lang === 'th' ? label : labelEn}</span>}
              </NavLink>
            ))}
            {auth.role === 'admin' && adminNavItems.map(({ to, icon: Icon, label, labelEn }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? navActive : (darkMode ? 'text-steel-300 hover:bg-steel-700 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}`}>
                <Icon size={18} className="flex-shrink-0" />
                {sidebarOpen && <span className="truncate">{lang === 'th' ? label : labelEn}</span>}
              </NavLink>
            ))}
            {auth.role === 'admin' && (
              <NavLink to="/admin"
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-purple-600 text-white' : (darkMode ? 'text-steel-300 hover:bg-steel-700 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}`}>
                <Shield size={18} className="flex-shrink-0" />
                {sidebarOpen && <span className="truncate">{lang === 'th' ? 'จัดการระบบ' : 'Admin'}</span>}
              </NavLink>
            )}
          </nav>

          {/* Bottom controls */}
          <div className={`px-2 py-3 border-t space-y-1 ${darkMode ? 'border-steel-700' : 'border-slate-200'}`}>
            {sidebarOpen && (
              <div className={`px-3 py-2 rounded-lg mb-1 ${darkMode ? 'bg-steel-700/50' : 'bg-slate-100'}`}>
                <p className={`text-xs font-medium truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{auth.display_name || auth.username}</p>
                <span className={`text-xs px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${auth.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' : (darkMode ? 'bg-steel-600 text-steel-300' : 'bg-slate-200 text-slate-600')}`}>
                  {auth.role}
                </span>
              </div>
            )}
            {/* Theme toggle */}
            <button onClick={() => setDarkMode(d => !d)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-colors ${darkMode ? 'text-steel-400 hover:text-white hover:bg-steel-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>
              {darkMode ? <Sun size={18} className="flex-shrink-0" /> : <Moon size={18} className="flex-shrink-0" />}
              {sidebarOpen && <span>{darkMode ? (lang === 'th' ? 'Light Mode' : 'Light Mode') : (lang === 'th' ? 'Dark Mode' : 'Dark Mode')}</span>}
            </button>
            <button onClick={() => setLang(l => l === 'th' ? 'en' : 'th')}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-colors ${darkMode ? 'text-steel-400 hover:text-white hover:bg-steel-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>
              <span className="text-base flex-shrink-0">{lang === 'th' ? '🇹🇭' : '🇬🇧'}</span>
              {sidebarOpen && <span>{lang === 'th' ? 'ภาษาไทย' : 'English'}</span>}
            </button>
            <button onClick={handleLogout}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-colors ${darkMode ? 'text-steel-400 hover:text-red-400 hover:bg-steel-700' : 'text-slate-500 hover:text-red-600 hover:bg-red-50'}`}>
              <LogOut size={18} className="flex-shrink-0" />
              {sidebarOpen && <span>{lang === 'th' ? 'ออกจากระบบ' : 'Logout'}</span>}
            </button>
            <button onClick={() => setSidebarOpen(o => !o)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-colors ${darkMode ? 'text-steel-400 hover:text-white hover:bg-steel-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              {sidebarOpen && <span>Collapse</span>}
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<LibraryPage lang={lang} auth={auth} darkMode={darkMode} />} />
            <Route path="/graph" element={<GraphPage lang={lang} darkMode={darkMode} />} />
            <Route path="/chat" element={<ChatPage lang={lang} auth={auth} darkMode={darkMode} />} />
            <Route path="/add" element={<AddArticlePage lang={lang} auth={auth} darkMode={darkMode} />} />
            <Route path="/dashboard" element={<DashboardPage lang={lang} darkMode={darkMode} />} />
            <Route path="/settings" element={<SettingsPage lang={lang} darkMode={darkMode} />} />
            {auth.role === 'admin' && <Route path="/admin" element={<AdminPage auth={auth} lang={lang} darkMode={darkMode} />} />}
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
