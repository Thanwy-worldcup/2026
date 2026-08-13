/**
 * ============================================================
 *  كود الربط بين جوجل شيت / درايف والموقع
 *  إزاي تستخدمه:
 *  1) افتح الشيت بتاعك -> Extensions (الإضافات) -> Apps Script
 *  2) امسح أي كود موجود، والصق الكود ده مكانه
 *  3) Deploy -> New deployment -> Web app
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  4) هياخدلك رابط (Web app URL) - حطه في assets/app.js
 * ============================================================
 */

const SHEET_NAMES = {
  teams: 'المنتخبات',   // الفريق | اللاعب | النقاط
  schedule: 'الأنشطة',   // التاريخ | الوقت | اسم النشاط | الفريق | الحالة | ملاحظات
};

const GALLERY_FOLDER_ID = '1jKGpLKKXhZr9JpNsqm6Cm3kL5ttuNsi1';

// ============== نقطة الدخول ==============
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'all';
  let data;
  try {
    if (action === 'gallery') {
      data = { gallery: getGalleryPhotos() };
    } else {
      const teams = getTeams();
      data = {
        teams: teams,
        schedule: getSchedule(),
        ticker: detectStandingsChanges(teams),
      };
    }
    return jsonResponse(data);
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============== شريط أخبار التغييرات في الترتيب ==============
const ARABIC_ORDINALS_MAP = {
  1: 'الأول', 2: 'الثاني', 3: 'الثالث', 4: 'الرابع', 5: 'الخامس', 6: 'السادس',
};

function ordinalAr(n) {
  return ARABIC_ORDINALS_MAP[n] || ('المركز ' + n);
}

// بيقارن ترتيب المنتخبات الحالي بآخر ترتيب اتسجل، ولو لقى فرق غيّر مركزه
// بيضيف رسالة في سجل صغير محفوظ (بيحتفظ بآخر 8 أحداث)، ويرجّع السجل كامل
// (اتعملت بحيث تستخدم عملية قراءة وكتابة واحدة بس لتوفير الوقت)
function detectStandingsChanges(teams) {
  const props = PropertiesService.getScriptProperties();

  const sorted = [...teams].sort((a, b) => b.total - a.total);
  const currentRanks = {};
  sorted.forEach((t, i) => { currentRanks[t.name] = i + 1; });

  let state = { snapshot: null, log: [] };
  const stateJson = props.getProperty('tickerState');
  if (stateJson) {
    try {
      const parsed = JSON.parse(stateJson);
      if (parsed && typeof parsed === 'object') state = parsed;
    } catch (e) { /* تجاهل، هيستخدم الافتراضي */ }
  }
  if (!Array.isArray(state.log) || state.log.some(entry => !Array.isArray(entry))) {
    state.log = [];
  }

  const prevRanks = state.snapshot;
  if (prevRanks) {
    // كل الفرق اللي غيّرت مركزها في نفس اللحظة بيتجمعوا في "حدث" واحد
    const movements = [];
    Object.keys(currentRanks).forEach(team => {
      const newRank = currentRanks[team];
      const oldRank = prevRanks[team];
      if (oldRank && oldRank !== newRank) {
        movements.push({
          team: team,
          direction: newRank < oldRank ? 'up' : 'down',
          rankLabel: ordinalAr(newRank),
        });
      }
    });
    if (movements.length) {
      state.log = [movements].concat(state.log).slice(0, 8);
    }
  }

  state.snapshot = currentRanks;
  props.setProperty('tickerState', JSON.stringify(state));
  return state.log;
}

// ============== المنتخبات واللاعبين ==============
// تاب "المنتخبات": صف عناوين ثم -> الفريق | اللاعب | النقاط
// كل صف = لاعب واحد. الترتيب والإجمالي بيتحسبوا هنا أوتوماتيك.
// تاب "المنتخبات": الفريق | اللون | اللاعب | النقاط
// عمود "اللون" اختياري — لو فاضي، الموقع بيحاول يخمّن اللون من اسم الفريق نفسه
// (لو فيه كلمة أحمر/أزرق/أخضر/أصفر). لو عايز تتحكم يدوي، اكتب كود اللون
// (مثال: #1E63F2) في عمود اللون وهو اللي هيتستخدم بالظبط.
function getTeams() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAMES.teams);
  if (!sheet) return [];
  const [, ...rows] = sheet.getDataRange().getValues();

  const teamsMap = {};
  const order = [];

  rows.forEach(r => {
    const teamName = r[0];
    const teamColor = r[1];
    const playerName = r[2];
    const points = Number(r[3]) || 0;
    if (!teamName) return;

    if (!teamsMap[teamName]) {
      teamsMap[teamName] = { name: teamName, color: teamColor || '', total: 0, players: [] };
      order.push(teamName);
    }
    if (playerName) {
      teamsMap[teamName].players.push({ name: playerName, points });
      teamsMap[teamName].total += points;
    }
  });

  const teams = order.map(name => teamsMap[name]);
  teams.forEach(t => t.players.sort((a, b) => b.points - a.points));
  return teams;
}

