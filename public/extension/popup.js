// Sutra Extension — popup.js
// Full logic: auth check, page info, save signal, collections, tags

const DEFAULT_SUTRA_URL = 'https://sutra.vercel.app';

let state = {
  url: '',
  title: '',
  domain: '',
  type: 'article',
  intent: 'signal',
  note: '',
  collectionId: null,
  collectionName: null,
  tags: [],
  sutraUrl: DEFAULT_SUTRA_URL,
  apiKey: '',
  signalCount: 0,
  isLoggedIn: false,
  collections: [],
  showSettings: false,
  colDropdownOpen: false,
};

// ── INIT ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Load stored settings
  const stored = await chrome.storage.local.get(['sutraUrl', 'apiKey', 'sessionToken']);
  state.sutraUrl = stored.sutraUrl || DEFAULT_SUTRA_URL;
  state.apiKey = stored.apiKey || '';

  // Populate settings inputs
  document.getElementById('sutraUrlInput').value = state.sutraUrl;
  document.getElementById('apiKeyInput').value = state.apiKey;

  // Get current tab info
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      state.url = tab.url || '';
      state.title = tab.title || '';
      state.domain = getDomain(state.url);
      state.type = detectType(state.url);
      populatePagePreview();
    }
  } catch (e) {
    console.warn('Tab query failed:', e);
  }

  // Check auth
  await checkAuth();

  // Wire up buttons
  document.getElementById('openDashboardBtn').addEventListener('click', openDashboard);
  document.getElementById('viewLibraryBtn').addEventListener('click', openDashboard);
  document.getElementById('signInBtn').addEventListener('click', openDashboard);
  document.getElementById('settingsToggleBtn').addEventListener('click', toggleSettings);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('noteInput').addEventListener('input', e => { state.note = e.target.value; });
});

// ── AUTH CHECK ────────────────────────────────────────────────────────────────

async function checkAuth() {
  try {
    const res = await fetch(`${state.sutraUrl}/api/auth/session`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const session = await res.json();
      if (session?.user?.id) {
        state.isLoggedIn = true;
        state.userId = session.user.id;
        showMainContent();
        await Promise.all([fetchSignalCount(), fetchCollections(), fetchAutoTags()]);
        return;
      }
    }
  } catch (e) {
    console.warn('Auth check failed:', e);
  }

  // Not logged in
  showAuthState();
}

// ── PAGE PREVIEW ──────────────────────────────────────────────────────────────

