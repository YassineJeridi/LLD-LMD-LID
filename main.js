/* ═══════════════════════════════════════════════════════════
   SQL Learning Hub — main.js
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ─── Constants ──────────────────────────────────────────────
const DATA_FILES = [
    { id: 'ldd', file: 'data/ldd.json', icon: '🏗️', color: 'ldd' },
    { id: 'lmd', file: 'data/lmd.json', icon: '✏️', color: 'lmd' },
    { id: 'lid', file: 'data/lid.json', icon: '🔍', color: 'lid' },
    { id: 'php', file: 'data/php.json', icon: '🐘', color: 'php' },
];

const STORAGE_KEYS = {
    theme: 'sql-hub-theme',
    progress: 'sql-hub-progress',
    open: 'sql-hub-open-categories',
};

// ─── State ───────────────────────────────────────────────────
let allData = [];        // [{id, title, subtitle, description, sections, icon, color}]
let progress = {};        // { "ldd-create-table": true, ... }
let openCategories = new Set(); // which sidebar categories are expanded

// ─── DOM Refs ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = {
    splash: $('splash'),
    splashStart: $('splash-start'),
    app: $('app'),
    sidebarNav: $('sidebar-nav'),
    sidebar: $('sidebar'),
    sidebarOverlay: $('sidebar-overlay'),
    menuToggle: $('menu-toggle'),
    themeToggle: $('theme-toggle'),
    themeMoon: $('theme-icon-moon'),
    themeSun: $('theme-icon-sun'),
    searchInput: $('search-input'),
    searchResults: $('search-results'),
    contentArea: $('content-area'),
    backToTop: $('back-to-top'),
    progressBadge: $('progress-badge'),
    progressText: $('progress-text'),
    mainContent: $('main-content'),
};

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
async function init() {
    loadTheme();
    loadProgress();

    el.splashStart.addEventListener('click', enterApp);

    try {
        showSkeleton();
        allData = await fetchAllData();
        buildSidebar();
        renderCategory(allData[0].id);
        updateProgressBadge();
    } catch (err) {
        console.error('Failed to load SQL data:', err);
        el.contentArea.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <div style="font-size:48px;margin-bottom:16px">⚠️</div>
        <p style="font-size:16px">Impossible de charger les fichiers de données. Assurez-vous d'exécuter ce projet depuis un serveur local.</p>
        <p style="font-size:13px;margin-top:8px">Essayez : <code style="font-family:var(--font-mono)">npx serve .</code> dans le dossier du projet.</p>
      </div>`;
    }
}

function enterApp() {
    el.splash.style.opacity = '0';
    el.splash.style.transition = 'opacity 0.4s ease';
    setTimeout(() => {
        el.splash.classList.add('hidden');
        el.app.classList.remove('hidden');
        requestAnimationFrame(() => el.app.classList.add('visible'));
    }, 400);
}

// ═══════════════════════════════════════════════════════════
// DATA FETCHING
// ═══════════════════════════════════════════════════════════
async function fetchAllData() {
    const results = await Promise.all(
        DATA_FILES.map(async meta => {
            const res = await fetch(meta.file);
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${meta.file}`);
            const json = await res.json();
            return { ...json, icon: meta.icon, color: meta.color };
        })
    );
    return results;
}

// ═══════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════
function buildSidebar() {
    const nav = el.sidebarNav;
    nav.innerHTML = '';

    allData.forEach((cat, catIdx) => {
        // Restore open state (default: first category open)
        const savedOpen = JSON.parse(localStorage.getItem(STORAGE_KEYS.open) || '[]');
        if (savedOpen.length === 0 && catIdx === 0) openCategories.add(cat.id);
        if (savedOpen.includes(cat.id)) openCategories.add(cat.id);

        // Category header
        const catEl = document.createElement('div');
        catEl.className = 'sidebar-category' + (openCategories.has(cat.id) ? ' open' : '');
        catEl.dataset.id = cat.id;
        catEl.innerHTML = `
      <span class="sidebar-category-icon">${cat.icon}</span>
      <span class="sidebar-category-label">${cat.id.toUpperCase()}</span>
      <span class="sidebar-category-tag">${cat.sections.length}</span>
      <svg class="sidebar-category-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>`;

        catEl.addEventListener('click', () => toggleCategory(cat.id));

        // Items list
        const itemsEl = document.createElement('div');
        itemsEl.className = 'sidebar-items' + (openCategories.has(cat.id) ? ' open' : '');
        itemsEl.id = `sidebar-items-${cat.id}`;

        cat.sections.forEach(section => {
            const key = progressKey(cat.id, section.id);
            const done = !!progress[key];

            const item = document.createElement('div');
            item.className = 'sidebar-item';
            item.dataset.catId = cat.id;
            item.dataset.sectionId = section.id;
            item.id = `nav-${cat.id}-${section.id}`;
            item.innerHTML = `
        <span class="sidebar-item-check ${done ? 'done' : ''}" data-key="${key}" title="Marquer comme fait"></span>
        <span class="sidebar-item-label">${section.name}</span>`;

            // Navigate to section on click
            item.addEventListener('click', e => {
                if (e.target.classList.contains('sidebar-item-check')) return;
                navigateTo(cat.id, section.id);
                closeMobileSidebar();
            });

            // Toggle done on check click
            item.querySelector('.sidebar-item-check').addEventListener('click', e => {
                e.stopPropagation();
                window._toggleDoneWithToast
                    ? window._toggleDoneWithToast(cat.id, section.id)
                    : toggleDone(cat.id, section.id);
            });

            itemsEl.appendChild(item);
        });

        if (catIdx < allData.length - 1) {
            const divider = document.createElement('div');
            divider.className = 'sidebar-divider';
            nav.appendChild(catEl);
            nav.appendChild(itemsEl);
            nav.appendChild(divider);
        } else {
            nav.appendChild(catEl);
            nav.appendChild(itemsEl);
        }
    });
}

function toggleCategory(catId) {
    const catEl = el.sidebarNav.querySelector(`.sidebar-category[data-id="${catId}"]`);
    const listEl = $(`sidebar-items-${catId}`);

    if (openCategories.has(catId)) {
        openCategories.delete(catId);
        catEl.classList.remove('open');
        listEl.classList.remove('open');
    } else {
        openCategories.add(catId);
        catEl.classList.add('open');
        listEl.classList.add('open');
    }

    localStorage.setItem(STORAGE_KEYS.open, JSON.stringify([...openCategories]));
}

function setActiveSidebarItem(catId, sectionId) {
    document.querySelectorAll('.sidebar-item.active').forEach(el => el.classList.remove('active'));
    const item = $(`nav-${catId}-${sectionId}`);
    if (item) {
        item.classList.add('active');
        // Ensure the category is open
        if (!openCategories.has(catId)) toggleCategory(catId);
    }
}

// ═══════════════════════════════════════════════════════════
// CONTENT RENDERING
// ═══════════════════════════════════════════════════════════
function renderFirstCategory() {
    if (allData.length > 0) {
        renderCategory(allData[0].id);
    }
}

function renderCategory(catId) {
    const cat = allData.find(c => c.id === catId);
    if (!cat) return;

    el.searchInput.value = '';
    el.searchResults.classList.add('hidden');
    el.contentArea.classList.remove('hidden');

    const totalSections = cat.sections.length;
    const doneSections = cat.sections.filter(s => !!progress[progressKey(cat.id, s.id)]).length;
    const pct = totalSections > 0 ? Math.round((doneSections / totalSections) * 100) : 0;

    let html = `
    <div class="category-banner" data-id="${cat.id}">
      <div class="category-banner-header">
        <span class="category-banner-icon">${cat.icon}</span>
        <h2>${cat.title}<span>${cat.subtitle}</span></h2>
      </div>
      <p class="category-banner-desc">${cat.description}</p>
      <div class="category-banner-meta">
        <span class="category-tag ${cat.id}-tag">${cat.id.toUpperCase()}</span>
        <span style="font-size:13px;color:var(--text-muted)">${totalSections} sujets</span>
        <span style="font-size:13px;color:var(--text-muted)">·</span>
        <span style="font-size:13px;color:var(--text-muted)">${doneSections} terminés</span>
      </div>
      <div class="progress-bar-wrap" style="margin-top:16px;margin-bottom:0">
        <div class="progress-bar-fill" style="width:${pct}%"></div>
      </div>
    </div>`;

    cat.sections.forEach((section, idx) => {
        html += renderSectionCard(cat.id, section, idx + 1);
    });

    el.contentArea.innerHTML = html;
    el.mainContent.scrollTo({ top: 0, behavior: 'instant' });

    // Wire up section card events
    bindSectionCards(cat.id);
}

function renderSectionCard(catId, section, num) {
    const key = progressKey(catId, section.id);
    const done = !!progress[key];

    const syntaxHtml = section.syntax
        ? `<div class="syntax-block">
        <div class="syntax-block-label">Syntaxe</div>
        <div class="code-block">
          <div class="code-block-header">
            <span class="code-block-lang">SQL</span>
            <button class="copy-btn" data-code="${escHtml(section.syntax)}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            </button>
          </div>
          <pre><code>${escHtml(section.syntax)}</code></pre>
        </div>
       </div>`
        : '';

    const examplesHtml = section.examples && section.examples.length
        ? `<div class="examples-label">Exemples</div>
       ${section.examples.map((ex, i) => {
            const outputHtml = ex.output
                ? `<div class="example-output">
                    <div class="example-output-label">Résultat</div>
                    <div class="example-output-table-wrap">
                      <table class="example-output-table">
                        <thead><tr>${ex.output.columns.map(c => `<th>${escHtml(c)}</th>`).join('')}</tr></thead>
                        <tbody>${ex.output.rows.map(row => `<tr>${row.map(cell => `<td>${escHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
                      </table>
                    </div>
                  </div>`
                : '';
            const questionHtml = ex.question
                ? `<div class="example-question">❓ ${escHtml(ex.question)}</div>`
                : '';
            return `
         <div class="example-block">
           <div class="example-title">
             <span class="example-num">${i + 1}</span>
             ${escHtml(ex.title)}
           </div>
           ${questionHtml}
           <div class="example-code-wrap">
             <pre><code>${escHtml(ex.code)}</code></pre>
             <button class="example-copy-btn" data-code="${escHtml(ex.code)}">
               <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
               Copy
             </button>
             <div class="example-explanation">${escHtml(ex.explanation)}</div>
           </div>
           ${outputHtml}
         </div>`;
        }).join('')}`
        : '';

    return `
    <div class="section-card" id="section-${catId}-${section.id}">
      <div class="section-card-header" data-cat="${catId}" data-section="${section.id}">
        <div class="section-number">${num}</div>
        <h3>${escHtml(section.name)}</h3>
        <button class="section-done-btn ${done ? 'done' : ''}" data-cat="${catId}" data-section="${section.id}">
          ${done ? '✓ Terminé' : 'Marquer fait'}
        </button>
        <svg class="section-card-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div class="section-card-body" id="body-${catId}-${section.id}">
        <div class="section-explanation">${escHtml(section.explanation)}</div>
        ${syntaxHtml}
        ${examplesHtml}
      </div>
    </div>`;
}

function bindSectionCards(catId) {
    // Toggle card open/close
    el.contentArea.querySelectorAll('.section-card-header').forEach(header => {
        header.addEventListener('click', e => {
            if (e.target.closest('.section-done-btn')) return;
            const sId = header.dataset.section;
            const body = $(`body-${catId}-${sId}`);
            const arrow = header.querySelector('.section-card-toggle');
            body.classList.toggle('open');
            arrow.classList.toggle('open');
        });
    });

    // Mark done buttons (in cards)
    el.contentArea.querySelectorAll('.section-done-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            toggleDone(btn.dataset.cat, btn.dataset.section);
        });
    });

    // Copy buttons (syntax)
    el.contentArea.querySelectorAll('.copy-btn, .example-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => copyCode(btn));
    });
}

function navigateTo(catId, sectionId) {
    // If we're not already on this category, render it first
    const banner = el.contentArea.querySelector('.category-banner');
    if (!banner || banner.dataset.id !== catId) {
        renderCategory(catId);
    }

    setActiveSidebarItem(catId, sectionId);

    // Open the card and scroll to it
    setTimeout(() => {
        const card = $(`section-${catId}-${sectionId}`);
        if (!card) return;
        const body = $(`body-${catId}-${sectionId}`);
        const arrow = card.querySelector('.section-card-toggle');
        if (body && !body.classList.contains('open')) {
            body.classList.add('open');
            arrow && arrow.classList.add('open');
        }
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
}

// ═══════════════════════════════════════════════════════════
// PROGRESS TRACKING
// ═══════════════════════════════════════════════════════════
function progressKey(catId, sectionId) {
    return `${catId} -${sectionId} `;
}

function loadProgress() {
    try {
        progress = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) || '{}');
    } catch { progress = {}; }
}

function saveProgress() {
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progress));
}

function toggleDone(catId, sectionId) {
    const key = progressKey(catId, sectionId);
    progress[key] = !progress[key];
    saveProgress();

    // Update sidebar check
    const check = el.sidebarNav.querySelector(`.sidebar-item-check[data-key="${key}"]`);
    if (check) check.classList.toggle('done', !!progress[key]);

    // Update card button
    const btn = el.contentArea.querySelector(`.section-done-btn[data-cat="${catId}"][data-section="${sectionId}"]`);
    if (btn) {
        btn.classList.toggle('done', !!progress[key]);
        btn.textContent = progress[key] ? '✓ Terminé' : 'Marquer fait';
    }

    updateProgressBadge();

    // Refresh the progress bar in the banner if visible
    const cat = allData.find(c => c.id === catId);
    if (cat) {
        const banner = el.contentArea.querySelector('.category-banner');
        if (banner && banner.dataset.id === catId) {
            const total = cat.sections.length;
            const done = cat.sections.filter(s => !!progress[progressKey(cat.id, s.id)]).length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const fill = banner.querySelector('.progress-bar-fill');
            if (fill) fill.style.width = pct + '%';
            // Update meta text
            const spans = banner.querySelectorAll('.category-banner-meta span');
            if (spans[2]) spans[2].textContent = `${done} terminés`;
        }
    }
}

function updateProgressBadge() {
    let total = 0, done = 0;
    allData.forEach(cat => {
        cat.sections.forEach(s => {
            total++;
            if (progress[progressKey(cat.id, s.id)]) done++;
        });
    });
    el.progressText.textContent = `${done} / ${total}`;
}

// ═══════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════
function setupSearch() {
    el.searchInput.addEventListener('input', debounce(handleSearch, 200));

    // ⌘K / Ctrl+K focus
    document.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            el.searchInput.focus();
            el.searchInput.select();
        }
        if (e.key === 'Escape' && document.activeElement === el.searchInput) {
            el.searchInput.blur();
            clearSearch();
        }
    });
}

function handleSearch() {
    const q = el.searchInput.value.trim().toLowerCase();
    if (!q) { clearSearch(); return; }

    const hits = [];
    allData.forEach(cat => {
        cat.sections.forEach(section => {
            const haystack = [
                section.name,
                section.explanation,
                section.syntax || '',
                ...(section.examples || []).map(ex => ex.title + ' ' + ex.explanation + ' ' + ex.code),
            ].join(' ').toLowerCase();

            if (haystack.includes(q)) {
                hits.push({ cat, section });
            }
        });
    });

    renderSearchResults(q, hits);
}

function renderSearchResults(q, hits) {
    el.contentArea.classList.add('hidden');
    el.searchResults.classList.remove('hidden');

    if (hits.length === 0) {
        el.searchResults.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">🔎</div>
        <p>Aucun résultat pour "<strong>${escHtml(q)}</strong>"</p>
      </div>`;
        return;
    }

    const hitsHtml = hits.map(({ cat, section }) => `
    <div class="search-hit" data-cat="${cat.id}" data-section="${section.id}">
      <div class="search-hit-top">
        <span class="category-tag ${cat.id}-tag">${cat.id.toUpperCase()}</span>
        <span class="search-hit-name">${highlight(escHtml(section.name), q)}</span>
      </div>
      <p class="search-hit-desc">${highlight(escHtml(section.explanation), q)}</p>
    </div>`).join('');

    el.searchResults.innerHTML = `
    <p class="search-results-header"><strong>${hits.length}</strong> résultat${hits.length !== 1 ? 's' : ''} pour "<strong>${escHtml(q)}</strong>"</p>
    ${hitsHtml}`;

    el.searchResults.querySelectorAll('.search-hit').forEach(hit => {
        hit.addEventListener('click', () => {
            clearSearch();
            navigateTo(hit.dataset.cat, hit.dataset.section);
        });
    });
}

function clearSearch() {
    el.searchInput.value = '';
    el.searchResults.classList.add('hidden');
    el.contentArea.classList.remove('hidden');
}

function highlight(text, q) {
    const regex = new RegExp(`(${escRegex(q)})`, 'gi');
    return text.replace(regex, '<mark style="background:var(--accent-light);color:var(--accent);border-radius:2px;padding:0 2px">$1</mark>');
}

// ═══════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════
function loadTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.theme) || 'dark';
    applyTheme(saved);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
        el.themeMoon && el.themeMoon.classList.add('hidden');
        el.themeSun && el.themeSun.classList.remove('hidden');
    } else {
        el.themeMoon && el.themeMoon.classList.remove('hidden');
        el.themeSun && el.themeSun.classList.add('hidden');
    }
    localStorage.setItem(STORAGE_KEYS.theme, theme);
}

function setupThemeToggle() {
    el.themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        applyTheme(current === 'dark' ? 'light' : 'dark');
    });
}

// ═══════════════════════════════════════════════════════════
// MOBILE SIDEBAR
// ═══════════════════════════════════════════════════════════
function setupMobileSidebar() {
    el.menuToggle.addEventListener('click', () => {
        el.sidebar.classList.toggle('mobile-open');
        el.sidebarOverlay.classList.toggle('visible');
    });

    el.sidebarOverlay.addEventListener('click', closeMobileSidebar);
}

function closeMobileSidebar() {
    el.sidebar.classList.remove('mobile-open');
    el.sidebarOverlay.classList.remove('visible');
}

// ═══════════════════════════════════════════════════════════
// BACK TO TOP
// ═══════════════════════════════════════════════════════════
function setupBackToTop() {
    el.mainContent.addEventListener('scroll', () => {
        if (el.mainContent.scrollTop > 300) {
            el.backToTop.classList.remove('hidden');
        } else {
            el.backToTop.classList.add('hidden');
        }
    });

    el.backToTop.addEventListener('click', () => {
        el.mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ═══════════════════════════════════════════════════════════
// COPY TO CLIPBOARD
// ═══════════════════════════════════════════════════════════
async function copyCode(btn) {
    const code = btn.dataset.code;
    try {
        await navigator.clipboard.writeText(code);
        const original = btn.innerHTML;
        btn.classList.add('copied');
        btn.innerHTML = '✓ Copié !';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = original;
        }, 2000);
    } catch {
        // Fallback for browsers that block clipboard without HTTPS
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);

        const original = btn.innerHTML;
        btn.classList.add('copied');
        btn.innerHTML = '✓ Copié !';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = original;
        }, 2000);
    }
}

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function debounce(fn, delay) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ═══════════════════════════════════════════════════════════
// TASK 4 — POLISH & UX ENHANCEMENTS
// ═══════════════════════════════════════════════════════════

// ─── Toast Notifications ────────────────────────────────────
function createToastContainer() {
    if ($('toast-container')) return;
    const tc = document.createElement('div');
    tc.id = 'toast-container';
    document.body.appendChild(tc);
}

function showToast(message, icon = '✓', type = 'toast-success', duration = 2400) {
    const tc = $('toast-container');
    if (!tc) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
    tc.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 280);
    }, duration);
}

// ─── Category Tabs ───────────────────────────────────────────
function buildCategoryTabs(activeCatId) {
    const existing = el.contentArea.querySelector('.category-tabs');
    if (existing) existing.remove();

    const tabs = document.createElement('div');
    tabs.className = 'category-tabs';

    allData.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'cat-tab' + (cat.id === activeCatId ? ' active' : '');
        btn.dataset.catId = cat.id;
        btn.innerHTML = `<span class="cat-tab-icon">${cat.icon}</span>${cat.id.toUpperCase()}`;
        btn.addEventListener('click', () => {
            if (cat.id === activeCatId) return;
            renderCategoryWithTransition(cat.id);
        });
        tabs.appendChild(btn);
    });

    el.contentArea.insertBefore(tabs, el.contentArea.firstChild);
}

function renderCategoryWithTransition(catId) {
    el.contentArea.classList.remove('transitioning');
    void el.contentArea.offsetWidth; // force reflow
    el.contentArea.classList.add('transitioning');
    renderCategory(catId);
    buildCategoryTabs(catId);
    setActiveSidebarItem(catId, null);
}

// ─── Expand / Collapse All ───────────────────────────────────
function addBannerActions(catId) {
    const banner = el.contentArea.querySelector('.category-banner');
    if (!banner) return;

    const actions = document.createElement('div');
    actions.className = 'banner-actions';
    actions.innerHTML = `
    <button class="btn-ghost" id="btn-expand-all">Tout déplier</button>
    <button class="btn-ghost" id="btn-collapse-all">Tout réduire</button>`;
    banner.appendChild(actions);

    $('btn-expand-all').addEventListener('click', () => {
        el.contentArea.querySelectorAll('.section-card-body').forEach(b => b.classList.add('open'));
        el.contentArea.querySelectorAll('.section-card-toggle').forEach(a => a.classList.add('open'));
    });

    $('btn-collapse-all').addEventListener('click', () => {
        el.contentArea.querySelectorAll('.section-card-body').forEach(b => b.classList.remove('open'));
        el.contentArea.querySelectorAll('.section-card-toggle').forEach(a => a.classList.remove('open'));
    });
}

// ─── Loading Skeleton ────────────────────────────────────────
function showSkeleton() {
    el.contentArea.innerHTML = `
    <div class="skeleton-wrap">
      <div class="skeleton-banner"></div>
      ${Array.from({ length: 6 }, () => '<div class="skeleton-card"></div>').join('')}
    </div>`;
}

// ─── Scroll-spy ──────────────────────────────────────────────
let scrollSpyObserver = null;

function setupScrollSpy(catId) {
    if (scrollSpyObserver) scrollSpyObserver.disconnect();

    const cards = el.contentArea.querySelectorAll('.section-card');
    if (!cards.length) return;

    scrollSpyObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sectionId = entry.target.id.replace(`section-${catId}-`, '');
                setActiveSidebarItem(catId, sectionId);
            }
        });
    }, {
        root: el.mainContent,
        rootMargin: '-10% 0px -70% 0px',
        threshold: 0,
    });

    cards.forEach(card => scrollSpyObserver.observe(card));
}

// ─── Override toggleDone to show toast ───────────────────────
const _originalToggleDone = toggleDone;
window._toggleDoneWithToast = function (catId, sectionId) {
    const key = progressKey(catId, sectionId);
    const wasDone = !!progress[key];
    _originalToggleDone(catId, sectionId);
    if (!wasDone) {
        showToast('Sujet marqué comme terminé !', '🎉', 'toast-success');
    }
};

// ─── Override renderCategory to add tab 4 features ───────────
const _originalRenderCategory = renderCategory;
window.renderCategory = function (catId) {
    _originalRenderCategory(catId);
    buildCategoryTabs(catId);
    addBannerActions(catId);
    setupScrollSpy(catId);
};

// ─── Override bindSectionCards to wire toast toggleDone ──────
const _originalBindSectionCards = bindSectionCards;
window.bindSectionCards = function (catId) {
    // Toggle card open/close
    el.contentArea.querySelectorAll('.section-card-header').forEach(header => {
        header.addEventListener('click', e => {
            if (e.target.closest('.section-done-btn')) return;
            const sId = header.dataset.section;
            const body = $(`body-${catId}-${sId}`);
            const arrow = header.querySelector('.section-card-toggle');
            body.classList.toggle('open');
            arrow.classList.toggle('open');
        });
    });

    // Mark done buttons — with toast
    el.contentArea.querySelectorAll('.section-done-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            window._toggleDoneWithToast(btn.dataset.cat, btn.dataset.section);
        });
    });

    // Copy buttons
    el.contentArea.querySelectorAll('.copy-btn, .example-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => copyCode(btn));
    });
};

// ═══════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    createToastContainer();
    setupThemeToggle();
    setupMobileSidebar();
    setupBackToTop();
    setupSearch();
    init();
});
