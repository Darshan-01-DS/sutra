'use client'
// src/components/panels/FullScreenGraph.tsx

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import type { GraphEdge, GraphNode } from '@/types'

type GraphPayload = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

interface SignalInfo {
  _id: string
  title: string
  type: string
  tags: string[]
  summary?: string
  content?: string
  url?: string
  source?: string
}

interface NodeCardProps {
  info: SignalInfo
  pos: { x: number; y: number }
  containerRect: DOMRect | null
  onOpenDrawer: (id: string) => void
  onClose: () => void
  connectedTags: string[]
}

function NodeInfoCard({ info, pos, containerRect, onOpenDrawer, onClose, connectedTags }: NodeCardProps) {
  const typeColors: Record<string, string> = {
    article: '#9B8FF5', tweet: '#4ECDC4', video: '#E8705A',
    pdf: '#C9A96E', image: '#6BCB77', note: '#C9A96E',
  }
  const typeIcons: Record<string, string> = {
    article: '▤', tweet: '𝕏', video: '▶', pdf: '⬚', image: '⊡', note: '✎',
  }
  const color = typeColors[info.type] ?? '#C9A96E'

  // Position card so it doesn't go off-screen
  const cardWidth = 280
  const cardHeight = 240
  let left = pos.x + 16
  let top = pos.y - 60

  if (containerRect) {
    if (left + cardWidth > containerRect.width) left = pos.x - cardWidth - 16
    if (top + cardHeight > containerRect.height) top = containerRect.height - cardHeight - 8
    if (top < 8) top = 8
    if (left < 8) left = 8
  }

  return (
    <div
      className="gf-node-card"
      style={{ left, top }}
      onClick={e => e.stopPropagation()}
    >
      <div className="gnc-top">
        <div className="gnc-type-badge" style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
          <span>{typeIcons[info.type] ?? '◈'}</span>
          <span>{info.type.toUpperCase()}</span>
        </div>
        <button className="gnc-close" onClick={onClose}>×</button>
      </div>

      <div className="gnc-title">{info.title.slice(0, 80)}</div>

      {(info.summary || info.content) && (
        <div className="gnc-excerpt">
          {(info.summary || info.content)!.slice(0, 120)}…
        </div>
      )}

      <div className="gnc-tags">
        {info.tags.slice(0, 5).map(t => (
          <span key={t} className="gnc-tag">#{t}</span>
        ))}
      </div>

      {connectedTags.length > 0 && (
        <div className="gnc-connections">
          <span className="gnc-conn-label">🔗 Linked via:</span>
          {connectedTags.slice(0, 3).map(t => (
            <span key={t} className="gnc-conn-tag">#{t}</span>
          ))}
        </div>
      )}

      <div className="gnc-actions">
        <button
          className="gnc-btn-primary"
          onClick={() => { onOpenDrawer(info._id); onClose() }}
        >
          Open & Edit →
        </button>
        {info.url && (
          <button
            className="gnc-btn-ghost"
            onClick={() => window.open(info.url!, '_blank', 'noopener')}
          >
            Source ↗
          </button>
        )}
      </div>
    </div>
  )
}

