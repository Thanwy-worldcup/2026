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

// ---------- آيات الفوتر المتغيّرة (بتتغير كل ساعتين تلقائيًا في كل الصفحات) ----------
const FOOTER_VERSES = [
  { text: 'ولا تشاكلوا هذا الدهر، بل تغيّروا عن شكلكم بتجديد أذهانكم.', ref: 'رومية 12: 2' },
  { text: 'لا تحبوا العالم ولا الأشياء التي في العالم.', ref: '1 يوحنا 2: 15' },
  { text: 'لا تضلوا: فإن المعاشرات الردية تفسد الأخلاق الجيدة.', ref: '1 كورنثوس 15: 33' },
  { text: 'لا تخرج كلمة رديئة من أفواهكم، بل كل ما كان صالحًا للبنيان.', ref: 'أفسس 4: 29' },
  { text: 'هكذا اللسان أيضًا هو عضو صغير ويفتخر متعظمًا.', ref: 'يعقوب 3: 5' },
  { text: 'لا شيئًا بتحزب أو بعُجب، بل بتواضع، حاسبين بعضكم البعض أفضل من أنفسهم.', ref: 'فيلبي 2: 3' },
  { text: 'وأما ثمر الروح فهو: محبة، فرح، سلام، طول أناة، لطف، صلاح، إيمان، وداعة، تعفف.', ref: 'غلاطية 5: 22-23' },
  { text: 'لا يغلبنك الشر، بل اغلب الشر بالخير.', ref: 'رومية 12: 21' },
  { text: 'أنتم نور العالم... فليضئ نوركم هكذا قدام الناس.', ref: 'متى 5: 14-16' },
  { text: 'وأما هم فلكي يأخذوا إكليلًا يفنى، وأما نحن فإكليلًا لا يفنى.', ref: '1 كورنثوس 9: 25' },
  { text: 'لا تكونوا تحت نير مع غير المؤمنين... وأية شركة للنور مع الظلمة؟', ref: '2 كورنثوس 6: 14' },
  { text: 'لستم من العالم، بل أنا اخترتكم من العالم.', ref: 'يوحنا 15: 19' },
];

function renderFooterVerse(pageOffset) {
  const el = document.querySelector('[data-footer-verse]');
  if (!el) return;
  const HOURS_PER_VERSE = 2; // غيّرها لأي عدد ساعات تحب
  const timeSlot = Math.floor(Date.now() / (HOURS_PER_VERSE * 60 * 60 * 1000));
  const index = (timeSlot + (pageOffset || 0)) % FOOTER_VERSES.length;
  const v = FOOTER_VERSES[index];
  el.innerHTML = `"${v.text}" <span class="verse-ref">(${v.ref})</span>`;
}

