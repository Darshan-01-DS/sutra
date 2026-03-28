'use client'
// src/app/account/page.tsx — Fully wired Account Settings page

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

// ── Reusable confirmation modal
function ConfirmModal({
  open, title, body, confirmLabel, confirmStyle, children, onConfirm, onCancel,
}: {
  open: boolean; title: string; body: string; confirmLabel: string; confirmStyle?: string
  children?: React.ReactNode; onConfirm: () => void; onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-body">{body}</div>
        {children}
        <div className="modal-actions">
          <button className="form-cancel" onClick={onCancel}>Cancel</button>
          <button className={confirmStyle ?? 'btn-danger'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function toast(msg: string, type: 'success' | 'error' | 'info' = 'success') {
  window.dispatchEvent(new CustomEvent('sutra-toast', { detail: { message: msg, type } }))
}

export default function AccountPage() {
  const router = useRouter()
  const { data: session, update: updateSession } = useSession()
  const [activeTab, setActiveTab] = useState('profile')

  // Profile
  const [name, setName]   = useState('')
  const [image, setImage] = useState('')
  const [bio, setBio]     = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // AI & API
  const [provider, setProvider]   = useState('openai')
  const [baseUrl, setBaseUrl]     = useState('')
  const [modelName, setModelName] = useState('gpt-4o-mini')
  const [apiKey, setApiKey]       = useState('')
  const [savingAI, setSavingAI]   = useState(false)

  // Appearance
  const [theme, setTheme]   = useState('default')
  const [uiScale, setUiScale] = useState(1)

  // Stats
  const [stats, setStats] = useState<any>(null)

  // Modals
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [clearConfirm2, setClearConfirm2]       = useState(false)
  const [deleteOpen, setDeleteOpen]             = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    try {
      setApiKey(localStorage.getItem('sutra_openai_api_key') ?? '')
      setProvider(localStorage.getItem('sutra_ai_provider') ?? 'openai')
      setBaseUrl(localStorage.getItem('sutra_ai_base_url') ?? '')
      setModelName(localStorage.getItem('sutra_ai_model') ?? 'gpt-4o-mini')
      setTheme(localStorage.getItem('sutra_theme') ?? 'default')
      setUiScale(parseFloat(localStorage.getItem('sutra_ui_scale') ?? '1'))
      fetch('/api/stats').then(r => r.json()).then(d => setStats(d)).catch(() => {})
    } catch {}
  }, [])

  useEffect(() => {
    if (session?.user) { setName(session.user.name || ''); setImage(session.user.image || '') }
  }, [session])

  const handleUpdateProfile = async () => {
    if (!name.trim()) { toast('Name is required', 'error'); return }
    setSavingProfile(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, image }),
      })
      if (res.ok) { await updateSession(); toast('Profile updated ✓') }
      else toast('Update failed', 'error')
    } catch { toast('Update failed', 'error') }
    finally { setSavingProfile(false) }
  }

  const handleSaveAI = () => {
    setSavingAI(true)
    try {
      localStorage.setItem('sutra_openai_api_key', apiKey)
      localStorage.setItem('sutra_ai_provider', provider)
      localStorage.setItem('sutra_ai_base_url', baseUrl)
      localStorage.setItem('sutra_ai_model', modelName)
      toast('AI settings saved ✓')
    } catch { toast('Failed to save settings', 'error') }
    finally { setTimeout(() => setSavingAI(false), 400) }
  }

  const handleThemeChange = (t: string) => {
    setTheme(t)
    localStorage.setItem('sutra_theme', t)
    document.documentElement.dataset.theme = t
    toast('Accent color updated ✓')
  }

  const handleExportJson = async () => {
    try {
      const res = await fetch('/api/signals?limit=10000')
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `sutra-export-${Date.now()}.json`; a.click()
      toast('Export started ✓')
    } catch { toast('Export failed', 'error') }
  }

  const handleClearSignals = async () => {
    setWorking(true)
    try {
      const res = await fetch('/api/user/signals', { method: 'DELETE' })
      if (res.ok) {
        setClearConfirmOpen(false); setClearConfirm2(false)
        toast('All signals deleted ✓')
        setStats((s: any) => s ? { ...s, total: 0, thisWeek: 0 } : s)
      } else toast('Failed to clear signals', 'error')
    } catch { toast('Failed to clear signals', 'error') }
    finally { setWorking(false) }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') { toast('Please type DELETE to confirm', 'error'); return }
    setWorking(true)
    try {
      const res = await fetch('/api/user/account', { method: 'DELETE' })
      if (res.ok) {
        toast('Account deleted')
        setTimeout(() => signOut({ callbackUrl: '/' }), 1200)
      } else toast('Failed to delete account', 'error')
    } catch { toast('Failed to delete account', 'error') }
    finally { setWorking(false) }
  }

  const NAV_ITEMS = [
    { id: 'profile',    label: 'Profile',        icon: '◈' },
    { id: 'ai',         label: 'AI & API Keys',  icon: '⬡' },
    { id: 'appearance', label: 'Appearance',      icon: '◇' },
    { id: 'billing',    label: 'Billing',         icon: '✦' },
    { id: 'data',       label: 'Data & Privacy',  icon: '⚠', color: 'var(--coral)' },
  ]

  const SWATCHES = [
    { id: 'default', color: '#C9A96E', title: 'Gold (default)' },
    { id: 'violet',  color: '#9B8FF5', title: 'Violet' },
    { id: 'teal',    color: '#4ECDC4', title: 'Teal' },
    { id: 'coral',   color: '#E8705A', title: 'Coral' },
  ]

  return (
    <div className="app" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .account-layout{display:grid;grid-template-columns:220px 1fr;height:calc(100vh - 50px)}
        .account-nav{background:var(--bg);border-right:1px solid var(--border);padding:20px 12px;display:flex;flex-direction:column;gap:2px}
        .acc-nav-label{font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);padding:10px 8px 5px}
        .acc-nav-item{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:var(--r);color:var(--text2);font-size:12.5px;cursor:pointer;transition:all .15s;border:1px solid transparent}
        .acc-nav-item:hover{background:var(--bg3);color:var(--text);transform:translateX(2px)}
        .acc-nav-item.active{background:var(--accent-bg);color:var(--accent);border-color:var(--accent-border)}
        .account-content{padding:28px 32px;overflow-y:auto;background:var(--bg2)}
        .acc-section-title{font-size:16px;font-weight:500;margin-bottom:4px}
        .acc-section-sub{font-size:12px;color:var(--text3);margin-bottom:24px}
        .acc-divider{height:1px;background:var(--border);margin:24px 0}
        .form-row{margin-bottom:16px}
        .form-label{font-size:11px;color:var(--text3);letter-spacing:.05em;text-transform:uppercase;margin-bottom:5px}
        .form-input{width:100%;height:36px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--r);padding:0 12px;color:var(--text);font-family:var(--body);font-size:13px;outline:none;transition:border-color .15s,box-shadow .15s}
        .form-input:focus{border-color:var(--accent-border);box-shadow:0 0 0 2px rgba(201,169,110,.2)}
        .form-input::placeholder{color:var(--text3)}
        .form-input-mono{font-family:'Geist Mono',monospace;font-size:11.5px}
        .form-row-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .form-save{height:32px;padding:0 16px;background:var(--accent);color:#0A0A0C;border:none;border-radius:var(--r);font-family:var(--body);font-size:12px;font-weight:500;cursor:pointer;transition:all .15s}
        .form-save:hover{opacity:.88;transform:translateY(-1px)}
        .form-save:active{transform:scale(.97)}
        .form-save:disabled{opacity:.5;cursor:not-allowed;transform:none}
        .form-cancel{height:32px;padding:0 14px;background:none;color:var(--text2);border:1px solid var(--border2);border-radius:var(--r);font-family:var(--body);font-size:12px;cursor:pointer;transition:all .15s}
        .form-cancel:hover{background:var(--bg3);color:var(--text)}
        .avatar-row{display:flex;align-items:center;gap:16px;margin-bottom:20px}
        .avatar-big{width:64px;height:64px;border-radius:50%;background:var(--accent-bg);border:2px solid var(--accent-border);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--accent);flex-shrink:0;overflow:hidden}
        .avatar-meta{flex:1}
        .avatar-name{font-size:15px;font-weight:500;margin-bottom:2px}
        .avatar-email{font-size:12px;color:var(--text3)}
        .stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
        .stat-card{background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:14px;transition:transform .15s}
        .stat-card:hover{transform:translateY(-2px)}
        .stat-val{font-size:22px;font-weight:500;color:var(--text);margin-bottom:2px}
        .stat-lbl{font-size:11px;color:var(--text3)}
        .integration-row{display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);margin-bottom:8px;transition:transform .15s}
        .integration-row:hover{transform:translateX(2px)}
        .int-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
        .int-name{font-size:13px;font-weight:500;color:var(--text)}
        .int-desc{font-size:11px;color:var(--text3);margin-top:1px}
        .int-badge-off{margin-left:auto;font-size:10px;font-weight:500;padding:3px 9px;border-radius:20px;background:var(--bg4);border:1px solid var(--border2);color:var(--text3)}
        .theme-row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}
        .swatch{width:40px;height:40px;border-radius:10px;cursor:pointer;border:2px solid transparent;transition:all .15s;position:relative}
        .swatch.active{border-color:rgba(255,255,255,.4)}
        .swatch.active::after{content:'✓';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;color:#fff;font-weight:600}
        .swatch:hover{transform:scale(1.08)}
        .danger-card{background:rgba(232,112,90,.05);border:1px solid var(--coral-border);border-radius:var(--r);padding:16px;margin-bottom:10px}
        .danger-title{font-size:13px;font-weight:500;color:var(--coral);margin-bottom:4px}
        .danger-text{font-size:11.5px;color:var(--text2);margin-bottom:12px}
        .btn-danger{height:32px;padding:0 16px;background:none;color:var(--coral);border:1px solid var(--coral-border);border-radius:var(--r);font-family:var(--body);font-size:12px;cursor:pointer;transition:all .15s}
        .btn-danger:hover{background:var(--coral-bg)}
        .btn-danger:disabled{opacity:.5;cursor:not-allowed}
        .plan-card{background:var(--bg3);border:1px solid var(--border2);border-radius:var(--r-lg);padding:16px;display:flex;align-items:center;gap:14px;margin-bottom:16px}
        .plan-icon{width:36px;height:36px;background:var(--accent-bg);border:1px solid var(--accent-border);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
        .btn-upgrade{margin-left:auto;height:32px;padding:0 16px;background:var(--accent);color:#0A0A0C;border:none;border-radius:var(--r);font-size:12px;font-weight:500;cursor:pointer;transition:all .15s}
        .btn-upgrade:hover{opacity:.88}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
        .modal-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r-lg);padding:28px;max-width:440px;width:100%;box-shadow:0 24px 80px rgba(0,0,0,.6)}
        .modal-title{font-size:16px;font-weight:500;margin-bottom:8px}
        .modal-body{font-size:13px;color:var(--text2);margin-bottom:20px;line-height:1.5}
        .modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:20px}
        .delete-type-field{width:100%;height:36px;background:var(--bg3);border:2px solid var(--coral-border);border-radius:var(--r);padding:0 12px;color:var(--text);font-family:var(--body);font-size:13px;outline:none;margin-top:8px}
      `}} />

      {/* Delete confirm modal */}
      <ConfirmModal
        open={deleteOpen}
        title="Delete your account"
        body="This permanently deletes your account and ALL your data — signals, collections, tags. This CANNOT be undone."
        confirmLabel={working ? 'Deleting…' : 'Delete my account'}
        confirmStyle="btn-danger"
        onConfirm={handleDeleteAccount}
        onCancel={() => { setDeleteOpen(false); setDeleteConfirmText('') }}
      >
        <div style={{ marginTop: -8 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Type <strong style={{ color: 'var(--coral)' }}>DELETE</strong> to confirm</div>
          <input
            className="delete-type-field"
            placeholder="DELETE"
            value={deleteConfirmText}
            onChange={e => setDeleteConfirmText(e.target.value)}
          />
        </div>
      </ConfirmModal>

      {/* Clear signals modal */}
      <ConfirmModal
        open={clearConfirmOpen}
        title="Clear all signals"
        body={`Permanently deletes all ${stats?.total ?? 0} signals, their tags, and embeddings. Collections are kept. This cannot be undone.`}
        confirmLabel={working ? 'Clearing…' : 'Yes, delete all signals'}
        confirmStyle="btn-danger"
        onConfirm={handleClearSignals}
        onCancel={() => setClearConfirmOpen(false)}
      />

      <header className="topbar" style={{ flexShrink: 0, height: 50, borderBottom: '1px solid var(--border)' }}>
        <div className="logo" onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>
          <span className="logo-word">Sutra</span>
        </div>
        <div className="topbar-actions" style={{ marginLeft: 'auto', paddingRight: 16 }}>
          <button className="form-cancel" onClick={() => router.push('/')}>← Back to Library</button>
        </div>
      </header>

      <div className="account-layout">
        {/* LEFT NAV */}
        <div className="account-nav">
          <div className="acc-nav-label">Account</div>
          {NAV_ITEMS.map(item => (
            <div
              key={item.id}
              className={`acc-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              style={item.color && activeTab !== item.id ? { color: item.color } : undefined}
            >
              <span style={{ width: 16, display: 'inline-block' }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
          <div style={{ marginTop: 'auto', paddingTop: 20 }}>
            <div style={{ height: 1, background: 'var(--border)', margin: '0 0 16px 0' }} />
            <div className="acc-nav-item" style={{ color: 'var(--text3)' }} onClick={() => signOut({ callbackUrl: '/login' })}>
              <span style={{ width: 16, display: 'inline-block' }}>⎋</span>
              Sign out
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="account-content">
          <div style={{ maxWidth: 640 }}>

            {/* PROFILE */}
            {activeTab === 'profile' && (
              <div>
                <div className="acc-section-title">Your profile</div>
                <div className="acc-section-sub">How you appear in Sutra and your personal settings</div>
                <div className="avatar-row">
                  <div className="avatar-big">
                    {image ? <img src={image} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (name?.[0]?.toUpperCase() || 'U')}
                  </div>
                  <div className="avatar-meta">
                    <div className="avatar-name">{name || 'User'}</div>
                    <div className="avatar-email">{session?.user?.email || 'user@example.com'}</div>
                  </div>
                </div>
                <div className="form-row-2">
                  <div className="form-row"><div className="form-label">Display name</div><input className="form-input" value={name} onChange={e => setName(e.target.value)} /></div>
                  <div className="form-row"><div className="form-label">Avatar URL</div><input className="form-input" value={image} onChange={e => setImage(e.target.value)} placeholder="https://..." /></div>
                </div>
                <div className="form-row"><div className="form-label">Bio (optional)</div><input className="form-input" value={bio} onChange={e => setBio(e.target.value)} placeholder="What do you think about?" /></div>
                <div className="acc-divider" />
                <div className="acc-section-title" style={{ fontSize: 14 }}>Your stats</div>
                <div style={{ marginBottom: 16 }} />
                <div className="stats-row">
                  <div className="stat-card"><div className="stat-val" style={{ color: 'var(--accent)' }}>{stats?.total ?? 0}</div><div className="stat-lbl">Total signals</div></div>
                  <div className="stat-card"><div className="stat-val" style={{ color: 'var(--violet)' }}>{Object.keys(stats?.byType ?? {}).length}</div><div className="stat-lbl">Types captured</div></div>
                  <div className="stat-card"><div className="stat-val" style={{ color: 'var(--teal)' }}>{stats?.thisWeek ?? 0}</div><div className="stat-lbl">This week</div></div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="form-save" onClick={handleUpdateProfile} disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save changes'}</button>
                  <button className="form-cancel" onClick={() => { setName(session?.user?.name || ''); setImage(session?.user?.image || '') }}>Cancel</button>
                </div>
              </div>
            )}

            {/* AI */}
            {activeTab === 'ai' && (
              <div>
                <div className="acc-section-title">AI & integrations</div>
                <div className="acc-section-sub">Connect your API key to unlock auto-tagging, semantic search, and Ask AI</div>
                <div className="form-row" style={{ marginTop: 24 }}>
                  <div className="form-label">AI Provider</div>
                  <select className="form-input" value={provider} onChange={e => {
                    const v = e.target.value; setProvider(v)
                    if (v === 'openai') { setBaseUrl(''); setModelName('gpt-4o-mini') }
                    else if (v === 'groq') { setBaseUrl('https://api.groq.com/openai/v1'); setModelName('llama3-8b-8192') }
                    else if (v === 'openrouter') { setBaseUrl('https://openrouter.ai/api/v1'); setModelName('') }
                    else if (v === 'gemini') { setBaseUrl(''); setModelName('gemini-1.5-flash') }
                    else { setBaseUrl(''); setModelName('') }
                  }}>
                    <option value="openai">OpenAI (Default)</option>
                    <option value="groq">Groq</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="custom">Custom (Ollama / Local)</option>
                  </select>
                </div>
                {(provider !== 'openai' && provider !== 'gemini') && (
                  <div className="form-row-2">
                    <div className="form-row"><div className="form-label">Base URL</div><input className="form-input" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} /></div>
                    <div className="form-row"><div className="form-label">Model Name</div><input className="form-input" value={modelName} onChange={e => setModelName(e.target.value)} placeholder={
                      provider === 'openrouter' ? 'e.g. meta-llama/llama-3-8b-instruct:free' :
                      provider === 'groq' ? 'e.g. llama3-8b-8192' :
                      'e.g. llama3'
                    } /></div>
                  </div>
                )}
                {provider === 'gemini' && (
                  <div className="form-row"><div className="form-label">Gemini Model</div><input className="form-input" value={modelName} onChange={e => setModelName(e.target.value)} placeholder="gemini-1.5-flash" /></div>
                )}
                <div className="form-row">
                  <div className="form-label">{provider === 'openai' ? 'OpenAI API Key' : provider === 'gemini' ? 'Google AI API Key' : 'Provider API Key'}</div>
                  <input className="form-input form-input-mono" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={
                    provider === 'gemini' ? 'AIza...' : provider === 'openai' ? 'sk-proj-...' : 'API key...'
                  } />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16, padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
                  Your key is stored locally in your browser only.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="form-save" onClick={handleSaveAI} disabled={savingAI}>{savingAI ? 'Saving…' : 'Save AI Configuration'}</button>
                  <button className="form-cancel" onClick={() => setApiKey('')}>Clear Key</button>
                </div>
              </div>
            )}

            {/* APPEARANCE */}
            {activeTab === 'appearance' && (
              <div>
                <div className="acc-section-title">Appearance</div>
                <div className="acc-section-sub">Customize how Sutra looks and feels</div>
                <div className="form-label" style={{ marginBottom: 10 }}>Accent color</div>
                <div className="theme-row" style={{ marginBottom: 20 }}>
                  {SWATCHES.map(s => (
                    <div key={s.id} className={`swatch ${theme === s.id ? 'active' : ''}`} style={{ background: s.color }} title={s.title} onClick={() => handleThemeChange(s.id)} />
                  ))}
                </div>
                <div className="form-row">
                  <div className="form-label">UI Scaling ({uiScale.toFixed(2)})</div>
                  <input type="range" min={0.9} max={1.1} step={0.01} value={uiScale}
                    onChange={e => { const v = parseFloat(e.target.value); setUiScale(v); localStorage.setItem('sutra_ui_scale', v.toString()); (document.body as any).style.zoom = v.toString() }}
                    style={{ width: '100%', maxWidth: 300, display: 'block' }} />
                </div>
                <button className="form-save" style={{ marginTop: 16 }} onClick={() => toast('Preferences saved ✓')}>Save preferences</button>
              </div>
            )}

            {/* BILLING */}
            {activeTab === 'billing' && (
              <div>
                <div className="acc-section-title">Plan & billing</div>
                <div className="acc-section-sub">Manage your subscription and usage</div>
                <div className="plan-card">
                  <div className="plan-icon">✦</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>Free plan</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{stats?.total ?? 0}/500 signals · Basic search</div>
                  </div>
                  <button className="btn-upgrade">Upgrade to Pro →</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 16 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Pro — monthly</div>
                    <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 2 }}>$9<span style={{ fontSize: 13, color: 'var(--text3)' }}>/mo</span></div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Unlimited signals · AI tagging · Semantic search</div>
                  </div>
                  <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r)', padding: 16 }}>
                    <div style={{ fontSize: 11, color: 'var(--accent2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Pro — annual (save 33%)</div>
                    <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--accent)', marginBottom: 2 }}>$6<span style={{ fontSize: 13, color: 'var(--accent2)' }}>/mo</span></div>
                    <div style={{ fontSize: 11, color: 'var(--accent2)' }}>$72/year · Best value</div>
                  </div>
                </div>
              </div>
            )}

            {/* DATA */}
            {activeTab === 'data' && (
              <div>
                <div className="acc-section-title">Data & privacy</div>
                <div className="acc-section-sub">Export or permanently delete your Sutra data</div>
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 16, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>Export all signals</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Download your entire library as JSON</div>
                  </div>
                  <button className="form-save" onClick={handleExportJson}>Export JSON</button>
                </div>
                <div className="acc-divider" />
                <div className="danger-card">
                  <div className="danger-title">⚠ Clear all signals</div>
                  <div className="danger-text">Permanently deletes all {stats?.total ?? 0} signals, tags, and embeddings. Collections are preserved. This cannot be undone.</div>
                  <button className="btn-danger" onClick={() => setClearConfirmOpen(true)}>Clear all signals</button>
                </div>
                <div className="danger-card">
                  <div className="danger-title">⚠ Delete account</div>
                  <div className="danger-text">Permanently deletes your account, all signals, collections, and settings. Your data cannot be recovered.</div>
                  <button className="btn-danger" onClick={() => setDeleteOpen(true)}>Delete my account</button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
