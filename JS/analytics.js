import { _supabase } from "./supabase_init.js";
import { updateStreakDisplay, setLoadingState, getDurationInMinutes, calculateCurrentStreak } from "./script.js";

const studyTimeBySubject = document.querySelector('.study-by-subject');
const totalStudyHrsEl = document.getElementById('total-study-hrs');
const goalsAchievedEl = document.getElementById('goals-achieved');
const tasksCompletedEl = document.getElementById('tasks-completed');
const tasksCompletedRateEl = document.getElementById('completed-tasks');
const pendingTasksEl = document.getElementById('pending');
const pctRateEl = document.getElementById('pct-rate');
const currentViewTxtEl = document.getElementById('current-view-txt');
const subjectProgressBars = document.querySelectorAll('.progress-status.big-bar');
const focusDataElements = document.querySelectorAll('.focus-data span');
const goalProgressContainer = document.querySelector('.goal-completion-progress');

let currentUser = null;
let activeRange = 'week';
let subjectMap = {};

let currentMetrics = {
  studyHours: 0,
  goalsCompleted: 0,
  goalsTotal: 0,
  tasksCompleted: 0,
  tasksTotal: 0,
  productivityScore: 0,
};

document.addEventListener('DOMContentLoaded', async () => {
    setLoadingState(true);
    await authGuard();
    await updateStreakDisplay(currentUser);
    await loadSubjects();
    setupViewButtons();
    await loadAll();
    await loadStreaks();
    await peakHours();
    setLoadingState(false);
});

async function authGuard() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = session.user;
}


function getDateRange(range) {
  const now = new Date();
  const from = new Date();

  switch (range) {
    case 'week': from.setDate(now.getDate() - 7); break;
    case 'month': from.setMonth(now.getMonth() - 1); break;
    case 'semester': from.setMonth(now.getMonth() - 4); break;
    case 'all': from.setFullYear(2000); break;
  }

  return { from: from.toISOString(), to: now.toISOString() };
}

function getPreviousDateRange(range) {
  const current = getDateRange(range);
  const currentFrom = new Date(current.from);
  const currentTo   = new Date(current.to);
  const lengthMs = currentTo - currentFrom;

  const prevTo   = new Date(currentFrom);
  const prevFrom = new Date(currentFrom.getTime() - lengthMs);

  return { from: prevFrom.toISOString(), to: prevTo.toISOString() };
}

async function loadAll() {
  setLoadingState(true);
  const range = getDateRange(activeRange);
  const prevRange = getPreviousDateRange(activeRange);

  await Promise.all([
    loadStudyHours(range, prevRange),
    loadAchievedWithDelta('goals', goalsAchievedEl, range, prevRange),
    loadAchievedWithDelta('tasks', tasksCompletedEl, range, prevRange),
    loadFocusAnalytics(range),
    loadGoalProgress(),
  ]);

  await renderProductivityScore(range, prevRange);
  setLoadingState(false);
}