function populatePagePreview() {
  const titleEl = document.getElementById('pageTitle');
  const domainEl = document.getElementById('pageDomain');
  const badgeEl = document.getElementById('pageTypeBadge');
  const faviconEl = document.getElementById('pageFavicon');

  titleEl.textContent = state.title || state.url;
  domainEl.textContent = state.domain;

  const typeConfig = {
    article:  { label: 'Article',  color: '#9B8FF5', bg: 'rgba(155,143,245,0.12)' },
    video:    { label: 'Video',    color: '#E8705A', bg: 'rgba(232,112,90,0.12)' },
    tweet:    { label: 'Tweet',    color: '#4ECDC4', bg: 'rgba(78,205,196,0.12)' },
    pdf:      { label: 'PDF',      color: '#C9A96E', bg: 'rgba(201,169,110,0.12)' },
    image:    { label: 'Image',    color: '#6BCB77', bg: 'rgba(107,203,119,0.12)' },
    note:     { label: 'Note',     color: '#C9A96E', bg: 'rgba(201,169,110,0.12)' },
  };
  const cfg = typeConfig[state.type] || typeConfig.article;
  badgeEl.textContent = cfg.label;
  badgeEl.style.color = cfg.color;
  badgeEl.style.background = cfg.bg;

  // Favicon
  if (state.domain) {
    const img = document.createElement('img');
    img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(state.domain)}&sz=32`;
    img.onerror = () => { faviconEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#4A4A58" stroke-width="1.4"/></svg>'; };
    faviconEl.innerHTML = '';
    faviconEl.appendChild(img);
  }

  // Show "Watch Later" for videos
  if (state.type === 'video') {
    document.getElementById('watchLaterBtn').style.display = 'flex';
    selectIntentByValue('watch_later');
  }
}

// ── FETCH DATA ────────────────────────────────────────────────────────────────

async function fetchSignalCount() {
  try {
    const res = await fetch(`${state.sutraUrl}/api/stats`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      state.signalCount = data.total || 0;
      document.getElementById('signalCount').textContent = state.signalCount.toLocaleString();
    }
  } catch (e) { /* silent */ }
}

async function fetchCollections() {
  try {
    const res = await fetch(`${state.sutraUrl}/api/collections`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      state.collections = Array.isArray(data) ? data : [];
      renderCollections();
    }
  } catch (e) { /* silent */ }
}

async function fetchAutoTags() {
  const tagsArea = document.getElementById('tagsArea');
  tagsArea.innerHTML = '<div class="tag-chip loading">AI tagging…</div>';

  if (!state.apiKey) {
    tagsArea.innerHTML = '';
    return;
  }

  try {
    const res = await fetch(`${state.sutraUrl}/api/tags/suggest`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-openai-api-key': state.apiKey,
      },
      body: JSON.stringify({ title: state.title, url: state.url, type: state.type }),
    });
    if (res.ok) {
      const data = await res.json();
      const tags = data.tags || [];
      state.tags = tags;
      renderTags(tags, true);
    } else {
      tagsArea.innerHTML = '';
    }
  } catch (e) {
    tagsArea.innerHTML = '';
  }
}

// ── RENDER ────────────────────────────────────────────────────────────────────

function renderTags(tags, isAI = false) {
  const area = document.getElementById('tagsArea');
  if (!tags.length) { area.innerHTML = ''; return; }
  area.innerHTML = tags.map(t =>
    `<span class="tag-chip ${isAI ? 'ai-tag' : ''}">
      ${isAI ? '<svg width="8" height="8" viewBox="0 0 8 8" fill="none"><circle cx="4" cy="4" r="3" stroke="#4a7a40" stroke-width="1"/><path d="M2.5 4l1 1 2-2" stroke="#4a7a40" stroke-width="1" stroke-linecap="round"/></svg>' : ''}
      #${t}
    </span>`
  ).join('') + (isAI ? '<span class="tag-chip ai-tag" style="margin-left:2px;">AI tagged</span>' : '');
}

function renderCollections() {
  const dropdown = document.getElementById('collectionDropdown');
  if (!state.collections.length) {
    dropdown.innerHTML = '<div class="col-empty">No collections yet. Create one in Sutra.</div>';
    return;
  }
  dropdown.innerHTML = [
    '<div class="col-option" data-id="" onclick="selectCollection(this, \'\', \'None\')"><div class="col-icon" style="background:rgba(255,255,255,0.05);">—</div><span>No collection</span></div>',
    ...state.collections.map(c =>
      `<div class="col-option" data-id="${c._id}" onclick="selectCollection(this, '${c._id}', '${escapeHtml(c.name)}')">
        <div class="col-icon" style="background:${c.color}18; color:${c.color};">${c.icon || '◈'}</div>
        <span>${escapeHtml(c.name)}</span>
      </div>`
    )
  ].join('');
}

// ── INTERACTIONS ──────────────────────────────────────────────────────────────

function selectIntent(btn) {
  document.querySelectorAll('.intent-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.intent = btn.dataset.intent || 'signal';
}

function selectIntentByValue(val) {
  document.querySelectorAll('.intent-btn').forEach(b => {
    if (b.dataset.intent === val) b.classList.add('active');
    else b.classList.remove('active');
  });
  state.intent = val;
}

function toggleCollectionDropdown() {
  state.colDropdownOpen = !state.colDropdownOpen;
  const dd = document.getElementById('collectionDropdown');
  dd.classList.toggle('visible', state.colDropdownOpen);
}

function selectCollection(el, id, name) {
  state.collectionId = id || null;
  state.collectionName = name === 'None' ? null : name;

  document.querySelectorAll('.col-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');

  const btn = document.getElementById('collectionToggleBtn');
  const label = document.getElementById('collectionLabel');

  if (id) {
    label.textContent = name.length > 14 ? name.slice(0, 12) + '…' : name;
    btn.classList.add('has-value');
  } else {
    label.textContent = 'Collection';
    btn.classList.remove('has-value');
  }

  // Close dropdown after selection
  setTimeout(() => {
    state.colDropdownOpen = false;
    document.getElementById('collectionDropdown').classList.remove('visible');
  }, 300);
}

// ── SAVE SIGNAL ───────────────────────────────────────────────────────────────

async function saveSignal() {
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="8" stroke-dashoffset="8"><animate attributeName="stroke-dashoffset" values="8;0" dur="0.6s" fill="freeze"/></circle></svg> Saving…';

  try {
    const payload = {
      url: state.url,
      title: state.title,
      type: state.type === 'auto' ? undefined : state.type,
      content: state.note.trim() || undefined,
      tags: state.tags,
      collectionIds: state.collectionId ? [state.collectionId] : [],
    };

    const headers = {
      'Content-Type': 'application/json',
      ...(state.apiKey ? { 'x-openai-api-key': state.apiKey } : {}),
    };

    const res = await fetch(`${state.sutraUrl}/api/signals`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const signal = await res.json();
      showSuccess(signal);
    } else {
      const err = await res.json().catch(() => ({}));
      showError(err.error || 'Save failed. Please try again.');
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 13L13 3M13 3H7M13 3v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg> Save signal';
    }
  } catch (e) {
    showError('Network error. Check your connection.');
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 13L13 3M13 3H7M13 3v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg> Save signal';
  }
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────

function toggleSettings() {
  state.showSettings = !state.showSettings;
  const panel = document.getElementById('settingsPanel');
  const main = document.getElementById('mainContent');
  panel.classList.toggle('visible', state.showSettings);
  main.classList.toggle('hidden', state.showSettings);
}

async function saveSettings() {
  const url = document.getElementById('sutraUrlInput').value.trim().replace(/\/$/, '');
  const key = document.getElementById('apiKeyInput').value.trim();
  state.sutraUrl = url || DEFAULT_SUTRA_URL;
  state.apiKey = key;
  await chrome.storage.local.set({ sutraUrl: state.sutraUrl, apiKey: state.apiKey });
  toggleSettings();
  // Re-check auth with new URL
  await checkAuth();
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────

function openDashboard() {
  chrome.tabs.create({ url: `${state.sutraUrl}/dashboard` });
}

// ── UI STATE HELPERS ──────────────────────────────────────────────────────────

function showAuthState() {
  document.getElementById('authState').classList.add('visible');
  document.getElementById('mainContent').classList.add('hidden');
  document.getElementById('loadingScreen').style.display = 'none';
}

function showMainContent() {
  document.getElementById('authState').classList.remove('visible');
  document.getElementById('mainContent').classList.remove('hidden');
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('captureForm').style.display = 'block';
  document.getElementById('successOverlay').classList.remove('visible');
}

function showSuccess(signal) {
  document.getElementById('captureForm').style.display = 'none';
  const overlay = document.getElementById('successOverlay');
  overlay.classList.add('visible');
  const intentLabels = {
    signal: 'Signal saved ✦',
    read_later: 'Added to Read Later',
    watch_later: 'Added to Watch Later',
    note: 'Note captured',
    constellation: 'Added to Constellation ★',
  };
  document.getElementById('successSub').textContent =
    `${intentLabels[state.intent] || 'Signal captured'}${state.collectionName ? ` · ${state.collectionName}` : ''}${signal.tags?.length ? ` · AI tagged` : ''}`;

  // Update count
  state.signalCount++;
  document.getElementById('signalCount').textContent = state.signalCount.toLocaleString();

  // Auto-close after 2.5s
  setTimeout(() => window.close(), 2500);
}

function showError(msg) {
  const btn = document.getElementById('saveBtn');
  btn.className = 'save-btn error';
  btn.textContent = `⚠ ${msg}`;
  setTimeout(() => {
    btn.className = 'save-btn';
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 13L13 3M13 3H7M13 3v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg> Save signal';
  }, 3000);
}

// ── UTILS ─────────────────────────────────────────────────────────────────────

function getDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function detectType(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('twitter.com') || u.includes('x.com')) return 'tweet';
  if (u.includes('youtube.com') || u.includes('youtu.be') || u.includes('vimeo.com')) return 'video';
  if (u.endsWith('.pdf')) return 'pdf';
  if (u.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) return 'image';
  return 'article';
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Close collection dropdown on outside click
document.addEventListener('click', (e) => {
  const dd = document.getElementById('collectionDropdown');
  const btn = document.getElementById('collectionToggleBtn');
  if (dd && btn && !dd.contains(e.target) && !btn.contains(e.target)) {
    state.colDropdownOpen = false;
    dd.classList.remove('visible');
  }
});
