'use client'
// src/app/account/page.tsx

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

export default function AccountPage() {
  const router = useRouter()
  const { data: session, update: updateSession } = useSession()
  const [activeTab, setActiveTab] = useState('profile')
  
  // Profile
  const [name, setName] = useState('')
  const [image, setImage] = useState('')
  const [bio, setBio] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // AI & API
  const [provider, setProvider] = useState('openai')
  const [baseUrl, setBaseUrl] = useState('')
  const [modelName, setModelName] = useState('gpt-4o-mini')
  const [apiKey, setApiKey] = useState('')
  
  // Appearance
  const [theme, setTheme] = useState('default')
  const [uiScale, setUiScale] = useState(1)

  // Stats
  const [stats, setStats] = useState<any>(null)

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
    if (session?.user) {
      setName(session.user.name || '')
      setImage(session.user.image || '')
    }
  }, [session])

  const handleUpdateProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, image })
      })
      if (res.ok) {
        await updateSession()
        window.dispatchEvent(new CustomEvent('sutra-toast', { detail: { message: 'Profile updated!', type: 'success' } }))
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sutra-toast', { detail: { message: 'Update failed', type: 'error' } }))
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveAI = () => {
    localStorage.setItem('sutra_openai_api_key', apiKey)
    localStorage.setItem('sutra_ai_provider', provider)
    localStorage.setItem('sutra_ai_base_url', baseUrl)
    localStorage.setItem('sutra_ai_model', modelName)
    window.dispatchEvent(new CustomEvent('sutra-toast', { detail: { message: 'AI Settings saved!', type: 'success' } }))
  }

  const handleThemeChange = (t: string) => {
    setTheme(t)
    localStorage.setItem('sutra_theme', t)
    document.documentElement.dataset.theme = t
  }

  const handleExportJson = async () => {
    const res = await fetch('/api/signals?limit=10000')
    const data = await res.json()
    const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sutra-export-${Date.now()}.json`
    a.click()
  }

  const NAV_ITEMS = [
    { id: 'profile', label: 'Profile', icon: '◈' },
    { id: 'ai', label: 'AI & API Keys', icon: '⬡' },
    { id: 'appearance', label: 'Appearance', icon: '◇' },
    { id: 'billing', label: 'Billing', icon: '✦' },
    { id: 'data', label: 'Data & Privacy', icon: '⚠', color: 'var(--coral)' },
  ]

  const SWATCHES = [
    { id: 'default', color: '#C9A96E', title: 'Gold (default)' },
    { id: 'violet', color: '#9B8FF5', title: 'Violet' },
    { id: 'teal', color: '#4ECDC4', title: 'Teal' },
    { id: 'coral', color: '#E8705A', title: 'Coral' },
  ]

  return (
    <div className="app" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .account-layout{display:grid;grid-template-columns:220px 1fr;height:calc(100vh - 50px)}
        .account-nav{background:var(--bg);border-right:1px solid var(--border);padding:20px 12px;display:flex;flex-direction:column;gap:2px}
        .acc-nav-label{font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);padding:10px 8px 5px}
        .acc-nav-item{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:var(--r);color:var(--text2);font-size:12.5px;cursor:pointer;transition:all .12s;border:1px solid transparent}
        .acc-nav-item:hover{background:var(--bg3);color:var(--text)}
        .acc-nav-item.active{background:var(--accent-bg);color:var(--accent);border-color:var(--accent-border)}
        .account-content{padding:28px 32px;overflow-y:auto;background:var(--bg2)}
        .acc-section-title{font-size:16px;font-weight:500;margin-bottom:4px}
        .acc-section-sub{font-size:12px;color:var(--text3);margin-bottom:24px}
        .acc-divider{height:1px;background:var(--border);margin:24px 0}

        .form-row{margin-bottom:16px}
        .form-label{font-size:11px;color:var(--text3);letter-spacing:.05em;text-transform:uppercase;margin-bottom:5px}
        .form-input{width:100%;height:36px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--r);padding:0 12px;color:var(--text);font-family:var(--body);font-size:13px;outline:none;transition:border-color .15s}
        .form-input:focus{border-color:var(--accent-border)}
        .form-input::placeholder{color:var(--text3)}
        .form-input-mono{font-family:'Geist Mono',monospace;font-size:11.5px}
        .form-row-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .form-save{height:32px;padding:0 16px;background:var(--accent);color:#0A0A0C;border:none;border-radius:var(--r);font-family:var(--body);font-size:12px;font-weight:500;cursor:pointer;transition:opacity .15s}
        .form-save:hover{opacity:.88}
        .form-save:disabled{opacity: 0.5; cursor: not-allowed}
        .form-cancel{height:32px;padding:0 14px;background:none;color:var(--text2);border:1px solid var(--border2);border-radius:var(--r);font-family:var(--body);font-size:12px;cursor:pointer;transition:all .15s}
        .form-cancel:hover{background:var(--bg3);color:var(--text)}

        .avatar-row{display:flex;align-items:center;gap:16px;margin-bottom:20px}
        .avatar-big{width:64px;height:64px;border-radius:50%;background:var(--accent-bg);border:2px solid var(--accent-border);display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:22px;color:var(--accent);flex-shrink:0;overflow:hidden}
        .avatar-meta{flex:1}
        .avatar-name{font-size:15px;font-weight:500;margin-bottom:2px}
        .avatar-email{font-size:12px;color:var(--text3)}
        .btn-change-photo{height:28px;padding:0 12px;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;color:var(--text2);font-size:11px;font-family:var(--body);cursor:pointer;margin-top:6px;transition:all .15s}
        .btn-change-photo:hover{background:var(--bg4);color:var(--text)}

        .stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
        .stat-card{background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:14px}
        .stat-val{font-size:22px;font-weight:500;color:var(--text);margin-bottom:2px}
        .stat-lbl{font-size:11px;color:var(--text3)}

        .integration-row{display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);margin-bottom:8px}
        .int-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
        .int-name{font-size:13px;font-weight:500;color:var(--text)}
        .int-desc{font-size:11px;color:var(--text3);margin-top:1px}
        .int-badge-on{margin-left:auto;font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;padding:3px 9px;border-radius:20px;background:var(--teal-bg);border:1px solid var(--teal-border);color:var(--teal)}
        .int-badge-off{margin-left:auto;font-size:10px;font-weight:500;padding:3px 9px;border-radius:20px;background:var(--bg4);border:1px solid var(--border2);color:var(--text3);cursor:pointer}
        .int-badge-off:hover{border-color:var(--border3);color:var(--text2)}

        .theme-row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}
        .swatch{width:40px;height:40px;border-radius:10px;cursor:pointer;border:2px solid transparent;transition:all .15s;position:relative}
        .swatch.active::after{content:'✓';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;color:#fff;font-weight:600}
        .swatch:hover{transform:scale(1.08)}

        .danger-card{background:rgba(232,112,90,0.05);border:1px solid var(--coral-border);border-radius:var(--r);padding:16px}
        .danger-title{font-size:13px;font-weight:500;color:var(--coral);margin-bottom:4px}
        .danger-text{font-size:11.5px;color:var(--text2);margin-bottom:12px}
        .btn-danger{height:32px;padding:0 16px;background:none;color:var(--coral);border:1px solid var(--coral-border);border-radius:var(--r);font-family:var(--body);font-size:12px;cursor:pointer;transition:all .15s}
        .btn-danger:hover{background:var(--coral-bg)}

        .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
        .badge-pro{background:var(--accent-bg);border:1px solid var(--accent-border);color:var(--accent)}
        .badge-free{background:var(--bg4);border:1px solid var(--border2);color:var(--text3)}
        .plan-card{background:var(--bg3);border:1px solid var(--border2);border-radius:var(--r-lg);padding:16px;display:flex;align-items:center;gap:14px;margin-bottom:16px}
        .plan-icon{width:36px;height:36px;background:var(--accent-bg);border:1px solid var(--accent-border);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
        .plan-name{font-size:14px;font-weight:500}
        .plan-desc{font-size:11px;color:var(--text3);margin-top:2px}
        .btn-upgrade{margin-left:auto;height:32px;padding:0 16px;background:var(--accent);color:#0A0A0C;border:none;border-radius:var(--r);font-size:12px;font-weight:500;cursor:pointer;flex-shrink:0}
      `}} />

      <header className="topbar" style={{ flexShrink: 0, height: 50, borderBottom: '1px solid var(--border)' }}>
        <div className="logo" onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>
          <span className="logo-word">Sutra</span>
        </div>
        <div className="topbar-actions" style={{ marginLeft: 'auto', paddingRight: 16 }}>
          <button className="form-cancel" onClick={() => router.push('/')}>
            ← Back to Library
          </button>
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
            <div className="acc-divider" style={{ margin: '0 0 16px 0' }} />
            <div 
              className="acc-nav-item" 
              style={{ color: 'var(--text3)' }}
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <span style={{ width: 16, display: 'inline-block' }}>⎋</span>
              Sign out
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="account-content">
          <div style={{ maxWidth: 640 }}>
            
            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <div className="panel on">
                <div className="acc-section-title">Your profile</div>
                <div className="acc-section-sub">How you appear in Sutra and your personal settings</div>
                <div className="avatar-row">
                  <div className="avatar-big">
                    {image ? <img src={image} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} /> : (name?.[0] || 'U')}
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
                
                <div className="acc-divider"></div>
                <div className="acc-section-title" style={{fontSize:14}}>Your stats</div>
                <div style={{marginBottom:16}}></div>
                <div className="stats-row">
                  <div className="stat-card"><div className="stat-val" style={{color:'var(--accent)'}}>{stats?.totalSignals || 0}</div><div className="stat-lbl">Total signals</div></div>
                  <div className="stat-card"><div className="stat-val" style={{color:'var(--violet)'}}>{stats?.collections?.length || 0}</div><div className="stat-lbl">Collections</div></div>
                  <div className="stat-card"><div className="stat-val" style={{color:'var(--teal)'}}>{stats?.activityCount || 0}</div><div className="stat-lbl">Recent activities</div></div>
                </div>
                
                <div style={{display:'flex', gap:8, marginTop:8}}>
                  <button className="form-save" onClick={handleUpdateProfile} disabled={savingProfile}>
                    {savingProfile ? 'Saving...' : 'Save changes'}
                  </button>
                  <button className="form-cancel" onClick={() => {
                    setName(session?.user?.name || '')
                    setImage(session?.user?.image || '')
                  }}>Cancel</button>
                </div>
              </div>
            )}

            {/* AI TAB */}
            {activeTab === 'ai' && (
              <div className="panel on">
                <div className="acc-section-title">AI & integrations</div>
                <div className="acc-section-sub">Connect your OpenAI key to unlock auto-tagging, semantic search, and knowledge graph</div>
                
                <div className="form-row" style={{ marginTop: 24 }}>
                  <div className="form-label">AI Provider</div>
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
                    <div className="form-row"><div className="form-label">Base URL</div><input className="form-input" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} /></div>
                    <div className="form-row"><div className="form-label">Model Name</div><input className="form-input" value={modelName} onChange={e => setModelName(e.target.value)} /></div>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-label">{provider === 'openai' ? 'OpenAI API key' : 'Provider API Key'}</div>
                  <input className="form-input form-input-mono" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-proj-..." />
                </div>

                <div style={{fontSize:11, color:'var(--text3)', marginBottom:16, padding:'10px 12px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--r)'}}>
                  Your key is stored locally in your browser and sent securely only to our API and your selected AI provider.
                </div>
                <div style={{fontSize:12, color:'var(--text2)', marginBottom:20}}>
                  <span style={{color:'var(--teal)'}}>✓ Enabled</span>&nbsp;Auto-tagging &nbsp;·&nbsp;
                  <span style={{color:'var(--teal)'}}>✓ Enabled</span>&nbsp;Semantic search &nbsp;·&nbsp;
                  <span style={{color:'var(--teal)'}}>✓ Enabled</span>&nbsp;Ask AI
                </div>
                
                <div className="acc-divider"></div>
                <div className="acc-section-title" style={{fontSize:14, marginBottom:4}}>Connected services</div>
                <div style={{fontSize:12, color:'var(--text3)', marginBottom:16}}>Import content from external sources</div>
                
                <div className="integration-row">
                  <div className="int-icon" style={{background:'var(--teal-bg)'}}>𝕏</div>
                  <div><div className="int-name">Twitter / X Bookmarks</div><div className="int-desc">Auto-import your saved tweets</div></div>
                  <div className="int-badge-off">Coming Soon</div>
                </div>
                <div className="integration-row">
                  <div className="int-icon" style={{background:'var(--coral-bg)'}}>▶</div>
                  <div><div className="int-name">YouTube Watch Later</div><div className="int-desc">Sync videos you saved</div></div>
                  <div className="int-badge-off">Coming Soon</div>
                </div>
                <div className="integration-row">
                  <div className="int-icon" style={{background:'var(--violet-bg)'}}>N</div>
                  <div><div className="int-name">Notion Import</div><div className="int-desc">One-time import from Notion pages</div></div>
                  <div className="int-badge-off">Coming Soon</div>
                </div>
                
                <div style={{display:'flex', gap:8, marginTop:16}}>
                  <button className="form-save" onClick={handleSaveAI}>Save AI Configuration</button>
                  <button className="form-cancel" onClick={() => setApiKey('')}>Clear Key</button>
                </div>
              </div>
            )}

            {/* APPEARANCE TAB */}
            {activeTab === 'appearance' && (
               <div className="panel on">
                 <div className="acc-section-title">Appearance</div>
                 <div className="acc-section-sub">Customize how Sutra looks and feels</div>
                 
                 <div className="form-label" style={{marginBottom:10}}>Accent color</div>
                 <div className="theme-row" style={{marginBottom:20}}>
                   {SWATCHES.map(s => (
                     <div 
                       key={s.id}
                       className={`swatch ${theme === s.id ? 'active' : ''}`} 
                       style={{background: s.color}} 
                       title={s.title}
                       onClick={() => handleThemeChange(s.id)}
                     ></div>
                   ))}
                 </div>
                 
                 <div className="form-row">
                  <div className="form-label">UI Scaling ({uiScale.toFixed(2)})</div>
                  <input
                    type="range"
                    min={0.9}
                    max={1.1}
                    step={0.01}
                    value={uiScale}
                    onChange={e => {
                      const v = parseFloat(e.target.value)
                      setUiScale(v)
                      localStorage.setItem('sutra_ui_scale', v.toString())
                      document.body.style.zoom = v.toString()
                    }}
                    style={{ width: '100%', maxWidth: 300, display: 'block' }}
                  />
                 </div>
                 
                 <button className="form-save" style={{marginTop: 16}} onClick={() => window.dispatchEvent(new CustomEvent('sutra-toast', { detail: { message: 'Preferences saved', type: 'success' } }))}>Save preferences</button>
               </div>
            )}

            {/* BILLING TAB */}
            {activeTab === 'billing' && (
              <div className="panel on">
                <div className="acc-section-title">Plan & billing</div>
                <div className="acc-section-sub">Manage your subscription and usage</div>
                
                <div className="plan-card">
                  <div className="plan-icon">✦</div>
                  <div>
                    <div className="plan-name">Free plan <span className="badge badge-free" style={{marginLeft:6}}>Free</span></div>
                    <div className="plan-desc">{stats?.totalSignals ?? 0}/500 signals · Basic search</div>
                  </div>
                  <button className="btn-upgrade">Upgrade to Pro →</button>
                </div>
                
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20}}>
                  <div style={{background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:16}}>
                    <div style={{fontSize:11, color:'var(--text3)', marginBottom:6, textTransform:'uppercase', letterSpacing:'.06em'}}>Pro — monthly</div>
                    <div style={{fontSize:22, fontWeight:500, color:'var(--text)', marginBottom:2}}>$9<span style={{fontSize:13, color:'var(--text3)'}}>/mo</span></div>
                    <div style={{fontSize:11, color:'var(--text3)'}}>Unlimited signals · AI tagging · Semantic search</div>
                  </div>
                  <div style={{background:'var(--accent-bg)', border:'1px solid var(--accent-border)', borderRadius:'var(--r)', padding:16}}>
                    <div style={{fontSize:11, color:'var(--accent2)', marginBottom:6, textTransform:'uppercase', letterSpacing:'.06em'}}>Pro — annual (save 33%)</div>
                    <div style={{fontSize:22, fontWeight:500, color:'var(--accent)', marginBottom:2}}>$6<span style={{fontSize:13, color:'var(--accent2)'}}>/mo</span></div>
                    <div style={{fontSize:11, color:'var(--accent2)'}}>$72/year · Best value · All Pro features</div>
                  </div>
                </div>
              </div>
            )}

            {/* DATA TAB */}
            {activeTab === 'data' && (
              <div className="panel on">
                <div className="acc-section-title">Data & privacy</div>
                <div className="acc-section-sub">Export or permanently delete your Sutra data</div>
                
                <div style={{background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:16, marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontSize:13, fontWeight:500, marginBottom:2}}>Export all signals</div>
                    <div style={{fontSize:11, color:'var(--text3)'}}>Download your entire library as JSON</div>
                  </div>
                  <button className="form-save" onClick={handleExportJson}>Export JSON</button>
                </div>
                
                <div className="acc-divider"></div>
                
                <div className="danger-card" style={{marginBottom:10}}>
                  <div className="danger-title">⚠ Clear all signals</div>
                  <div className="danger-text">Permanently deletes all {stats?.totalSignals ?? 0} signals, tags, and embeddings. Collections are preserved. This cannot be undone.</div>
                  <button className="btn-danger">Clear all signals</button>
                </div>
                
                <div className="danger-card">
                  <div className="danger-title">⚠ Delete account</div>
                  <div className="danger-text">Permanently deletes your account, all signals, collections, and settings. Your data cannot be recovered.</div>
                  <button className="btn-danger">Delete my account</button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
