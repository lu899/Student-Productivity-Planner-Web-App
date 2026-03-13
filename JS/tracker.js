import { _supabase } from "./supabase_init.js";
import { setLoadingState, updateStreakDisplay, toggle } from "./script.js";

const navlist = document.querySelector(".left-side");
const menuBar = document.querySelector(".menu-bar");
const pomodoro = document.getElementById('pomodoro-timer');
const pomodoroWidthEl = document.querySelector('.pomodoro-width');
const short = document.getElementById('short-timer');
const long = document.getElementById('long-timer');
const timers = document.querySelectorAll('.time-display');
const session = document.getElementById('pomodoro-session');
const shortBreak = document.getElementById('short-break');
const longBreak = document.getElementById('long-break');
const startBtn = document.getElementById('start');
const restartBtn = document.getElementById('restart');
const stopBtn = document.getElementById('stop');
const timerMsg = document.getElementById('timer-msg');
const subjectSelection = document.getElementById('subject-selection');
const studySessions = document.querySelector('.study-sessions');
const studyTime = document.querySelector('.study-time');
const todaySessions = document.getElementById('sessions');
const avgFocusEl = document.getElementById('avg-focus');
const totalTimeEl = document.getElementById('total-time');
const weekGoal = document.getElementById('hrs-goal');
const setWeekGoalBtn = document.getElementById('set-weekly-goal-btn');
const weeklyHrsEl = document.getElementById('done-hrs');
const expectedHrsEl = document.getElementById('total-hrs-goal');
const percentageDone = document.getElementById('percentage-done');

let currentUser = null
let currentTimer = null;
let myInterval = null;
let timerDuration = 0;
let selectedSbj = "";
let subjectMap = {};
let endTimestamp = null;
let isPaused = false;
let pausedTimeRemaining = null;
let sessionStartTime = null;
let sessionEndTime = null;
let sessionDate = null;
let pauses = 0;

