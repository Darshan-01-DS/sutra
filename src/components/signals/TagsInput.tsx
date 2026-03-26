'use client'
// src/components/signals/TagsInput.tsx — Premium tag input with autocomplete

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'

interface TagsInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

const DOT_COLORS = ['#5DCAA5', '#378ADD', '#D4537E', '#EF9F27', '#7F77DD', '#D85A30', '#5DCAA5', '#378ADD']

export default function TagsInput({ tags, onChange, placeholder = 'Add tag...' }: TagsInputProps) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [hiIdx, setHiIdx] = useState(-1)
  const [suggestions, setSuggestions] = useState<{ tag: string; count: number }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch suggestions from API
  useEffect(() => {
    if (!input.trim()) { setSuggestions([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const q = input.replace(/^#/, '').trim()
        if (!q) { setSuggestions([]); return }
        const r = await fetch(`/api/tags?q=${encodeURIComponent(q)}`)
        const data = await r.json()
        setSuggestions(Array.isArray(data) ? data : [])
      } catch { setSuggestions([]) }
    }, 150)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [input])

  const normalizeTag = (raw: string) => {
    let t = raw.trim().replace(/^#+/, '').replace(/\s+/g, '-').toLowerCase()
    return t || ''
  }

  const addTag = useCallback((raw: string) => {
    const t = normalizeTag(raw)
    if (!t) return
    const withHash = '#' + t
    if (tags.includes(withHash)) { setInput(''); setOpen(false); setHiIdx(-1); return }
    onChange([...tags, withHash])
    setInput('')
    setOpen(false)
    setHiIdx(-1)
    setSuggestions([])
  }, [tags, onChange])

  const removeTag = useCallback((tag: string) => {
    onChange(tags.filter(t => t !== tag))
  }, [tags, onChange])

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const filtered = suggestions.filter(s => !tags.includes('#' + s.tag))
    const allOptions = filtered.length > 0 || (input && !tags.includes('#' + normalizeTag(input)))
    const maxIdx = filtered.length + (input && !tags.includes('#' + normalizeTag(input)) ? 1 : 0) - 1

    if (e.key === 'Enter') {
      e.preventDefault()
      if (hiIdx >= 0 && hiIdx < filtered.length) addTag(filtered[hiIdx].tag)
      else addTag(input)
    } else if (e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHiIdx(i => Math.min(i + 1, maxIdx))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHiIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = suggestions.filter(s => !tags.includes('#' + s.tag)).slice(0, 6)
  const createLabel = input ? '#' + normalizeTag(input) : ''
  const showCreate = createLabel && createLabel !== '#' && !tags.includes(createLabel)
  const showDrop = open && (filtered.length > 0 || showCreate)

  return (
    <div
      ref={wrapRef}
      style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap',
        gap: '5px', padding: '8px 14px 10px',
        borderTop: '0.5px solid rgba(255,255,255,0.055)',
        minHeight: '40px', cursor: 'text',
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Tag chips */}
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: 'rgba(255,255,255,0.06)',
            border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: '6px', padding: '3px 8px 3px 9px',
            fontSize: '12px', color: 'rgba(255,255,255,0.7)',
            userSelect: 'none',
            animation: 'sutra-tag-in .2s cubic-bezier(0.34,1.56,0.64,1)',
            transition: 'background .15s, border-color .15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
        >
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
            style={{
              width: '14px', height: '14px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', borderRadius: '3px', background: 'none',
              border: 'none', color: 'rgba(255,255,255,0.28)', fontSize: '11px',
              cursor: 'pointer', padding: '0', lineHeight: 1, transition: 'color .12s, background .12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.28)'; e.currentTarget.style.background = 'none' }}
          >✕</button>
        </span>
      ))}

      {/* Input wrapper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, minWidth: '100px', position: 'relative' }}>
        {/* Tag icon */}
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ color: 'rgba(255,255,255,0.22)', flexShrink: 0 }}>
          <path d="M9.5 2H13.5L14 6.5L8.5 12L4 7.5L9.5 2Z" stroke="currentColor" strokeWidth="1.4"/>
          <circle cx="11.5" cy="4.5" r=".8" fill="currentColor"/>
        </svg>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setHiIdx(-1); setOpen(true) }}
          onKeyDown={handleKey}
          onFocus={() => { if (input) setOpen(true) }}
          placeholder={tags.length === 0 ? placeholder : ''}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: '12.5px', fontFamily: 'inherit',
            color: 'rgba(255,255,255,0.6)', caretColor: '#c8a96e', width: '100%', padding: 0,
          }}
        />

        {/* Dropdown */}
        {showDrop && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: '-10px',
            background: '#1a1b1d', border: '0.5px solid rgba(255,255,255,0.12)',
            borderRadius: '10px', padding: '6px', minWidth: '185px',
            zIndex: 100, boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
            animation: 'sutra-drop-in .14s ease',
          }}>
            {filtered.map((s, i) => (
              <div
                key={s.tag}
                onMouseDown={() => addTag(s.tag)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '7px 10px', borderRadius: '6px', fontSize: '12.5px',
                  color: i === hiIdx ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)',
                  background: i === hiIdx ? 'rgba(255,255,255,0.07)' : 'transparent',
                  cursor: 'pointer', transition: 'background .1s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i === hiIdx ? 'rgba(255,255,255,0.07)' : 'transparent'; (e.currentTarget as HTMLElement).style.color = i === hiIdx ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)' }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: DOT_COLORS[i % DOT_COLORS.length], flexShrink: 0, display: 'inline-block' }} />
                #{s.tag}
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(255,255,255,0.22)' }}>{s.count}</span>
              </div>
            ))}

            {showCreate && (
              <>
                {filtered.length > 0 && (
                  <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '3px 0' }} />
                )}
                <div
                  onMouseDown={() => addTag(input)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 10px', borderRadius: '6px', fontSize: '12.5px',
                    color: hiIdx === filtered.length ? '#c8a96e' : 'rgba(200,169,110,0.7)',
                    background: hiIdx === filtered.length ? 'rgba(200,169,110,0.08)' : 'transparent',
                    cursor: 'pointer', transition: 'all .1s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(200,169,110,0.08)'; (e.currentTarget as HTMLElement).style.color = '#c8a96e' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(200,169,110,0.7)' }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>+</span>
                  Create {createLabel}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
