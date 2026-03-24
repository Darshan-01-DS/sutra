'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { slugify } from '@/lib/utils'

type TagSuggestion = { tag: string; count: number }

export function TagAutocomplete({
  tags,
  onChange,
  placeholder = 'Add tag…',
}: {
  tags: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  const [allTags, setAllTags] = useState<TagSuggestion[]>([])
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    fetch('/api/tags')
      .then(r => r.json())
      .then(data => setAllTags(Array.isArray(data) ? data : []))
      .catch(() => setAllTags([]))
  }, [])

  const filtered = useMemo(() => {
    const raw = value.trim().toLowerCase()
    if (!raw) return []
    const chosen = new Set(tags)
    return allTags
      .map(t => t.tag)
      .filter(t => !chosen.has(t))
      .filter(t => t.includes(raw) || t.startsWith(raw))
      .slice(0, 8)
  }, [value, allTags, tags])

  const normalize = (raw: string) => {
    const t = slugify(raw)
    return t.length ? t : ''
  }

  const addTag = (raw: string) => {
    const next = normalize(raw)
    if (!next) return
    if (tags.includes(next)) return
    onChange([...tags, next])
    setValue('')
    setOpen(false)
  }

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag))
  }

  return (
    <div className="tag-editor">
      <div className="tag-editor-row">
        {tags.map(t => (
          <span key={t} className="tag-pill ctag tag-editor-pill" title={t}>
            {t}
            <button
              type="button"
              className="tag-editor-pill-x"
              onClick={() => removeTag(t)}
              aria-label={`Remove tag ${t}`}
            >
              ×
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          className="tag-editor-input"
          value={value}
          placeholder={placeholder}
          onChange={e => setValue(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Allow click selection
            setTimeout(() => setOpen(false), 120)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag(value)
            }
          }}
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="tag-suggest" role="listbox">
          {filtered.map(t => (
            <button
              key={t}
              type="button"
              className="tag-suggest-item"
              onMouseDown={e => e.preventDefault()}
              onClick={() => addTag(t)}
            >
              <span className="tag-suggest-text">{t}</span>
            </button>
          ))}
        </div>
      )}

      <div className="tag-editor-hint">Enter to add · Type to autocomplete</div>
    </div>
  )
}