document.addEventListener('DOMContentLoaded', async () => {
    setLoadingState(true);
    showDefautTimer();
    await authGuard();
    await loadSubjects();
    await loadTodaySessions();
    await loadWeeklyStudyHours();
    await updateStreakDisplay(currentUser);
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

function showDefautTimer(){
    pomodoro.style.display = 'block';
    short.style.display = 'none';
    long.style.display = 'none';
}

function hideAll(){
    timers.forEach(timer => {
        timer.style.display = 'none';
    });
}

function startTimer(timerDisplay){
    if(myInterval){
        clearInterval(myInterval);
    }

    timerDuration = timerDisplay.getAttribute('data-duration').split(':')[0];
    let durationInMilliseconds = timerDuration * 60 * 1000;

    let initialTimeRemaining;
    if(isPaused && pausedTimeRemaining !== null){
        initialTimeRemaining = pausedTimeRemaining;
        if (timerDisplay === pomodoro) {
            pauses++;
        }
    } else {
        initialTimeRemaining = durationInMilliseconds;
        let today = new Date();
        if(timerDisplay === pomodoro){
            sessionStartTime = today.toLocaleTimeString();
            sessionDate = today.toLocaleDateString();
        }
    }
    endTimestamp = Date.now() + initialTimeRemaining;
    isPaused = false;
    pausedTimeRemaining = null;

    startBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play-icon lucide-play"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>
    `
    startBtn.style.backgroundColor = 'var(--primary-color)';

    myInterval = setInterval(() => {
        const currentTime = Date.now();
        const timeRemaining = Math.max(0, endTimestamp - currentTime);
        const progress = calculateTimerProgress(durationInMilliseconds, timeRemaining);
        pomodoroWidthEl.style.background = `conic-gradient(
            var(--primary-color) calc(${progress} * 1%),
            var(--opaque-blue) 0
        )`;

        if (timerDisplay === pomodoro) {
            subjectMap[selectedSbj] += 1000;
        }

        if (timeRemaining <= 0) {
            updateSubjectDuration(selectedSbj, subjectMap[selectedSbj]);
            clearInterval(myInterval);

            timerDisplay.querySelector('.time').textContent = "00:00";
            isPaused = false;
            pausedTimeRemaining = null;

            if (timerDisplay === pomodoro) {
                sessionEndTime = new Date().toLocaleTimeString();
                insertSession(selectedSbj, sessionStartTime, sessionEndTime, sessionDate, pauses);
            }
            pauses = 0;
        } else {
            const minutes = Math.floor(timeRemaining / 60000);
            const seconds = ((timeRemaining % 60000) / 1000).toFixed(0);
            const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            timerDisplay.querySelector('.time').textContent = formattedTime;
        }
    }, 1000);    
}

function calculateTimerProgress(totalDuration, timeRemaining){
    const elapsedTime = totalDuration - timeRemaining;
    return Math.floor((elapsedTime / totalDuration) * 100);
}

async function loadSubjects() {
    const { data: { user }} = await _supabase.auth.getUser();

    if(!user){
        alert('Please log in first!');
    }

    const { data: subjects, error} = await _supabase
        .from('subjects')
        .select()
        .eq('user_id', user.id);

    if(error){
        console.log(error.message);
        return;
    }


    const noOption = document.createElement('option');
    noOption.text = 'No Subject';
    noOption.value = '';
    subjectSelection.add(noOption);

    if(subjects){
        subjects.forEach(subject => {
            const newOption = document.createElement('option');
            newOption.text = subject.name;
            newOption.value = subject.id;
            subjectSelection.add(newOption);

            subjectMap[subject.id] = subject.duration;
        });
    }
}

async function updateSubjectDuration(sbjID, sbjDuration) {
    const { data: subject, error } = await _supabase
    .from('subjects')
    .update({duration: sbjDuration})
    .select()
    .eq('id', sbjID);
    
    if (error) {
        console.log('Error updating duration: ' + error.message);        
    }
}

async function insertSession(subjectId, startTime, endTime, date, pauses) {
    const { data: { user }} = await _supabase.auth.getUser();

    if(!user){
        console.error('Please log in first');
        return;
    }

    const { error } = await _supabase.from('sessions').insert([{
        user_id: user.id,
        subject_id: subjectId,
        start_time: startTime,
        end_time: endTime,
        study_date: date,
        pauses: pauses
    }]);

    if (error) {
        console.log("Error: " + error.message);        
    }
}

async function loadTodaySessions() {
    let today = new Date();

    const { data: sessions, error } = await _supabase
    .from('sessions')
    .select()
    .eq('study_date', today.toLocaleDateString());

    if(error){
        console.log("Error: " + error.message);
        return;
    }

    studySessions.innerHTML = '';

    if(sessions){
        let totalStudyTime = 0;
        let avgFocus = 0;

        for (const session of sessions) {
            const { data, error } = await _supabase
            .from('subjects')
            .select('name')
            .eq('id', session.subject_id);

            if (error) {
                console.log("Error: " + error.message);
                return;                
            }        
            
            const mins = Math.ceil((getDuration(session.end_time) - getDuration(session.start_time)) / 60000).toFixed(0);            
            totalStudyTime += Number(mins);
            let focus = (1-(pauses / 10)) * 100;
            avgFocus += focus;

            studySessions.innerHTML += `
                <div class="study-session">
                    <div class="text">
                        <div class="span-icon opaque-green">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open-icon lucide-book-open"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>
                        </div>
                        <div class="p-text">
                            <p class="bold">${data[0].name}</p>
                            <p class="secondary-text small-text">${formatTime(session.start_time)} -${formatTime(session.end_time)}</p>
                        </div>
                    </div>
                    <div class="focus">
                        <p class="bold">${mins} min</p>
                        <div class="small-flex small-text secondary-text">
                            <div class="circle"></div> ${focus}% focus</div>
                    </div>
                </div>
            `;
        }
        
        todaySessions.textContent = sessions.length;
        let focusTxt = avgFocus / sessions.length;
        avgFocusEl.textContent = `${isNaN(focusTxt) ? 0 : focusTxt}%`;
        
        if (totalStudyTime > 60) {
            const hrs = Math.floor(totalStudyTime / 60)
            const mins = totalStudyTime % 60;
            studyTime.textContent = `${hrs} hrs ${mins} mins`;
            totalTimeEl.textContent = `${hrs} hrs ${mins} mins`;
        } else {
            studyTime.textContent = `${totalStudyTime} mins`;
            totalTimeEl.textContent = `${totalStudyTime} mins`;
        }
    } else {
        studySessions.innerHTML = `
            <div class="no-content">
                <h4>No Study Sessions Today</h4>
            </div>
        `
    }
}

async function loadWeeklyStudyHours() {
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day === 0 ? 7 : day) - 1));
    monday.setHours(0,0,0,0);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    saturday.setHours(23,59,59,999);
    const weekStart = monday.toLocaleDateString();
    const weekEnd = saturday.toLocaleDateString();

    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) {
        return;
    }

    const { data: sessions, error } = await _supabase
        .from('sessions')
        .select()
        .eq('user_id', user.id)
        .gte('study_date', weekStart)
        .lte('study_date', weekEnd);

    if (error) {
        console.log('Error fetching weekly sessions:', error.message);
        return;
    }

    const { data, error2 } = await _supabase
    .from('weekly_goals')
    .select('goal_hrs')
    .eq('week_start', monday.toISOString().split('T')[0]);

    if (error2) {
        console.log('Error fetching weekly goal:', error.message);
        return;
    }

    let totalMillis = 0;
    if (sessions && sessions.length > 0) {
        for (const session of sessions) {
            const duration = getDuration(session.end_time) - getDuration(session.start_time);
            totalMillis += duration;
        }
    }
    const totalHours = (totalMillis / (1000 * 60 * 60)).toFixed(2);
    weeklyHrsEl.textContent = totalHours;
    expectedHrsEl.textContent = data[0].goal_hrs;

    let percentage = Math.floor(totalHours / data[0].goal_hrs * 100);
    percentageDone.textContent = `${percentage}%`
    document.querySelector('.bar-status').style.width = `${percentage}%`;
    document.getElementById('more-hrs').textContent = data[0].goal_hrs - totalHours;    
}

function getDuration(time){
    const timeArr = time.split(':');

    const hours = timeArr[0] * 3600 * 1000;
    const mins = timeArr[1] * 60000;
    const secs = timeArr[2] * 1000;

    return hours + mins + secs;
}

function formatTime(time){
    const timeArr = time.split(':');
    let units = '';

    if(timeArr[0] >= 12){
        units = 'PM';
    } else {
        units = 'AM';
    }
    return `${timeArr[0]}:${timeArr[1]} ${units}`;
}

session.addEventListener('click', () => {
    hideAll();

    pomodoro.style.display = 'block';
    pomodoro.querySelector('.timer-txt').textContent = 'Focus Time (25 min)';

    session.classList.add('active-btn');
    shortBreak.classList.remove('active-btn');
    longBreak.classList.remove('active-btn');

    currentTimer = pomodoro;
});

shortBreak.addEventListener('click', () => {
    hideAll();

    short.style.display = 'block';
    short.querySelector('.timer-txt').textContent = 'Short Break (5 min)';

    shortBreak.classList.add('active-btn');
    session.classList.remove('active-btn');
    longBreak.classList.remove('active-btn');

    currentTimer = short;
});

longBreak.addEventListener('click', () => {
    hideAll();

    long.style.display = 'block';
    long.querySelector('.timer-txt').textContent = `Long Break (${long.getAttribute('data-duration')} min)`;

    longBreak.classList.add('active-btn');
    session.classList.remove('active-btn');
    shortBreak.classList.remove('active-btn');

    currentTimer = long;
});

startBtn.addEventListener('click', () => {
    if(currentTimer && selectedSbj){
        startTimer(currentTimer);
        timerMsg.style.display = 'none';
    } else {
        timerMsg.style.display = 'block';
    }
});

restartBtn.addEventListener('click', async () => {
    if (isPaused) {
        updateSubjectDuration(selectedSbj, subjectMap[selectedSbj]);
        sessionEndTime = new Date().toLocaleTimeString();
        await insertSession(selectedSbj, sessionStartTime, sessionEndTime, sessionDate, pauses);
        pauses = 0;
    }
    window.location.reload();    
});

subjectSelection.addEventListener('change', () => selectedSbj = subjectSelection.value);

stopBtn.addEventListener('click', () => {
    if(currentTimer && selectedSbj && myInterval){
        startBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pause-icon lucide-pause"><rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/></svg>
        `
        startBtn.style.backgroundColor = 'var(--warning-color)';
        isPaused = true;
        const currentTime = Date.now();
        pausedTimeRemaining = Math.max(0, endTimestamp - currentTime);
        clearInterval(myInterval);
    }
});

