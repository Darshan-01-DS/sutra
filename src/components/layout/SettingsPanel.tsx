'use client'

import { useEffect, useState } from 'react'

const THEMES = [
  { id: 'default', label: 'Default' },
  { id: 'violet', label: 'Violet' },
  { id: 'teal', label: 'Teal' },
  { id: 'coral', label: 'Coral' },
] as const

import { useSession } from 'next-auth/react'

export function SettingsPanel({
  open,
  onClose,
  apiKey,
  onApiKeyChange,
  theme,
  onThemeChange,
  uiScale,
  onUiScaleChange,
  onExportJson,
}: {
  open: boolean
  onClose: () => void
  apiKey: string
  onApiKeyChange: (key: string) => void
  theme: (typeof THEMES)[number]['id']
  onThemeChange: (t: (typeof THEMES)[number]['id']) => void
  uiScale: number
  onUiScaleChange: (n: number) => void
  onExportJson: () => void
}) {
  const { data: session, update: updateSession } = useSession()
  const [localKey, setLocalKey] = useState(apiKey)
  const [provider, setProvider] = useState('openai')
  const [baseUrl, setBaseUrl] = useState('')
  const [modelName, setModelName] = useState('gpt-4o-mini')

  const [name, setName] = useState(session?.user?.name || '')
  const [img, setImg] = useState(session?.user?.image || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLocalKey(apiKey)
    setProvider(localStorage.getItem('sutra_ai_provider') || 'openai')
    setBaseUrl(localStorage.getItem('sutra_ai_base_url') || '')
    setModelName(localStorage.getItem('sutra_ai_model') || 'gpt-4o-mini')
  }, [apiKey])
  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || '')
      setImg(session.user.image || '')
    }
  }, [session])

  const handleUpdateProfile = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, image: img })
      })
      if (res.ok) {
        await updateSession()
        window.dispatchEvent(new CustomEvent('sutra-toast', { detail: { message: 'Profile updated', type: 'success' } }))
      }
    } catch {
      window.dispatchEvent(new CustomEvent('sutra-toast', { detail: { message: 'Update failed', type: 'error' } }))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-head">
          <div className="settings-title">System Settings</div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </div>

        <div className="settings-body" style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '16px 24px' }}>
          {/* Section: Profile */}
          <div className="settings-field">
            <div className="settings-label" style={{ marginBottom: 12 }}>User Profile</div>
            <div className="avatar-row">
              <div className="avatar-big" style={{ width: 48, height: 48, fontSize: 16 }}>
                {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (name?.[0] || '👤')}
              </div>
              <div className="avatar-meta">
                <input
                  className="form-input"
                  style={{ marginBottom: 8, height: 32 }}
                  placeholder="Your Name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
                <input
                  className="form-input"
                  style={{ height: 32 }}
                  placeholder="Avatar URL"
                  value={img}
                  onChange={e => setImg(e.target.value)}
                />
              </div>
            </div>
            <button className="form-save" onClick={handleUpdateProfile} disabled={saving} style={{ width: '100%' }}>
              {saving ? 'Updating...' : 'Save Profile Changes'}
            </button>
          </div>

          <div style={{ height: 1, background: 'var(--border)', opacity: 0.3 }} />

          {/* Section: AI Configuration */}
          <div className="settings-field">
            <div className="settings-label">AI & Integrations</div>
            <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 16 }}>Use any OpenAI-compatible API for auto-tagging, similarity, and Ask AI.</div>
            
            <div className="form-row">
              <select className="form-input" value={provider} onChange={e => {
                const val = e.target.value
                setProvider(val)
                if (val === 'openai') { setBaseUrl(''); setModelName('gpt-4o-mini') }
                else if (val === 'groq') { setBaseUrl('https://api.groq.com/openai/v1'); setModelName('llama3-8b-8192') }
                else if (val === 'openrouter') { setBaseUrl('https://openrouter.ai/api/v1'); setModelName('meta-llama/llama-3-8b-instruct:free') }
              }}>
                <option value="openai">OpenAI (Default)</option>
                <option value="groq">Groq</option>
                <option value="openrouter">OpenRouter</option>
                <option value="custom">Custom (Ollama / Local)</option>
              </select>
            </div>

            {provider !== 'openai' && (
              <div className="form-row-2">
                <input className="form-input" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="API Base URL" />
                <input className="form-input" value={modelName} onChange={e => setModelName(e.target.value)} placeholder="Model (e.g. llama3-8b)" />
              </div>
            )}

            <div className="form-row">
              <input
                className="form-input form-input-mono"
                type="password"
                value={localKey}
                onChange={e => setLocalKey(e.target.value)}
                placeholder={provider === 'openai' ? 'OpenAI API Key (sk-...)' : 'API Key (leave blank for local)'}
              />
            </div>
            
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="form-save"
                onClick={() => {
                  localStorage.setItem('sutra_ai_provider', provider)
                  localStorage.setItem('sutra_ai_base_url', baseUrl)
                  localStorage.setItem('sutra_ai_model', modelName)
                  onApiKeyChange(localKey)
                  window.dispatchEvent(new CustomEvent('sutra-toast', { detail: { message: 'AI Settings saved', type: 'success' } }))
                }}
              >
                Save
              </button>
              <button type="button" className="form-cancel" onClick={() => {
                setLocalKey('')
                setBaseUrl('')
                setModelName('gpt-4o-mini')
                setProvider('openai')
                localStorage.removeItem('sutra_ai_provider')
                localStorage.removeItem('sutra_ai_base_url')
                localStorage.removeItem('sutra_ai_model')
                onApiKeyChange('')
              }}>
                Clear
              </button>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)', opacity: 0.3 }} />

          {/* Section: Appearance */}
          <div className="settings-field">
            <div className="settings-label" style={{ marginBottom: 12 }}>Visual System</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {THEMES.map(t => (
                <button
                  key={t.id}
                  className={`btn-ghost ${theme === t.id ? 'active' : ''}`}
                  onClick={() => onThemeChange(t.id)}
                  style={{
                    height: 50,
                    flexDirection: 'column',
                    fontSize: 11,
                    gap: 6,
                    border: theme === t.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: theme === t.id ? 'var(--bg4)' : 'var(--bg5)'
                  }}
                >
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: t.id === 'default' ? '#E8705A' : t.id === 'violet' ? '#A78BFA' : t.id === 'teal' ? '#2DD4BF' : '#FB7185' }} />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="settings-label">UI Scaling</div>
            <div className="settings-row" style={{ marginTop: 8 }}>
              <input
                type="range"
                min={0.9}
                max={1.1}
                step={0.01}
                value={uiScale}
                onChange={e => onUiScaleChange(parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
              <div className="settings-scale" style={{ minWidth: 40, textAlign: 'right' }}>{uiScale.toFixed(2)}</div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)', opacity: 0.3 }} />

          {/* Section: Data & Backup */}
          <div className="settings-field">
            <div className="settings-label">Data Management</div>
            <button type="button" className="btn-ghost" onClick={onExportJson} style={{ width: '100%', justifyContent: 'flex-start', border: '1px solid var(--border)', marginTop: 8 }}>
              📥 Export Vault to JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

