import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { getGraphData, getTopics } from '../api'
import { RefreshCw, Info, ZoomIn, ZoomOut, Maximize2, Search, X } from 'lucide-react'

// Default colors for known topics
const DEFAULT_TOPIC_COLORS = {
  'Safety & Environment': '#ef4444',
  'Energy, Control & Digitalization': '#3b82f6',
  'Plant Services & Reliability': '#f59e0b',
  'Material Movement & Transportation': '#8b5cf6',
  'Steel Making': '#64748b',
  'Iron Making': '#6b7280',
  'Rolling & Processing': '#0ea5e9',
  'General': '#10b981',
}

function topicColor(topic, allColors) {
  if (allColors[topic]) return allColors[topic]
  let hash = 0
  for (let i = 0; i < topic.length; i++) hash = topic.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 55%)`
}

export default function GraphPage({ lang, darkMode }) {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] })
  const [selectedNode, setSelectedNode] = useState(null)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [topicColors, setTopicColors] = useState(DEFAULT_TOPIC_COLORS)
  const [search, setSearch] = useState('')
  const [ForceGraph, setForceGraph] = useState(null)
  const fgRef = useRef(null)
  const containerRef = useRef(null)

  // Lazy-load react-force-graph-2d
  useEffect(() => {
    import('react-force-graph-2d').then(mod => setForceGraph(() => mod.default))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [graphRes, topicsRes] = await Promise.all([getGraphData(), getTopics()])
      setGraphData(graphRes.data)
      const colors = { ...DEFAULT_TOPIC_COLORS }
      ;(topicsRes.data || []).forEach(t => { if (!colors[t]) colors[t] = topicColor(t, colors) })
      setTopicColors(colors)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Build force-graph data format
  const fgData = useMemo(() => {
    const searchLower = search.toLowerCase()
    const matchedIds = search
      ? new Set(graphData.nodes.filter(n => n.title.toLowerCase().includes(searchLower)).map(n => n.id))
      : null

    const nodes = graphData.nodes.map(n => ({
      id: n.id,
      label: n.label,
      title: n.title,
      topic: n.topic,
      tags: n.tags || [],
      publication_date: n.publication_date,
      color: topicColors[n.topic] || topicColor(n.topic, topicColors),
      searchMatch: matchedIds ? matchedIds.has(n.id) : false,
    }))

    const links = graphData.edges.map(e => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
      shared_tags: e.shared_tags || [],
    }))

    return { nodes, links }
  }, [graphData, topicColors, search])

  // Compute neighbor sets when a node is selected
  const { neighborIds, neighborLinkSet } = useMemo(() => {
    if (!selectedNode) return { neighborIds: new Set(), neighborLinkSet: new Set() }
    const nids = new Set([selectedNode.id])
    const lset = new Set()
    fgData.links.forEach(l => {
      const sid = l.source?.id ?? l.source
      const tid = l.target?.id ?? l.target
      if (sid === selectedNode.id || tid === selectedNode.id) {
        nids.add(sid); nids.add(tid)
        lset.add(l)
      }
    })
    return { neighborIds: nids, neighborLinkSet: lset }
  }, [selectedNode, fgData.links])

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node)
    // Zoom to node
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 600)
      fgRef.current.zoom(3, 600)
    }
  }, [])

  const handleZoomIn = () => fgRef.current?.zoom(fgRef.current.zoom() * 1.5, 300)
  const handleZoomOut = () => fgRef.current?.zoom(fgRef.current.zoom() / 1.5, 300)
  const handleFit = () => fgRef.current?.zoomToFit(400, 40)

  const bg = darkMode === false ? '#f8fafc' : '#102a43'
  const linkColor = darkMode === false ? 'rgba(100,116,139,0.4)' : 'rgba(148,163,184,0.35)'

  return (
    <div className="flex h-full">
      <div className="flex-1 relative overflow-hidden" ref={containerRef}>
        {/* Toolbar */}
        <div className="absolute top-3 left-3 z-10 flex gap-2">
          <button onClick={load} className="bg-steel-800/90 backdrop-blur border border-steel-700 p-2 rounded-lg text-steel-300 hover:text-white shadow">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleZoomIn} className="bg-steel-800/90 backdrop-blur border border-steel-700 p-2 rounded-lg text-steel-300 hover:text-white shadow">
            <ZoomIn size={15} />
          </button>
          <button onClick={handleZoomOut} className="bg-steel-800/90 backdrop-blur border border-steel-700 p-2 rounded-lg text-steel-300 hover:text-white shadow">
            <ZoomOut size={15} />
          </button>
          <button onClick={handleFit} className="bg-steel-800/90 backdrop-blur border border-steel-700 p-2 rounded-lg text-steel-300 hover:text-white shadow">
            <Maximize2 size={15} />
          </button>
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steel-400" />
            <input
              className="bg-steel-800/90 backdrop-blur border border-steel-700 text-steel-200 text-xs pl-7 pr-7 py-2 rounded-lg w-48 focus:outline-none focus:border-blue-500 shadow"
              placeholder={lang === 'th' ? 'ค้นหาบทความ...' : 'Search articles...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-steel-400 hover:text-white">
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="absolute top-3 right-3 z-10 bg-steel-800/90 backdrop-blur border border-steel-700 rounded-lg p-3 shadow max-h-64 overflow-y-auto">
          <p className="text-xs text-steel-400 font-semibold mb-2 uppercase tracking-wide">Topics</p>
          {Object.entries(topicColors).map(([topic, color]) => (
            <div key={topic} className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-steel-300 truncate max-w-40">{topic}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-steel-800/80 backdrop-blur border border-steel-700 rounded-full px-4 py-1.5 text-xs text-steel-400">
          {fgData.nodes.length} {lang === 'th' ? 'บทความ' : 'articles'} · {fgData.links.length} {lang === 'th' ? 'ความสัมพันธ์' : 'connections'}
          {search && ` · ${fgData.nodes.filter(n => n.highlighted).length} ${lang === 'th' ? 'ตรงกัน' : 'matched'}`}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-full text-steel-400">
            <RefreshCw size={24} className="animate-spin mr-3" />
            {lang === 'th' ? 'กำลังสร้าง graph...' : 'Building graph...'}
          </div>
        ) : fgData.nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-steel-400">
            <Info size={24} className="mr-3" />
            {lang === 'th' ? 'ยังไม่มีบทความใน graph' : 'No articles in graph yet'}
          </div>
        ) : ForceGraph ? (
          <ForceGraph
            ref={fgRef}
            graphData={fgData}
            backgroundColor={bg}
            width={containerRef.current?.offsetWidth || 800}
            height={containerRef.current?.offsetHeight || 600}
            // Node appearance — smaller nodes, better balance
            nodeVal={2}
            nodeRelSize={3}
            // Node label (tooltip on hover)
            nodeLabel={node => `<div style="background:#1e3a5f;border:1px solid #3b82f6;border-radius:6px;padding:6px 10px;font-size:12px;max-width:220px;color:#e2e8f0"><b>${node.title}</b><br/><span style="color:#94a3b8;font-size:11px">${node.topic}</span></div>`}
            // Node canvas rendering — interactive highlight
            nodeCanvasObject={(node, ctx, globalScale) => {
              const isSelected = node === selectedNode
              const isHovered = node === hoveredNode
              const hasSelection = !!selectedNode
              const isNeighbor = hasSelection && neighborIds.has(node.id)
              const isDimmed = hasSelection && !isSelected && !isNeighbor

              // Sizes — scaled down for better balance
              const r = isSelected ? 6 : isNeighbor ? 5 : 3.5

              // Colors
              let fillColor
              if (isDimmed) {
                fillColor = darkMode === false ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)'
              } else {
                fillColor = node.color
              }

              // Glow ring for selected node
              if (isSelected) {
                ctx.beginPath()
                ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI)
                ctx.fillStyle = 'rgba(255,255,255,0.12)'
                ctx.fill()
              }
              // Soft glow for neighbors
              if (isNeighbor && !isDimmed) {
                ctx.beginPath()
                ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI)
                ctx.fillStyle = `${node.color}44`
                ctx.fill()
              }

              // Main circle
              ctx.beginPath()
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
              ctx.fillStyle = fillColor
              ctx.fill()

              // White border for selected
              if (isSelected) {
                ctx.strokeStyle = '#ffffff'
                ctx.lineWidth = 1.5
                ctx.stroke()
              }

              // Labels: ONLY show for selected node or the node being hovered right now
              const showLabel = isSelected || isHovered
              if (showLabel) {
                const label = node.title?.slice(0, 28) || node.label
                // Divide by globalScale so text stays ~11px on screen regardless of zoom level
                const fontSize = 11 / globalScale
                ctx.font = `${isSelected ? 'bold ' : ''}${fontSize}px Sans-Serif`
                ctx.textAlign = 'center'
                ctx.textBaseline = 'top'
                const textY = node.y + r + 4
                const textWidth = ctx.measureText(label).width
                // Dark pill background
                ctx.fillStyle = 'rgba(8,16,32,0.82)'
                ctx.beginPath()
                ctx.roundRect(node.x - textWidth / 2 - 4, textY - 1, textWidth + 8, fontSize + 4, 3)
                ctx.fill()
                ctx.fillStyle = isSelected ? '#ffffff' : '#cbd5e1'
                ctx.fillText(label, node.x, textY)
              }
            }}
            nodeCanvasObjectMode={() => 'replace'}
            // Link appearance — highlight neighbor links, dim others
            linkColor={link => {
              if (!selectedNode) return linkColor
              if (neighborLinkSet.has(link)) return darkMode === false ? 'rgba(59,130,246,0.8)' : 'rgba(99,179,237,0.85)'
              return darkMode === false ? 'rgba(148,163,184,0.06)' : 'rgba(100,116,139,0.06)'
            }}
            linkWidth={link => {
              if (!selectedNode) return Math.max(0.5, (link.weight || 0.01) * 8)
              if (neighborLinkSet.has(link)) return Math.max(1.5, (link.weight || 0.01) * 10)
              return 0.3
            }}
            linkDirectionalParticles={link => selectedNode && neighborLinkSet.has(link) ? 2 : 0}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleColor={() => '#3b82f6'}
            // Interactions
            onNodeClick={handleNodeClick}
            onNodeHover={node => setHoveredNode(node)}
            onBackgroundClick={() => setSelectedNode(null)}
            // Physics — spread nodes across full canvas with stronger repulsion
            d3AlphaDecay={0.015}
            d3VelocityDecay={0.25}
            cooldownTicks={300}
            onEngineStop={() => fgRef.current?.zoomToFit(400, 60)}
            onEngineStart={() => {
              const fg = fgRef.current
              if (!fg) return
              fg.d3Force('charge')?.strength(-180)
              fg.d3Force('link')?.distance(60)
              fg.d3Force('center')?.strength(0.05)
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-steel-400">
            <RefreshCw size={20} className="animate-spin mr-2" /> Loading renderer...
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedNode && (
        <div className="w-72 bg-steel-800 border-l border-steel-700 p-4 overflow-y-auto flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">{lang === 'th' ? 'รายละเอียด' : 'Details'}</h3>
            <button onClick={() => setSelectedNode(null)} className="text-steel-400 hover:text-white p-1">
              <X size={15} />
            </button>
          </div>
          <div className="w-4 h-4 rounded-full mb-3" style={{ backgroundColor: selectedNode.color }} />
          <h4 className="font-bold text-white text-sm leading-snug mb-2">{selectedNode.title}</h4>
          <p className="text-xs text-steel-400 mb-1">{selectedNode.topic}</p>
          <p className="text-xs text-steel-500 mb-3">
            {lang === 'th' ? 'เผยแพร่:' : 'Published:'} {selectedNode.publication_date}
          </p>
          {selectedNode.tags?.length > 0 && (
            <div>
              <p className="text-xs text-steel-400 mb-2 uppercase tracking-wide">Tags</p>
              <div className="flex flex-wrap gap-1">
                {selectedNode.tags.map(tag => (
                  <span key={tag} className="tag text-xs">{tag}</span>
                ))}
              </div>
            </div>
          )}
          {/* Connected nodes */}
          {(() => {
            const connected = fgData.links
              .filter(l => l.source?.id === selectedNode.id || l.target?.id === selectedNode.id || l.source === selectedNode.id || l.target === selectedNode.id)
              .map(l => {
                const otherId = (l.source?.id || l.source) === selectedNode.id ? (l.target?.id || l.target) : (l.source?.id || l.source)
                const other = fgData.nodes.find(n => n.id === otherId)
                return other ? { node: other, weight: l.weight, shared_tags: l.shared_tags } : null
              })
              .filter(Boolean)
              .sort((a, b) => b.weight - a.weight)
              .slice(0, 5)

            return connected.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs text-steel-400 mb-2 uppercase tracking-wide">
                  {lang === 'th' ? 'บทความที่เชื่อมโยง' : 'Connected Articles'}
                </p>
                <div className="space-y-2">
                  {connected.map(({ node, weight, shared_tags }) => (
                    <button key={node.id} onClick={() => setSelectedNode(node)}
                      className="w-full text-left bg-steel-700/50 hover:bg-steel-700 rounded-lg px-3 py-2 transition-colors">
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: node.color }} />
                        <p className="text-xs text-steel-200 leading-snug truncate">{node.title}</p>
                      </div>
                      <p className="text-xs text-steel-500 ml-4">
                        {(weight * 100).toFixed(0)}% match
                        {shared_tags?.length > 0 && ` · ${shared_tags.slice(0, 2).join(', ')}`}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null
          })()}
        </div>
      )}
    </div>
  )
}