setWeekGoalBtn.addEventListener('click', () => {
    const hrs = weekGoal.value;
    if (!hrs || isNaN(hrs) || hrs <= 0) {
        alert('Please enter a valid number of hours.');
        return;
    }

    const today = new Date();
    const day = today.getDay();
    
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day === 0 ? 7 : day) - 1));
    monday.setHours(0,0,0,0);
    
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    saturday.setHours(23,59,59,999);

    const weekStart = monday.toISOString().split('T')[0];
    const weekEnd = saturday.toISOString().split('T')[0];

    (async () => {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            alert('Please log in first!');
            return;
        }

        const { error } = await _supabase
            .from('weekly_goals')
            .upsert([
                {
                    user_id: user.id,
                    week_start: weekStart,
                    week_end: weekEnd,
                    goal_hrs: hrs
                }
            ]);

        if (error) {
            alert('Error saving weekly goal: ' + error.message);
        } else {
            alert('Weekly goal set successfully!');
            loadWeeklyStudyHours();
        }
    })();
});

const focusDurationEl = document.getElementById('focus-duration');
focusDurationEl.addEventListener('keypress', e => {
    if (e.key == 'Enter') {
        pomodoro.setAttribute('data-duration', focusDurationEl.value);
        pomodoro.querySelector('.time').textContent = `${focusDurationEl.value}:00`;
        pomodoro.querySelector('.timer-txt').textContent = `Focus Time (${focusDurationEl.value} min)`;
        session.querySelector('.secondary-text').textContent = `${focusDurationEl.value} min`;
    }
});

const breakDurationEl = document.getElementById('break-duration');
breakDurationEl.addEventListener('keypress', e => {
    if (e.key == 'Enter') {
        long.setAttribute('data-duration', breakDurationEl.value);
        long.querySelector('.time').textContent = `${breakDurationEl.value}:00`;
        long.querySelector('.timer-txt').textContent = `Long Break (${breakDurationEl.value} min)`;
        longBreak.querySelector('.secondary-text').textContent = `${breakDurationEl.value} min`;
    }
})
menuBar.addEventListener("click", () => toggle(navlist));