async function loadStudyHours(range, prevRange) {
  const [{ data, error }, { data: prevData, error: prevError }] = await Promise.all([
    _supabase.from('sessions').select('subject_id, start_time, end_time, study_date')
      .eq('user_id', currentUser.id)
      .gte('study_date', range.from)
      .lte('study_date', range.to),
    _supabase.from('sessions').select('start_time, end_time, study_date')
      .eq('user_id', currentUser.id)
      .gte('study_date', prevRange.from)
      .lte('study_date', prevRange.to),
  ]);

  if (error) return console.error('Study hours error:', error.message);

  let totalStudyMinutes = 0;
  studyTimeBySubject.innerHTML = '';

  data.forEach(s => totalStudyMinutes += getDurationInMinutes(s.start_time, s.end_time));
  const totalHours = totalStudyMinutes / 60;
  totalStudyHrsEl.textContent = `${totalHours.toFixed(2)} h`;
  currentMetrics.studyHours = totalHours;

  let prevTotalMinutes = 0;
  if (!prevError && prevData) {
    prevData.forEach(s => prevTotalMinutes += getDurationInMinutes(s.start_time, s.end_time));
  }
  const prevHours = prevTotalMinutes / 60;

  renderDelta(
    document.querySelectorAll('.card.flex-card')[0],
    totalHours,
    prevHours,
    'h'
  );

  let hrsByDay = {};
  let bySubject = {};

  data.forEach(s => {
    let day = new Date(s.study_date).getDay() - 1;
    let dayHrs = parseFloat((getDurationInMinutes(s.start_time, s.end_time) / 60).toFixed(2));
    hrsByDay[day] = hrsByDay[day] ? hrsByDay[day] + dayHrs : dayHrs;
    bySubject[subjectMap[s.subject_id]] = bySubject[subjectMap[s.subject_id]]
      ? bySubject[subjectMap[s.subject_id]] + dayHrs
      : dayHrs;
  });

  const maxHours = Math.max(...Object.values(hrsByDay), 1);
  subjectProgressBars.forEach((bar, i) => {
    bar.textContent = hrsByDay[i] ? `${hrsByDay[i]} h` : '';
    bar.style.width  = hrsByDay[i] ? `${Math.floor((hrsByDay[i] / maxHours) * 100)}%` : '0%';
  });

  for (const sbj in bySubject) {
    let pct = Math.floor((bySubject[sbj] / totalHours) * 100).toFixed(0);
    studyTimeBySubject.innerHTML += `
      <div>
        <span class="subject">
          <p class="bold">${sbj}</p>
          <p class="secondary-text">${bySubject[sbj].toFixed(2)} h (${pct}%)</p>
        </span>
        <div class="progress-bar">
          <div class="progress-status" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }
}

async function loadAchievedWithDelta(table, txtEl, range, prevRange) {
  const { data, error } = await _supabase.from(table).select();
  if (error) return console.error('Error:', error.message);

  let completed = 0;
  data.forEach(dt => { if (dt.is_completed) completed++; });
  txtEl.textContent = `${completed}/${data.length}`;

  if (table === 'goals') {
    currentMetrics.goalsCompleted = completed;
    currentMetrics.goalsTotal     = data.length;
  } else {
    currentMetrics.tasksCompleted = completed;
    currentMetrics.tasksTotal     = data.length;

    const pct = data.length > 0 ? Math.floor((completed / data.length) * 100) : 0;
    tasksCompletedRateEl.textContent = completed;
    pendingTasksEl.textContent = data.length - completed;
    pctRateEl.textContent = `${pct}%`;
    document.querySelector('.rate-circle').style.background = `
      conic-gradient(
        var(--success-color) calc(${pct} * 1%),
        var(--opaque-blue) 0
      )`;
    currentViewTxtEl.textContent = `This ${activeRange}`;
  }

  const dateField = table === 'goals' ? 'due_date' : 'created_at';
  const [{ data: prevData }] = await Promise.all([
    _supabase.from(table).select()
      .gte(dateField, prevRange.from)
      .lte(dateField, prevRange.to),
  ]);

  let prevCompleted = 0;
  let prevTotal = 0;
  if (prevData) {
    prevTotal = prevData.length;
    prevData.forEach(dt => { if (dt.is_completed) prevCompleted++; });
  }

  const cardIndex = table === 'goals' ? 1 : 2;
  renderDelta(
    document.querySelectorAll('.card.flex-card')[cardIndex],
    completed,
    prevCompleted,
    ''
  );
}

async function renderProductivityScore(prevRange) {
  const rangeDays = { week: 7, month: 30, semester: 120, all: 365 };
  const days = rangeDays[activeRange] || 7;
  const targetHours = (days / 7) * 10;

  const taskRate  = currentMetrics.tasksTotal  > 0 ? currentMetrics.tasksCompleted  / currentMetrics.tasksTotal  : 0;
  const goalRate  = currentMetrics.goalsTotal  > 0 ? currentMetrics.goalsCompleted  / currentMetrics.goalsTotal  : 0;
  const hoursRate = Math.min(currentMetrics.studyHours / targetHours, 1);

  const score = Math.round((taskRate * 40) + (goalRate * 30) + (hoursRate * 30));
  currentMetrics.productivityScore = score;

  const [
    { data: prevSessions },
    { data: prevTasks },
    { data: prevGoals },
  ] = await Promise.all([
    _supabase.from('sessions').select('start_time, end_time')
      .eq('user_id', currentUser.id)
      .gte('study_date', prevRange.from)
      .lte('study_date', prevRange.to),
    _supabase.from('tasks').select(),
    _supabase.from('goals').select(),
  ]);

  let prevStudyMins = 0;
  if (prevSessions) prevSessions.forEach(s => prevStudyMins += getDurationInMinutes(s.start_time, s.end_time));
  const prevHours = prevStudyMins / 60;

  let prevTasksCompleted = 0, prevTasksTotal = 0;
  if (prevTasks) { prevTasksTotal = prevTasks.length; prevTasks.forEach(t => { if (t.is_completed) prevTasksCompleted++; }); }

  let prevGoalsCompleted = 0, prevGoalsTotal = 0;
  if (prevGoals) { prevGoalsTotal = prevGoals.length; prevGoals.forEach(g => { if (g.is_completed) prevGoalsCompleted++; }); }

  const prevTaskRate  = prevTasksTotal  > 0 ? prevTasksCompleted  / prevTasksTotal  : 0;
  const prevGoalRate  = prevGoalsTotal  > 0 ? prevGoalsCompleted  / prevGoalsTotal  : 0;
  const prevHoursRate = Math.min(prevHours / targetHours, 1);
  const prevScore     = Math.round((prevTaskRate * 40) + (prevGoalRate * 30) + (prevHoursRate * 30));

  const productivityCard = document.querySelectorAll('.card.flex-card')[3];
  productivityCard.querySelector('.bold').textContent = `${score}/100`;

  renderDelta(productivityCard, score, prevScore, 'pts');

  const scoreEl = productivityCard.querySelector('.bold');
  scoreEl.style.color =
    score >= 80 ? 'var(--success-color)' :
    score >= 50 ? 'var(--warning-color, #F59E0B)' :
                  'var(--pink-accent)';
}

function renderDelta(cardEl, current, previous, unit) {
  if (!cardEl) return;
  const container = cardEl.querySelector('.productivity-score');
  if (!container) return;

  const diff = current - previous;
  const absDiff = Math.abs(Number.isInteger(diff) ? diff : parseFloat(diff.toFixed(2)));
  const isUp    = diff >= 0;
  const isZero  = absDiff === 0 && previous === 0;

  const pEl = container.querySelector('p');
  const iEl = container.querySelector('i');

  if (isZero || previous === 0 && current === 0) {
    pEl.textContent = '—';
    iEl.className   = '';
    iEl.style.color = 'var(--secondary-text, #6B7280)';
    return;
  }

  pEl.textContent = `${absDiff}${unit}`;
  iEl.className   = isUp ? 'fa-solid fa-arrow-up' : 'fa-solid fa-arrow-down';
  iEl.style.color = isUp ? 'var(--success-color)' : 'var(--pink-accent)';
  pEl.style.color = isUp ? 'var(--success-color)' : 'var(--pink-accent)';
}

async function peakHours() {
  const { data, error } = await _supabase.from('sessions').select().eq('user_id', currentUser.id);
  if (error) return console.error('Error retrieving sessions: ' + error.message);

  const hourBuckets = {};
  data.forEach(session => {
    const hour = session.start_time.split(':')[0];
    hourBuckets[hour] = (hourBuckets[hour] || 0) + getDurationInMinutes(session.start_time, session.end_time);
  });

  const peakHour = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0];
  if (peakHour) {
    const h = parseInt(peakHour[0]);
    document.getElementById('time').textContent = `${formatHour(h)}-${formatHour(h + 2)}`;
  }

  const peakBuckets = [
    { label: '6-8 AM',   start: 6,  end: 8  },
    { label: '8-10 AM',  start: 8,  end: 10 },
    { label: '12-2 PM',  start: 12, end: 14 },
    { label: '2-4 PM',   start: 14, end: 16 },
    { label: '7-9 PM',   start: 19, end: 21 },
  ];

  const peakMins = peakBuckets.map(b => {
    let total = 0;
    for (let h = b.start; h < b.end; h++) total += hourBuckets[h] || 0;
    return { ...b, total };
  }).sort((a, b) => b.total - a.total).slice(0, 3);

  const maxPeakMins = Math.max(...peakMins.map(p => p.total), 1);
  const hoursDivs   = document.querySelectorAll('#peak-hrs .hours');

  peakMins.forEach((peak, i) => {
    const el = hoursDivs[i];
    if (!el) return;
    const pct = Math.round((peak.total / maxPeakMins) * 100);
    el.querySelector('.secondary-text').textContent = peak.label;
    el.querySelector('.bold').textContent = `${pct}%`;
    el.querySelector('.progress-status').style.width = `${pct}%`;
  });
}

function setupViewButtons() {
  const rangeMap = ['week', 'month', 'semester', 'all'];
  const buttons  = document.querySelectorAll('.view-btn');

  buttons.forEach((btn, i) => {
    btn.addEventListener('click', async () => {
      buttons.forEach(b => b.classList.remove('btn-active'));
      btn.classList.add('btn-active');
      activeRange = rangeMap[i];
      await loadAll();
      await peakHours();
    });
  });
}

async function loadStreaks() {
  const { data, error } = await _supabase
    .from('sessions')
    .select('study_date')
    .eq('user_id', currentUser.id)
    .order('study_date', { ascending: false });

  if (error) return console.error('Error loading streaks:', error.message);

  const uniqueDates   = [...new Set(data.map(s => s.study_date).filter(Boolean))].sort().reverse();
  const currentStreak = calculateCurrentStreak(uniqueDates);
  const longestStreak = calculateLongestStreak(uniqueDates);
  const totalStudyDays = uniqueDates.length;

  document.querySelector('#streak h2').textContent = `${currentStreak} Days`;
  document.querySelector('#streak .streak-stats > div:first-child .bold').textContent = `${longestStreak} days`;
  document.querySelector('#streak .streak-stats > div:last-child .bold').textContent  = `${totalStudyDays}/7`;
}

function calculateLongestStreak(sortedDates) {
  if (sortedDates.length === 0) return 0;
  let longest = 1, current = 1;
  for (let i = 0; i < sortedDates.length - 1; i++) {
    const diff = Math.floor(
      (new Date(sortedDates[i]) - new Date(sortedDates[i + 1])) / (1000 * 60 * 60 * 24)
    );
    if (diff === 1) { current++; longest = Math.max(longest, current); }
    else { current = 1; }
  }
  return longest;
}

async function loadFocusAnalytics(range) {
  const { data: sessions, error } = await _supabase
    .from('sessions')
    .select('start_time, end_time, study_date, pauses')
    .eq('user_id', currentUser.id)
    .gte('study_date', range.from)
    .lte('study_date', range.to);

  if (error) return console.error('Error loading focus analytics:', error.message);

  if (!sessions || sessions.length === 0) {
    focusDataElements[0].querySelector('.bold').textContent = '0 min';
    focusDataElements[1].querySelector('.bold').textContent = '0%';
    focusDataElements[2].querySelector('.bold').textContent = '0';
    return;
  }

  let totalFocusMinutes = 0;
  let totalPauses       = 0;
  const uniqueDates     = new Set();

  sessions.forEach(s => {
    totalFocusMinutes += getDurationInMinutes(s.start_time, s.end_time);
    totalPauses       += s.pauses || 0;
    uniqueDates.add(s.study_date);
  });

  focusDataElements[0].querySelector('.bold').textContent = `${Math.round(totalFocusMinutes / sessions.length)} min`;
  focusDataElements[1].querySelector('.bold').textContent = `${sessions.length > 0 ? Math.round((totalPauses / sessions.length) * 10) : 0}%`;
  focusDataElements[2].querySelector('.bold').textContent = (sessions.length / uniqueDates.size).toFixed(1);
}

async function loadGoalProgress() {
  const { data: goals, error } = await _supabase
    .from('goals')
    .select()
    .eq('user_id', currentUser.id)
    .order('due_date', { ascending: true });

  if (error) return console.error('Error loading goal progress:', error.message);

  const today = new Date();
  const dayOfWeek = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  weekStart.setHours(0, 0, 0, 0);

  const [{ data: weeklyGoals }, { data: weeklySessions, error: sessionError }] = await Promise.all([
    _supabase.from('weekly_goals').select('goal_hrs').eq('user_id', currentUser.id)
      .gte('week_start', weekStart.toISOString().split('T')[0]).single(),
    _supabase.from('sessions').select('start_time, end_time')
      .eq('user_id', currentUser.id)
      .gte('study_date', weekStart.toISOString().split('T')[0]),
  ]);

  if (sessionError && sessionError.code !== 'PGRST116') console.error('Error loading sessions:', sessionError.message);

  let weeklyMinutes = 0;
  if (weeklySessions) weeklySessions.forEach(s => weeklyMinutes += getDurationInMinutes(s.start_time, s.end_time));
  const weeklyHours = (weeklyMinutes / 60).toFixed(2);
  const goalHours   = weeklyGoals?.goal_hrs || 0;
  const studyProgress = goalHours > 0 ? Math.min(Math.round((weeklyHours / goalHours) * 100), 100) : 0;
  const status = studyProgress >= 100 ? 'Completed' : studyProgress >= 80 ? 'On Track' : studyProgress > 0 ? 'In Progress' : 'Not Started';

  goalProgressContainer.innerHTML = `
    <div class="div">
      <div class="space">
        <p class="primary-text">Study ${goalHours} hours/week</p>
        <span class="span">${status}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-status" style="width: ${studyProgress}%;"></div>
      </div>
    </div>
  `;

  goals.forEach(goal => {
    const goalProgress = goal.total_tasks > 0 ? (goal.done_tasks / goal.total_tasks) * 100 : 0;
    const goalStatus   = goalProgress >= 100 ? 'Completed' : goalProgress >= 80 ? 'On Track' : goalProgress > 0 ? 'In Progress' : 'Not Started';
    goalProgressContainer.innerHTML += `
      <div class="div">
        <div class="space">
          <p class="primary-text">${goal.title}</p>
          <span class="span">${goalStatus}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-status" style="width: ${goalProgress}%;"></div>
        </div>
      </div>
    `;
  });
}

async function loadSubjects() {
  const { data: subjects, error } = await _supabase.from('subjects').select();
  if (error) return console.error('Error loading subjects: ' + error.message);
  subjects.forEach(subject => subjectMap[subject.id] = subject.name);
}

function formatHour(h) {
  h = h % 24;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour   = h % 12 || 12;
  return `${hour} ${period}`;
}