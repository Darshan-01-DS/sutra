'use client'
// src/components/panels/KnowledgeGraph.tsx

import { useEffect, useRef, useState } from 'react'
import { StatsData } from '@/types'

const NODE_COLORS = ['#C9A96E', '#9B8FF5', '#4ECDC4', '#E8705A', '#6BCB77']

interface KGNode { id: string; title: string; x: number; y: number; color: string; r: number }
interface KGEdge { source: string; target: string }

interface Props { stats: StatsData | null; loading: boolean }

// Fullscreen D3 overlay
interface Props2 extends Props {
  onOpenFullscreen?: () => void
}

export function KnowledgeGraph({ stats, loading, onOpenFullscreen }: Props2) {
  const [nodes, setNodes]   = useState<KGNode[]>([])
  const [edges, setEdges]   = useState<KGEdge[]>([])
  const [focusId, setFocusId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/graph')
      .then(r => r.json())
      .then(data => {
        const W = 280, H = 190
        const cx = W / 2, cy = H / 2

        const ns: KGNode[] = (data.nodes ?? []).slice(0, 12).map((n: any, i: number) => {
          const angle = (2 * Math.PI * i) / Math.min(data.nodes.length, 12)
          const dist  = i === 0 ? 0 : 65 + (i % 2) * 10
          return {
            id:    n.id,
            title: n.title.slice(0, 10),
            x:     i === 0 ? cx : cx + Math.cos(angle) * dist,
            y:     i === 0 ? cy : cy + Math.sin(angle) * dist,
            color: NODE_COLORS[i % NODE_COLORS.length],
            r:     i === 0 ? 24 : 15,
          }
        })

        const idSet = new Set(ns.map(n => n.id))
        const es: KGEdge[] = (data.edges ?? [])
          .filter((e: any) => idSet.has(e.source) && idSet.has(e.target))
          .slice(0, 20)

        setNodes(ns)
        setEdges(es)
        if (ns[0]) setFocusId(ns[0].id)
      })
      .catch(() => {
        // Fallback static graph
        const W = 280, H = 190
        const cx = W / 2, cy = H / 2
        const fallback: KGNode[] = [
          { id: '1', title: 'Center',   x: cx,      y: cy,      color: '#C9A96E', r: 24 },
          { id: '2', title: 'AI',       x: cx - 70, y: cy - 45, color: '#9B8FF5', r: 15 },
          { id: '3', title: 'Design',   x: cx + 70, y: cy - 40, color: '#4ECDC4', r: 15 },
          { id: '4', title: 'Startup',  x: cx + 80, y: cy + 30, color: '#E8705A', r: 15 },
          { id: '5', title: 'Research', x: cx - 60, y: cy + 50, color: '#6BCB77', r: 15 },
        ]
        setNodes(fallback)
        setEdges([
          { source: '1', target: '2' },
          { source: '1', target: '3' },
          { source: '1', target: '4' },
          { source: '1', target: '5' },
        ])
        setFocusId('1')
      })
  }, [])

  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  if (loading && nodes.length === 0) {
    return (
      <div>
        <div className="rp-section-label">Knowledge graph</div>
        <div className="graph-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: 'var(--text3)', fontSize: 12 }}>Building graph…</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div className="rp-section-label" style={{ flex: 1 }}>
          {focusId ? `Connected to "${nodes.find(n => n.id === focusId)?.title ?? '…'}"` : 'Knowledge graph'}
        </div>
        <button
          type="button"
          className="btn-ghost"
          style={{ height: 28, padding: '0 10px' }}
          onClick={onOpenFullscreen}
          disabled={!nodes.length}
          title="Open fullscreen D3 graph"
        >
          Fullscreen
        </button>
      </div>
      <div className="graph-box">
        <svg viewBox="0 0 280 190" style={{ width: '100%', height: '100%' }}>
          {/* Edges */}
          {edges.map((e: any, i) => {
            const s = nodeMap.get(e.source), t = nodeMap.get(e.target)
            if (!s || !t) return null
            const isStrong = e.strength === 'strong'
            const isMedium = e.strength === 'medium'
            const color = isStrong ? '#C9A96E' : isMedium ? '#9B8FF5' : '#4A4A58'
            const strokeWidth = isStrong ? 2.0 : isMedium ? 1.2 : 0.7
            const opacity = isStrong ? 0.8 : isMedium ? 0.55 : 0.35

            return (
              <line key={i}
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={color}
                strokeWidth={strokeWidth}
                opacity={opacity}
              />
            )
          })}
          {/* Nodes */}
          {nodes.map((n, i) => (
            <g key={n.id} onClick={() => setFocusId(n.id)} style={{ cursor: 'pointer' }}>
              <circle
                cx={n.x} cy={n.y} r={n.r}
                fill={`${n.color}18`}
                stroke={n.color}
                strokeWidth={focusId === n.id ? 1.8 : 1}
                opacity={focusId && focusId !== n.id ? 0.4 : 1}
              />
              <text
                x={n.x} y={n.y + 3}
                textAnchor="middle"
                fill={n.color}
                fontSize={i === 0 ? 8 : 7}
                fontFamily="Geist, sans-serif"
                opacity={focusId && focusId !== n.id ? 0.4 : 1}
              >
                {n.title}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, textAlign: 'center', lineHeight: 1.6 }}>
        <div>
          {nodes.length} nodes · {(edges as any).filter((e: any) => e.strength==='strong').length} strong · {(edges as any).filter((e: any) => e.strength==='medium').length} medium · {(edges as any).filter((e: any) => e.strength==='weak').length} weak
        </div>
        <div style={{ marginTop: 2 }}>
          <span style={{color: '#C9A96E'}}>── Strong</span> &nbsp;&nbsp;
          <span style={{color: '#9B8FF5'}}>── Medium</span> &nbsp;&nbsp;
          <span style={{color: '#4A4A58'}}>── Weak</span>
        </div>
      </div>
    </div>
  )
}
