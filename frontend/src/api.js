import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Articles
export const getArticles = (params) => api.get('/articles', { params })
export const getArticle = (id) => api.get(`/articles/${id}`)
export const createArticle = (data) => api.post('/articles', data)
export const updateArticle = (id, data) => api.put(`/articles/${id}`, data)
export const deleteArticle = (id) => api.delete(`/articles/${id}`)
export const uploadArticle = (formData) => api.post('/articles/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
})
export const getAllTags = () => api.get('/articles/tags/all')
export const getTopics = () => api.get('/articles/topics')

// Graph
export const getGraphData = () => api.get('/graph')
export const getRelated = (id) => api.get(`/graph/${id}/related`)
export const rebuildGraph = () => api.post('/graph/rebuild')

// Chat
export const sendMessage = (data, config = {}) => api.post('/chat/message', data, config)
export const getChatHistory = () => api.get('/chat/history')
export const clearHistory = () => api.delete('/chat/history')
export const getChatSessions = () => api.get('/chat/sessions')
export const getChatSession = (id) => api.get(`/chat/sessions/${id}`)
export const saveChatSession = (data) => api.post('/chat/sessions', data)
export const deleteChatSession = (id) => api.delete(`/chat/sessions/${id}`)

// Dashboard
export const generateReport = (data) => api.post('/dashboard/report', data)
export const generatePresentation = (data) => api.post('/dashboard/presentation', data, {
  responseType: 'blob',
})

// Agent
export const startAistSearch = (data) => api.post('/agent/search-aist', data)
export const getAgentStatus = (taskId) => api.get(`/agent/status/${taskId}`)
export const importArticle = (data) => api.post('/agent/import-article', data)
export const downloadAndImport = (data) => api.post('/agent/download-and-import', data)

// Steel Research Agent
export const startResearchSearch = (data) => api.post('/agent/research-search', data)
export const startResearchDownload = (data) => api.post('/agent/research-download', data)

export default api