// ---------- شريط أخبار تغييرات الترتيب (الرئيسية بس) ----------
function renderTicker(changeLog, schedule) {
  const el = document.querySelector('[data-ticker]');
  const track = document.querySelector('.ticker-track');
  const wrap = document.querySelector('[data-ticker-wrap]');
  if (!el || !wrap || !track) return;

  const items = [];

  // آخر حدث تغيير في الترتيب (ممكن يكون فيه أكتر من فريق اتحرك مرة واحدة)
  if (changeLog && changeLog.length && changeLog[0].length) {
    const html = changeLog[0].map(m => {
      const arrow = m.direction === 'up'
        ? '<span class="arrow-up">▲</span>'
        : '<span class="arrow-down">▼</span>';
      const verb = m.direction === 'up' ? 'صعد' : 'هبط';
      return `${arrow} ${verb} ${m.team} إلى المركز ${m.rankLabel}`;
    }).join('&nbsp;&nbsp;|&nbsp;&nbsp;');
    items.push(html);
  }

  // أقرب حدث قادم
  const upcoming = (schedule || []).filter(a => a.status === 'قادم').sort((a, b) => a.ts - b.ts)[0];
  if (upcoming) {
    items.push(`📅 الحدث القادم: ${upcoming.activity} — ${upcoming.date} (${upcoming.time})`);
  }

  if (!items.length) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'flex';

  // إيقاف أي حركة سابقة شغالة قبل ما نبدأ واحدة جديدة
  if (el._tickerRAF) cancelAnimationFrame(el._tickerRAF);

  const unit = items.join('&nbsp;&nbsp;•&nbsp;&nbsp;') + '&nbsp;&nbsp;•&nbsp;&nbsp;';
  el.innerHTML = unit;
  el.style.transform = 'translateX(0)';

  // بعد ما نقيس عرض النسخة الأولى، بنكررها تاني عشان يبقى دايمًا فيه
  // نسخة جاهزة تدخل فور ما اللي قبلها يخرج، من غير أي فراغ
  requestAnimationFrame(() => {
    const unitWidth = el.getBoundingClientRect().width;
    if (!unitWidth) return;
    el.innerHTML = unit + unit;

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const speed = 50; // بكسل / ثانية
    let pos = 0;
    let last = performance.now();

    function step(now) {
      const dt = (now - last) / 1000;
      last = now;
      pos += speed * dt;
      if (pos >= unitWidth) pos -= unitWidth;
      el.style.transform = `translateX(${-pos}px)`;
      el._tickerRAF = requestAnimationFrame(step);
    }
    el._tickerRAF = requestAnimationFrame(step);
  });
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

// اللون النهائي لأي فريق: من عمود "اللون" في الشيت لو مكتوب،
// وإلا بيرجع يخمّنه من اسم الفريق زي القديم
function resolveTeamColor(team) {
  if (team && team.color && String(team.color).trim()) return String(team.color).trim();
  return teamColorHex(team ? team.name : '');
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
    const hex = resolveTeamColor(t);
    const chipStyle = `--chip-color:${hex}; --chip-bg:${hexToRgba(hex, 0.06)}; --chip-border:${hexToRgba(hex, 0.3)};`;
    return `
    <a class="standing-chip" href="teams.html" style="${chipStyle}">
      ${i === 0 ? `<img class="chip-crown" src="assets/img/crown.png" alt="">` : ''}
      <div class="rank-badge">${i + 1}</div>
      <div class="shield" style="background:${hex}">★</div>
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
    const color = resolveTeamColor(t);
    const players = t.players && t.players.length
      ? t.players.map((p, i) => `
          <div class="player-row">
            <span class="player-name">
              <span class="player-avatar">${i + 1}</span>
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
  { keys: ['التحرك', 'تحرك'], icon: 'bus_travel' },
  { keys: ['الوصول', 'وصول'], icon: 'arrival_pin' },
  { keys: ['تسكين'], icon: 'accommodation' },
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
          const dotClass = a.status === 'انتهى' ? 'done' : (a.status === 'جارٍ الآن' ? 'live' : 'upcoming');
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

// ---------- الحدث الحالي أو الأقرب (يستخدم في الرئيسية) ----------
function renderNextEvent(schedule) {
  const metaEl = document.querySelector('[data-next-meta]');
  const centerEl = document.querySelector('[data-next-center]');
  const iconEl = document.querySelector('[data-next-icon]');
  if (!metaEl || !centerEl) return;

  const list = schedule || [];
  const live = list.filter(a => a.status === 'جارٍ الآن').sort((a, b) => a.ts - b.ts)[0];
  const upcoming = list.filter(a => a.status === 'قادم').sort((a, b) => a.ts - b.ts)[0];
  const item = live || upcoming;

  if (!item) {
    metaEl.innerHTML = '';
    centerEl.innerHTML = '<span>لا يوجد نشاط قادم حاليًا</span>';
    if (iconEl) iconEl.innerHTML = '';
    return;
  }

  metaEl.innerHTML = `
    <span>📅 ${item.date}</span>
    <span>🕔 ${item.time}</span>
    ${live ? '<span class="live-tag">جارٍ الآن</span>' : ''}
  `;
  centerEl.innerHTML = item.team
    ? `<span>${item.activity}</span><span class="vs-label">${item.team}</span>`
    : `<span>${item.activity}</span>`;

  if (iconEl) {
    const url = activityIconUrl(item.activity);
    iconEl.innerHTML = url
      ? `<img src="${url}" alt="">`
      : `<span class="timeline-icon-fallback">🗓️</span>`;
  }
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
  const colorByTeam = {};
  teams.forEach(t => {
    colorByTeam[t.name] = resolveTeamColor(t);
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
    const color = colorByTeam[p.team] || '#64748B';
    return `
      <div class="podium-item ${r.cls}">
        ${r.crown ? `<div class="crown">${r.crown}</div>` : ''}
        <div class="avatar-ring" style="border-color:${color}">
          <img src="assets/img/scorer-${i + 1}.jpg" alt="${p.name}">
        </div>
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
