// ============================================================
// الإعدادات - غيّر القيمة دي برابط الـ Web App بتاعك بعد النشر
// ============================================================
const CONFIG = {
  API_URL: 'https://script.google.com/macros/library/d/1hoB_OcbDtGVOBP7_k8038gvwDTa15GRb_KaEdVP4ZoKYZCniTrSPMpb7/1',
};

let _dataCache = null;

async function fetchTournamentData() {
  if (_dataCache) return _dataCache;
  try {
    const res = await fetch(CONFIG.API_URL);
    const json = await res.json();
    _dataCache = json;
    return json;
  } catch (err) {
    console.error('تعذر تحميل بيانات المسابقة:', err);
    return { teams: [], schedule: [] };
  }
}

async function fetchGalleryPhotos() {
  try {
    const url = CONFIG.API_URL + (CONFIG.API_URL.includes('?') ? '&' : '?') + 'action=gallery';
    const res = await fetch(url);
    const json = await res.json();
    return json.gallery || [];
  } catch (err) {
    console.error('تعذر تحميل الصور:', err);
    return [];
  }
}

// ---------- تفعيل رابط الناف الحالي ----------
function markActiveNav() {
  const current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav.main-nav a').forEach(a => {
    if (a.getAttribute('href') === current) a.classList.add('active');
  });
}

// ---------- تحديد لون ورمز كل فريق من اسمه ----------
function teamColor(name) {
  if (!name) return 'var(--gray-team)';
  if (name.includes('حمر')) return 'var(--red-team)';
  if (name.includes('زرق')) return 'var(--blue-team)';
  if (name.includes('خضر')) return 'var(--green-team)';
  if (name.includes('صفر')) return 'var(--yellow-team)';
  return 'var(--gray-team)';
}

function initials(name) {
  return (name || '').trim().charAt(0);
}

// ---------- ترتيب المنتخبات (تستخدم في الرئيسية) ----------
function renderStandingsSummary(teams) {
  const el = document.querySelector('[data-standings-summary]');
  if (!el) return;
  if (!teams || !teams.length) {
    el.innerHTML = `<p class="empty-state">لسه مفيش نتايج مسجلة في الشيت</p>`;
    return;
  }
  const sorted = [...teams].sort((a, b) => b.total - a.total);
  const rankClasses = ['r1', 'r2', 'r3', 'r4'];

  el.innerHTML = sorted.map((t, i) => `
    <div class="standing-chip">
      <div class="rank-badge ${rankClasses[i] || ''}">${i + 1}</div>
      <div class="shield" style="background:${teamColor(t.name)}">★</div>
      <div class="chip-info">
        <span class="team-name">${t.name}</span>
        <span class="team-points">${t.total} نقطة</span>
      </div>
    </div>
  `).join('');
}

// ---------- صفحة المنتخبات (كل فريق ولاعبينه) ----------
function renderTeamsPage(teams) {
  const el = document.querySelector('[data-teams-grid]');
  if (!el) return;
  if (!teams || !teams.length) {
    el.innerHTML = `<p class="empty-state">لسه مفيش فرق أو لاعبين مسجلين في تاب "المنتخبات"</p>`;
    return;
  }

  el.innerHTML = teams.map(t => {
    const color = teamColor(t.name);
    const players = t.players && t.players.length
      ? t.players.map(p => `
          <div class="player-row">
            <span class="player-name">
              <span class="player-avatar">${initials(p.name)}</span>
              ${p.name}
            </span>
            <span class="player-points" style="background:${color}22; color:${color}">${p.points}</span>
          </div>
        `).join('')
      : `<p class="empty-state">لسه مفيش لاعبين مسجلين</p>`;

    return `
      <div class="team-card">
        <div class="team-head" style="background:${color}">
          <span class="shield">★</span>
          ${t.name}
        </div>
        ${players}
        <div class="team-total" style="color:${color}">
          <span>⭐</span> إجمالي نقاط المنتخب: ${t.total}
        </div>
      </div>
    `;
  }).join('');
}

// ---------- الأنشطة والمواعيد ----------
function renderSchedule(schedule) {
  const el = document.querySelector('[data-fixtures-list]');
  if (!el) return;
  if (!schedule || !schedule.length) {
    el.innerHTML = `<p class="empty-state">لسه مفيش أنشطة مسجلة في الشيت</p>`;
    return;
  }

  const groups = {};
  schedule.forEach(a => { (groups[a.date || 'بدون تاريخ'] = groups[a.date || 'بدون تاريخ'] || []).push(a); });
  const statusClass = s => (s === 'انتهى' ? 'done' : 'upcoming');

  el.innerHTML = Object.entries(groups).map(([date, items]) => `
    <div class="fixture-group-label">${date}</div>
    ${items.map(a => `
      <div class="fixture-card">
        <div>
          <div class="fixture-activity">${a.activity}${a.team ? ' · ' + a.team : ''}</div>
          ${a.notes ? `<div class="fixture-notes">${a.notes}</div>` : ''}
        </div>
        ${a.time ? `<span class="fixture-time">${a.time}</span>` : ''}
        <span class="status-pill ${statusClass(a.status)}">${a.status}</span>
      </div>
    `).join('')}
  `).join('');
}

// ---------- معرض الصور ----------
function renderGallery(photos) {
  const el = document.querySelector('[data-gallery-grid]');
  if (!el) return;
  if (!photos || !photos.length) {
    el.innerHTML = `<p class="empty-state">لسه مفيش صور مرفوعة في مجلد درايف</p>`;
    return;
  }
  el.innerHTML = photos.map(p => `
    <figure onclick="openLightbox('${p.url}')">
      <img src="${p.url}" alt="${p.name || ''}" loading="lazy">
    </figure>
  `).join('');
}

function openLightbox(url) {
  const box = document.querySelector('[data-lightbox]');
  box.querySelector('img').src = url;
  box.classList.add('open');
}
function closeLightbox() {
  document.querySelector('[data-lightbox]').classList.remove('open');
}