export function FullScreenGraph({
  open,
  onClose,
  onNodeClick,
}: {
  open: boolean
  onClose: () => void
  onNodeClick: (id: string) => void
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [payload, setPayload] = useState<GraphPayload | null>(null)
  const [selectedCard, setSelectedCard] = useState<{
    info: SignalInfo
    pos: { x: number; y: number }
    connectedTags: string[]
  } | null>(null)

  useEffect(() => {
    if (!open) return
    setPayload(null)
    setSelectedCard(null)
    fetch('/api/graph')
      .then(r => r.json())
      .then(data => setPayload({ nodes: data.nodes ?? [], edges: data.edges ?? [] }))
      .catch(() => setPayload({ nodes: [], edges: [] }))
  }, [open])

  const colorByType: Record<string, string> = useMemo(() => ({
    article: '#9B8FF5',
    tweet:   '#4ECDC4',
    video:   '#E8705A',
    pdf:     '#C9A96E',
    image:   '#6BCB77',
    note:    '#C9A96E',
    link:    '#9B8FF5',
  }), [])

  const handleNodeClick = useCallback(async (nodeId: string, screenX: number, screenY: number, nodeData: any) => {
    // Get position relative to container
    const rect = hostRef.current?.getBoundingClientRect()
    const relX = rect ? screenX - rect.left : screenX
    const relY = rect ? screenY - rect.top : screenY

    try {
      const r = await fetch(`/api/signals/${nodeId}`)
      if (!r.ok) throw new Error('Not found')
      const data = await r.json()
      
      // Find connected tags (shared with adjacent nodes)
      const connectedNodeIds = (payload?.edges ?? [])
        .filter(e => String(e.source) === nodeId || String(e.target) === nodeId)
        .map(e => String(e.source) === nodeId ? String(e.target) : String(e.source))
      
      const connectedNodes = (payload?.nodes ?? []).filter(n => connectedNodeIds.includes(n.id))
      const connectedTags = Array.from(
        new Set(connectedNodes.flatMap(n => (n as any).tags ?? []).filter((t: string) => data.tags?.includes(t)))
      ) as string[]

      setSelectedCard({
        info: {
          _id: data._id,
          title: data.title,
          type: data.type,
          tags: data.tags ?? [],
          summary: data.summary,
          content: data.content,
          url: data.url,
          source: data.source,
        },
        pos: { x: relX, y: relY },
        connectedTags,
      })
    } catch {
      // Fallback: use node data directly
      setSelectedCard({
        info: {
          _id: nodeId,
          title: nodeData.title ?? 'Unknown',
          type: nodeData.type ?? 'note',
          tags: nodeData.tags ?? [],
          summary: undefined,
          content: undefined,
          url: nodeData.url,
        },
        pos: { x: relX, y: relY },
        connectedTags: [],
      })
    }
  }, [payload])

  useEffect(() => {
    if (!open) return
    if (!payload) return
    if (!svgRef.current || !hostRef.current) return

    const host = hostRef.current
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = Math.max(400, host.clientWidth)
    const height = Math.max(400, host.clientHeight)

    const nodes = payload.nodes.map((n: any, i) => ({
      ...n,
      x: (n as any).x ?? width / 2 + (Math.random() - 0.5) * 260,
      y: (n as any).y ?? height / 2 + (Math.random() - 0.5) * 200,
      fx: null as number | null,
      fy: null as number | null,
      r:  i === 0 ? 30 : 18 + Math.min((n.relatedCount ?? 0) * 2, 8),
      color: colorByType[n.type] ?? '#C9A96E',
    }))

    const edges = payload.edges.map(e => ({ ...e })) as GraphEdge[]
    const idToNode = new Map(nodes.map(n => [n.id, n]))

    const zoomLayer = svg.append('g')
    const g = zoomLayer.append('g')

    const zoom = (d3 as any)
      .zoom()
      .scaleExtent([0.15, 5])
      .on('zoom', (event: any) => {
        zoomLayer.attr('transform', event.transform.toString())
      })

    svg.call(zoom)
    svg.attr('viewBox', `0 0 ${width} ${height}`)

    // Defs for glow
    const defs = svg.append('defs')
    defs.append('filter')
      .attr('id', 'gf-glow')
      .append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur')

    // Edge labels tooltip on hover (using title tag)
    const linkSel = g
      .append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('class', 'edge-line')
      .attr('stroke', (d: any) => d.strength === 'strong' ? '#C9A96E' : d.strength === 'medium' ? '#9B8FF5' : '#4A4A58')
      .attr('stroke-opacity', (d: any) => d.strength === 'strong' ? 0.8 : d.strength === 'medium' ? 0.55 : 0.35)
      .attr('stroke-width', (d: any) => d.strength === 'strong' ? 2.0 : d.strength === 'medium' ? 1.2 : 0.7)

    // Edge shared-tag labels
    const edgeLabelSel = g
      .append('g')
      .selectAll('text')
      .data(edges)
      .join('text')
      .attr('text-anchor', 'middle')
      .attr('fill', '#555570')
      .attr('font-size', 7.5)
      .attr('font-family', 'Geist, sans-serif')
      .attr('pointer-events', 'none')
      .attr('opacity', 0)
      .text((d: any) => (d.reasons ?? []).join(' · '))

    // Hover edges to show shared tags
    ;(linkSel as any)
      .on('mouseover', function(this: SVGLineElement, _: MouseEvent, d: any) {
        d3.select(this).attr('stroke-opacity', 1)
        edgeLabelSel.filter((ed: any) => ed === d).attr('opacity', 1)
      })
      .on('mouseout', function(this: SVGLineElement, _: MouseEvent, d: any) {
        d3.select(this).attr('stroke-opacity', d.strength === 'strong' ? 0.8 : d.strength === 'medium' ? 0.55 : 0.35)
        edgeLabelSel.filter((ed: any) => ed === d).attr('opacity', 0)
      })

    const nodeSel = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')

    // Glow ring on hover
    nodeSel
      .append('circle')
      .attr('r', (d: any) => d.r + 6)
      .attr('fill', 'none')
      .attr('stroke', (d: any) => d.color)
      .attr('stroke-width', 1.5)
      .attr('opacity', 0)
      .attr('class', 'node-glow')

    nodeSel
      .append('circle')
      .attr('r', (d: any) => d.r)
      .attr('fill', (d: any) => `${d.color}22`)
      .attr('stroke', (d: any) => d.color)
      .attr('stroke-width', 1.5)

    nodeSel
      .append('text')
      .text((d: any) => (d.title ?? '').slice(0, 12))
      .attr('x', 0)
      .attr('y', 4)
      .attr('text-anchor', 'middle')
      .attr('fill', (d: any) => d.color)
      .attr('font-size', (d: any) => (d.r > 22 ? 9 : 7.5))
      .attr('font-family', 'Geist, sans-serif')
      .attr('pointer-events', 'none')

    // Hover effects
    ;(nodeSel as any)
      .on('mouseover', function(this: SVGGElement) {
        d3.select(this).select('.node-glow').attr('opacity', 0.5)
        d3.select(this).select('circle:not(.node-glow)').attr('stroke-width', 2.5)
      })
      .on('mouseout', function(this: SVGGElement) {
        d3.select(this).select('.node-glow').attr('opacity', 0)
        d3.select(this).select('circle:not(.node-glow)').attr('stroke-width', 1.5)
      })
      .on('click', (evt: any, d: any) => {
        evt.stopPropagation()
        const svgRect = svgRef.current?.getBoundingClientRect()
        const x = evt.clientX - (svgRect?.left ?? 0)
        const y = evt.clientY - (svgRect?.top ?? 0)
        handleNodeClick(d.id, x, y, d)
      })

    const simulation = d3
      .forceSimulation(nodes as any)
      .force('charge', d3.forceManyBody().strength(-600))
      .force(
        'link',
        d3.forceLink(edges as any).id((d: any) => d.id).distance(130).strength((d: any) => d.strength === 'strong' ? 1 : d.strength === 'medium' ? 0.4 : 0.05)
      )
      .force('x', d3.forceX(width / 2).strength(0.04))
      .force('y', d3.forceY(height / 2).strength(0.04))
      .force('collide', d3.forceCollide().radius((d: any) => d.r + 25).iterations(2))
      .alpha(1)
      .alphaDecay(0.03)

    simulation.on('tick', () => {
      linkSel
        .attr('x1', (d: any) => d.source.x ?? 0)
        .attr('y1', (d: any) => d.source.y ?? 0)
        .attr('x2', (d: any) => d.target.x ?? 0)
        .attr('y2', (d: any) => d.target.y ?? 0)

      edgeLabelSel
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2)

      nodeSel.attr('transform', (d: any) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    const drag = d3
      .drag()
      .on('start', (event: any, d: any) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x; d.fy = d.y
      })
      .on('drag', (event: any, d: any) => {
        d.fx = event.x; d.fy = event.y
      })
      .on('end', (event: any, d: any) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null; d.fy = null
      })

    nodeSel.select('circle:not(.node-glow)').call(drag as any)

    return () => { simulation.stop() }
  }, [open, payload, colorByType, handleNodeClick])

  // Node Highlighting effect
  useEffect(() => {
    if (!svgRef.current || !payload) return
    const svg = d3.select(svgRef.current)
    if (!selectedCard) {
      svg.selectAll('.node-group').attr('opacity', 1).style('pointer-events', 'auto')
      svg.selectAll('.edge-line').attr('opacity', (d: any) => d.strength === 'strong' ? 0.8 : d.strength === 'medium' ? 0.55 : 0.35)
    } else {
      const focusId = selectedCard.info._id
      const connectedIds = new Set<string>([focusId])
      payload.edges.forEach(e => {
        const s = String((e.source as any).id ?? e.source)
        const t = String((e.target as any).id ?? e.target)
        if (s === focusId) connectedIds.add(t)
        if (t === focusId) connectedIds.add(s)
      })

      svg.selectAll('.node-group')
        .attr('opacity', (d: any) => connectedIds.has(String(d.id)) ? 1 : 0.15)
        .style('pointer-events', (d: any) => connectedIds.has(String(d.id)) ? 'auto' : 'none')
      svg.selectAll('.edge-line').attr('opacity', (d: any) => {
        const s = String(d.source.id ?? d.source)
        const t = String(d.target.id ?? d.target)
        if (s === focusId || t === focusId) return (d.strength === 'strong' ? 0.8 : d.strength === 'medium' ? 0.55 : 0.35)
        return 0.05
      })
    }
  }, [selectedCard, payload])

  return (
    <div className={`graph-full-overlay ${open ? 'on' : ''}`} aria-hidden={!open} onClick={() => { setSelectedCard(null); onClose() }}>
      <div className="graph-full-modal" onClick={e => e.stopPropagation()}>
        <div className="graph-full-top">
          <div className="graph-full-title">
            <span>◎</span> Knowledge Graph
            {payload && (
              <span className="gf-meta">
                {payload.nodes.length} nodes · {(payload.edges as any).filter((e: any) => e.strength==='strong').length} strong · {(payload.edges as any).filter((e: any) => e.strength==='medium').length} medium · {(payload.edges as any).filter((e: any) => e.strength==='weak').length} weak connections
              </span>
            )}
          </div>
          <div className="gf-top-actions">
            {payload && (
             <span className="gf-legend" style={{fontSize: 11, color: "var(--text3)", marginRight: 16}}>
               <span style={{color: '#C9A96E'}}>── Strong</span> &nbsp;&nbsp;
               <span style={{color: '#9B8FF5'}}>── Medium</span> &nbsp;&nbsp;
               <span style={{color: '#4A4A58'}}>── Weak</span>
             </span>
            )}
            <span className="gf-hint">Click a node to explore · Hover edges for reasons · Drag to rearrange</span>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Close ×
            </button>
          </div>
        </div>
        <div className="graph-full-host" ref={hostRef} onClick={() => setSelectedCard(null)}>
          {!payload && (
            <div className="gf-loading">
              <div className="gf-loading-dots">
                <span/><span/><span/>
              </div>
              <div>Building knowledge graph…</div>
            </div>
          )}
          <svg ref={svgRef} className="graph-full-svg" />

          {selectedCard && (
            <NodeInfoCard
              info={selectedCard.info}
              pos={selectedCard.pos}
              containerRect={hostRef.current?.getBoundingClientRect() ?? null}
              onOpenDrawer={onNodeClick}
              onClose={() => setSelectedCard(null)}
              connectedTags={selectedCard.connectedTags}
            />
          )}
        </div>
      </div>
    </div>
  )
}
