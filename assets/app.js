// ============================================================
// الإعدادات - غيّر القيمة دي برابط الـ Web App بتاعك بعد النشر
// ============================================================
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwQEDCagBckAaY4Z6FVMEzfMokY84lxWs_GBpd9FC_4xePNkFMLZfvievCz792BNE2A/exec',
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

// ---------- فتح/قفل قائمة الموبايل ----------
function toggleNav() {
  const nav = document.getElementById('mainNav');
  const btn = document.querySelector('.nav-toggle');
  if (!nav) return;
  const isOpen = nav.classList.toggle('open');
  if (btn) {
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    btn.textContent = isOpen ? '✕' : '☰';
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

// نسخة الألوان بصيغة hex خام (مستخدمة في كارت الترتيب على الموبايل لعمل تدرج شفاف)
function teamColorHex(name) {
  if (!name) return '#64748B';
  if (name.includes('حمر')) return '#E53935';
  if (name.includes('زرق')) return '#1E63F2';
  if (name.includes('خضر')) return '#1FA34A';
  if (name.includes('صفر')) return '#F4B400';
  return '#64748B';
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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

  el.innerHTML = sorted.map((t, i) => {
    const hex = teamColorHex(t.name);
    const chipStyle = `--chip-color:${hex}; --chip-bg:${hexToRgba(hex, 0.06)}; --chip-border:${hexToRgba(hex, 0.3)};`;
    return `
    <a class="standing-chip" href="teams.html" style="${chipStyle}">
      ${i === 0 ? `<img class="chip-crown" src="assets/img/crown.png" alt="">` : ''}
      <div class="rank-badge">${i + 1}</div>
      <div class="shield" style="background:${teamColor(t.name)}">★</div>
      <div class="chip-info">
        <span class="team-name">${t.name}</span>
        <span class="team-points">${t.total} نقطة</span>
      </div>
    </a>
  `;
  }).join('');
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

// ---------- قاموس مطابقة اسم النشاط بالأيقونة المناسبة ----------
// لو كتبت في الشيت اسم نشاط فيه أي كلمة من دول، الأيقونة المرتبطة بيها هتظهر أوتوماتيك
const ACTIVITY_ICONS = [
  // المباريات الأربعة - كل مباراة أيقونتها الخاصة (لازم تتفحص قبل قاعدة "مباراة" العامة)
  { keys: ['أول مباراة', 'اول مباراة'], icon: 'match1_strike' },
  { keys: ['المباراة الثانية'], icon: 'match2_keeper' },
  { keys: ['المباراة الثالثة'], icon: 'match3_dribble' },
  { keys: ['المباراة الرابعة'], icon: 'match4_tactics' },

  { keys: ['صلاة', 'صلاه'], icon: 'prayer' },
  { keys: ['فطار', 'إفطار'], icon: 'breakfast' },
  { keys: ['غذاء', 'غداء'], icon: 'breakfast' },
  { keys: ['روحية', 'عظة'], icon: 'bible' },
  { keys: ['راحة', 'استراحة'], icon: 'rest' },
  { keys: ['تسكين'], icon: 'rest' },
  { keys: ['ورشة عمل', 'ورشة إبداعية', 'ورشة', 'ورش'], icon: 'workshop' },
  { keys: ['scope', 'scape', 'سكوب'], icon: 'scope' },
  { keys: ['نشاط حر', 'رسم', 'فني'], icon: 'art' },
  { keys: ['سؤال محيرني', 'سؤال', 'مسابقة'], icon: 'idea' },
  { keys: ['got talant', 'مواهب', 'تالنت'], icon: 'idea' },
  { keys: ['مباراة', 'ماتش', 'كورة', 'تحدي'], icon: 'trophy' },
  { keys: ['جيم', 'رياضة', 'تمرين'], icon: 'gym' },
  { keys: ['عشاء'], icon: 'dinner' },
  { keys: ['العاب', 'ألعاب', 'game'], icon: 'games' },
  { keys: ['جلسة مسائية', 'سهرة', 'مسائية'], icon: 'evening' },
  { keys: ['مسبح', 'سباحة', 'pool'], icon: 'pool' },
  { keys: ['قهوة', 'ترحيب', 'استقبال'], icon: 'coffee' },
];

function activityIconUrl(activityName) {
  const name = (activityName || '').trim();
  for (const entry of ACTIVITY_ICONS) {
    if (entry.keys.some(k => name.includes(k))) {
      return `assets/img/icons/${entry.icon}.png`;
    }
  }
  return null; // مفيش تطابق -> هيتعرض رمز افتراضي
}

// ---------- الأنشطة والمواعيد (مقسّمة بالأيام - تايم لاين) ----------
function renderSchedule(schedule) {
  const el = document.querySelector('[data-fixtures-list]');
  if (!el) return;
  if (!schedule || !schedule.length) {
    el.innerHTML = `<p class="empty-state">لسه مفيش أنشطة مسجلة في الشيت</p>`;
    return;
  }

  const sorted = [...schedule].sort((a, b) => a.ts - b.ts);

  // ترقيم الأيام حسب أول ظهور لكل تاريخ (مش اسم اليوم في الأسبوع)
  const dayNumberByDate = {};
  let dayCounter = 0;
  sorted.forEach(a => {
    const key = a.date || 'بدون تاريخ';
    if (!(key in dayNumberByDate)) {
      dayCounter++;
      dayNumberByDate[key] = dayCounter;
    }
  });
  const ARABIC_ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];

  const groups = {};
  sorted.forEach(a => {
    const key = a.date || 'بدون تاريخ';
    (groups[key] = groups[key] || []).push(a);
  });

  el.innerHTML = Object.entries(groups).map(([date, items]) => {
    const dayNum = dayNumberByDate[date];
    const dayLabel = ARABIC_ORDINALS[dayNum - 1] || ('#' + dayNum);
    return `
    <div class="day-card">
      <div class="day-header">
        <span>📅</span> اليوم ${dayLabel}
        <span class="day-date">${date}</span>
      </div>
      <div class="timeline">
        ${items.map(a => {
          const iconUrl = activityIconUrl(a.activity);
          const dotClass = a.status === 'انتهى' ? 'done' : 'upcoming';
          return `
          <div class="timeline-item">
            <div class="timeline-icon">
              ${iconUrl
                ? `<img src="${iconUrl}" alt="">`
                : `<span class="timeline-icon-fallback">🗓️</span>`}
            </div>
            <div class="timeline-body">
              <div class="timeline-top">
                <span class="timeline-activity">${a.activity}${a.team ? ' · ' + a.team : ''}</span>
                <span class="timeline-dot ${dotClass}"></span>
              </div>
              <div class="timeline-time">${a.time || ''}</div>
              ${a.notes ? `<div class="timeline-notes">${a.notes}</div>` : ''}
            </div>
          </div>
        `;
        }).join('')}
      </div>
    </div>
  `;
  }).join('');
}

// ---------- أقرب نشاط قادم (يستخدم في الرئيسية) ----------
function renderNextEvent(schedule) {
  const metaEl = document.querySelector('[data-next-meta]');
  const centerEl = document.querySelector('[data-next-center]');
  if (!metaEl || !centerEl) return;

  const upcoming = (schedule || []).filter(a => a.status === 'قادم').sort((a, b) => a.ts - b.ts);
  const item = upcoming[0];

  if (!item) {
    metaEl.innerHTML = '';
    centerEl.innerHTML = '<span>لا يوجد نشاط قادم حاليًا</span>';
    return;
  }

  metaEl.innerHTML = `<span>📅 ${item.date}</span><span>🕔 ${item.time}</span>`;
  centerEl.innerHTML = item.team
    ? `<span>${item.activity}</span><span class="vs-label">${item.team}</span>`
    : `<span>${item.activity}</span>`;
}

// ---------- معرض الصور ----------
function renderGallery(photos) {
  const el = document.querySelector('[data-gallery-grid]');
  if (!el) return;
  if (!photos || !photos.length) {
    el.innerHTML = `<p class="empty-state">لسه مفيش صور مرفوعة في مجلد درايف</p>`;
    return;
  }
  const sizes = ['size-a', 'size-c', 'size-b', 'size-a', 'size-c', 'size-d', 'size-b', 'size-c'];
  el.innerHTML = photos.map((p, i) => `
    <figure class="${sizes[i % sizes.length]}" onclick="openLightbox('${p.url}')">
      <img src="${p.url}" alt="${p.name || ''}" loading="lazy">
    </figure>
  `).join('');
}

// ---------- هدافي البطولة (أعلى 3 لاعبين بالنقاط) ----------
function renderTopScorers(teams) {
  const el = document.querySelector('[data-top-scorers]');
  if (!el) return;
  if (!teams || !teams.length) {
    el.innerHTML = `<p class="empty-state">لسه مفيش لاعبين مسجلين</p>`;
    return;
  }

  let all = [];
  teams.forEach(t => {
    (t.players || []).forEach(p => all.push({ name: p.name, points: p.points, team: t.name }));
  });
  all.sort((a, b) => b.points - a.points);
  const top3 = all.slice(0, 3);

  if (!top3.length) {
    el.innerHTML = `<p class="empty-state">لسه مفيش لاعبين مسجلين</p>`;
    return;
  }

  const ranks = [
    { cls: 'first', medal: 'g', crown: '👑' },
    { cls: 'second', medal: 's', crown: '' },
    { cls: 'third', medal: 'b', crown: '' },
  ];

  el.innerHTML = top3.map((p, i) => {
    const r = ranks[i];
    const color = teamColor(p.team);
    return `
      <div class="podium-item ${r.cls}">
        ${r.crown ? `<div class="crown">${r.crown}</div>` : ''}
        <div class="avatar-ring" style="background:${color}">${initials(p.name)}</div>
        <div class="medal ${r.medal}">${i + 1}</div>
        <div class="p-name">${p.name}</div>
        <div class="p-team">${p.team}</div>
        <div class="p-points">${p.points} نقطة</div>
      </div>
    `;
  }).join('');
}

function openLightbox(url) {
  const box = document.querySelector('[data-lightbox]');
  box.querySelector('img').src = url;
  box.classList.add('open');
}
function closeLightbox() {
  document.querySelector('[data-lightbox]').classList.remove('open');
}