// ============== الأنشطة والمواعيد ==============
// تاب "الأنشطة": التاريخ | الوقت | اسم النشاط | الفريق (اختياري) | الحالة | ملاحظات
// ملحوظة: عمود "الحالة" في الشيت بقى بس للمرجعية، الموقع بيحسبها لوحده
// بمقارنة تاريخ ووقت النشاط بالوقت الحالي بتوقيت مصر
// تاب "الأنشطة" — الأعمدة بقت: التاريخ | من | إلى | اسم النشاط | الفريق | ملاحظات
// النقطتين "من" و"إلى" لازم يتكتبوا كوقت حقيقي في الشيت (مثال: 9:00 AM)
// عشان الموقع يقدر يحسب الحالة صح (جارٍ الآن / قادم / انتهى) بمقارنة حقيقية بالوقت
function getSchedule() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAMES.schedule);
  if (!sheet) return [];
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone(); // بتتقرا مرة واحدة بس
  const now = new Date();
  const [, ...rows] = sheet.getDataRange().getValues();
  return rows
    .filter(r => r[3])
    .map(r => {
      const startDT = getEventDateTime(r[0], r[1], tz);
      const endDT = getEventDateTime(r[0], r[2], tz) || startDT;
      return {
        date: r[0] ? formatDate(r[0], tz) : '',
        time: buildTimeLabel(r[1], r[2], tz),
        activity: r[3],
        team: r[4] || '',
        status: computeStatus(startDT, endDT, tz, now),
        notes: r[5] || '',
        ts: startDT ? startDT.getTime() : 0,
      };
    });
}

const WEEKDAYS_AR = {
  Sunday: 'الأحد', Monday: 'الإثنين', Tuesday: 'الثلاثاء', Wednesday: 'الأربعاء',
  Thursday: 'الخميس', Friday: 'الجمعة', Saturday: 'السبت',
};

function formatDate(d, tz) {
  try {
    const dateObj = new Date(d);
    const dayName = WEEKDAYS_AR[Utilities.formatDate(dateObj, tz, 'EEEE')] || '';
    const dmy = Utilities.formatDate(dateObj, tz, 'dd/MM/yyyy');
    return (dayName ? dayName + ' ' : '') + dmy;
  } catch (e) { return String(d); }
}

// بيرجع تفاصيل وقت واحد: {hourMin, period, full}
function formatTimeParts(v, tz) {
  try {
    if (!(v instanceof Date)) return null;
    const h = Number(Utilities.formatDate(v, tz, 'H'));
    const m = Number(Utilities.formatDate(v, tz, 'm'));
    const period = h < 12 ? 'صباحاً' : 'مساءً';
    let h12 = h % 12; if (h12 === 0) h12 = 12;
    const hourMin = m === 0 ? String(h12) : (h12 + ':' + (m < 10 ? '0' : '') + m);
    return { hourMin, period, full: hourMin + ' ' + period };
  } catch (e) { return null; }
}

// بيبني الجملة النهائية "من 9 ل 10 صباحاً" من عمودي البداية والنهاية
function buildTimeLabel(startCell, endCell, tz) {
  const s = formatTimeParts(startCell, tz);
  const e = formatTimeParts(endCell, tz);
  if (!s && !e) return '';
  if (s && !e) return s.full;
  if (!s && e) return e.full;
  if (s.period === e.period) return `من ${s.hourMin} ل ${e.hourMin} ${s.period}`;
  return `من ${s.full} ل ${e.full}`;
}

// بيبني وقت الحدث الحقيقي (تاريخ + وقت) كأوبجكت Date واحد، بتوقيت الشيت (مصر)
function getEventDateTime(dateCell, timeCell, tz) {
  try {
    if (!dateCell) return null;
    const dateStr = Utilities.formatDate(new Date(dateCell), tz, 'yyyy-MM-dd');
    const timeStr = (timeCell instanceof Date)
      ? Utilities.formatDate(timeCell, tz, 'HH:mm:ss')
      : '00:00:00';
    return new Date(dateStr + 'T' + timeStr);
  } catch (e) { return null; }
}

// بيقارن بداية ونهاية النشاط بالوقت الحالي بتوقيت مصر
// ويرجع "جارٍ الآن" أو "قادم" أو "انتهى"
function computeStatus(startDT, endDT, tz, now) {
  try {
    if (!startDT) return 'قادم';
    const nowStr = Utilities.formatDate(now, tz, "yyyy-MM-dd'T'HH:mm:ss");
    const nowLocal = new Date(nowStr);
    const end = endDT || startDT;
    if (nowLocal.getTime() < startDT.getTime()) return 'قادم';
    if (nowLocal.getTime() <= end.getTime()) return 'جارٍ الآن';
    return 'انتهى';
  } catch (e) { return 'قادم'; }
}

// ============== صور المعرض من درايف ==============
function getGalleryPhotos() {
  if (!GALLERY_FOLDER_ID || GALLERY_FOLDER_ID.indexOf('ضع_') === 0) return [];
  const folder = DriveApp.getFolderById(GALLERY_FOLDER_ID);
  const photos = [];
  function pushAll(iterator) {
    while (iterator.hasNext()) {
      const f = iterator.next();
      photos.push({ name: f.getName(), url: 'https://lh3.googleusercontent.com/d/' + f.getId(), date: f.getDateCreated() });
    }
  }
  pushAll(folder.getFilesByType(MimeType.JPEG));
  pushAll(folder.getFilesByType(MimeType.PNG));
  photos.sort((a, b) => new Date(b.date) - new Date(a.date));
  return photos;
}
