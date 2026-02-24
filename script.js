const pomodoro = document.getElementById("pomodoro-timer");
const short = document.getElementById("short-timer");
const long = document.getElementById("long-timer");
const timers = document.getElementById("timer-display");
const session = document.getElementById("pomodoro-session");
const shortBreak = document.getElementById("short-break");
const longBreak = document.getElementById("long-break");
const startBtn = document.getElementById("start");
const restartBtn = document.getElementById("restart");
const stopBtn = document.getElementById("stop");
const btn = document.querySelector(".button");
const menuBar = document.querySelector(".menu-bar");
const navBar = document.querySelector(".nav-bar");
const navlist = document.querySelector(".left-side");
const btnGroup = document.querySelector(".btn-group");
const tasks = document.querySelectorAll(".line");

let currenttimer = null;
let myInterval = null;
let visible = false;

// function showDefaultTimer(){
//     pomodoro.style.display = "block";
//     short.style.display = "none";
//     long.style.display = "none";
// }

// showDefaultTimer()

// function hideAll(){

// }

function showNavBar(){
    navBar.classList.toggle("bar-active");
    btnGroup.classList.toggle("bar-active");
}

function toggle(){
    navlist.classList.toggle("visible");
}

const colors = ['--primary-color', '--secondary-color', '--pink-accent', '--success-color', '--warning-color'];

tasks.forEach(task => {
    let i = Math.floor(Math.random() * colors.length);
    const colorVar = colors[i];
    task.style.background = `var(${colorVar})`;

    const computedColor = getComputedStyle(task).backgroundColor;

    // Convert rgb/rgba to rgba with 0.2 opacity
    function toRgbaWithAlpha(rgb, alpha) {
        const match = rgb.match(/rgba?\(([^)]+)\)/);
        if (!match) return rgb;
        let parts = match[1].split(',').map(s => s.trim());
        if (parts.length === 3) parts.push(alpha);
        else if (parts.length === 4) parts[3] = alpha;
        return `rgba(${parts.join(',')})`;
    }

    // Find .priority-text in the same .task
    const taskDiv = task.closest('.task');
    if (taskDiv) {
        const priority = taskDiv.querySelector('.priority-text');
        const checkmark = taskDiv.querySelector('.checkmark')
        if (priority) {
            priority.style.background = toRgbaWithAlpha(computedColor, 0.2);
            priority.style.color = computedColor;
        }
        if (checkmark) {
            console.log('m');
            
            checkmark.style.border = `2px solid var(${colorVar})`;
        }
    }
});

// CALENDAR FUNCTIONALITY
let currentDate = new Date();
let currentView = 'month';
let events = [];

function calendarInit(){    
    updateMonthYearDisplay();
    if(currentView == 'month'){
        renderMonthView();
    } else if(currentView == 'week'){
        renderWeekView();
    } else {
        renderDayView();
    }
}

function updateMonthYearDisplay(){
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('monthYear').textContent = `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
}

function renderMonthView(){
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    days.forEach(day => {
        const header = document.createElement('div');
        header.className = 'day-header';
        header.textContent = day;
        grid.appendChild(header);
    })

    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const prevLastDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);

    const firstDayIndex = firstDay.getDay();
    const lastDayDate = lastDay.getDate();
    const prevLastDayDate = prevLastDay.getDate();

    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const cell = createDayCell(prevLastDayDate-i, true);
        grid.appendChild(cell);
    }

    for (let day = 1; day <= lastDayDate; day++) {
        const cell = createDayCell(day, false);
        grid.appendChild(cell);
    }
}

function createDayCell(day, isOtherMonth){
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if (isOtherMonth) cell.classList.add('other-month');

    const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const today = new Date();

    if(!isOtherMonth &&
        cellDate.getDate() === today.getDate() &&
        cellDate.getMonth() === today.getMonth() &&
        cellDate.getFullYear() === today.getFullYear()) {
            cell.classList.add('today');
    }

    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = day;
    cell.appendChild(dayNumber);

    if(!isOtherMonth){
        const dayEvents = getEventsForDate(cellDate);
        dayEvents.forEach(event => {
            const eventEl = document.createElement('div');
            eventEl.className = `event ${event.type}`;
            eventEl.textContent = event.title;
            eventEl.onclick = e => {
                e.stopPropagation();
                showEventDetails(event);
            };
            cell.appendChild(eventEl);
        });
    }

    cell.onclick = () => openModal(cellDate);
    return cell;
}

function getEventsForDate(date){
    return events.filter(event => 
        event.date.getDate() === date.getDate() &&
        event.date.getMonth() === date.getMonth() &&
        event.date.getFullYear() === date.getFullYear()
    );
}

function renderWeekView(){
    const grid = document.getElementById('weekGrid');
    grid.innerHTML = '';

    const days =  ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const times = ['8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM'];

    grid.appendChild(createTimeSlot(''));
    days.forEach(day => {
        const header = document.createElement('div');
        header.className = 'time-slot';
        header.textContent = day;
        grid.appendChild(header);
    });

    times.forEach(time => {
        grid.appendChild(createTimeSlot(time));
        for(let i=0; i<7; i++){
            const cell = document.createElement('div');
            cell.className = 'week-day-cell';
            grid.appendChild(cell);
        }
    });
}

function createTimeSlot(time){
    const slot = document.createElement('div');
    slot.className = 'time-slot';
    slot.textContent = time;
    return slot;
}

function renderDayView(){
    const schedule = document.getElementById('daySchedule');
    schedule.innerHTML = '<h2>Today\'s Schedule</h2>';

    const dayEvents = getEventsForDate();
    dayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime));

    dayEvents.forEach(event => {
        const item = document.createElement('div');
        item.className = 'schedule-item';
        item.style.borderLeftColor = getEventColor(event.type);

        item.innerHTML = `
            <div class="schedule-time">${event.startTime} = ${event.endTime}</div>
            <div class="schedule-details>
                <div class="schedule-title">${event.title}</div>
                <div class="schedule-description">${event.description}</div>
            </div>
        `;
        schedule.appendChild(item);
    });

    if (dayEvents.length === 0) {
        schedule.innerHTML += '<p style="text-align: center; color: var(--text-secondary); padding: 40px;"> No events scheudled for this day</p>';
    }
}

function getEventColor(type){
    const colors = {
        study: '#3b82f6',
        exam: '#ef4444',
        assignment: '#f59e0b',
        break: '#10b981'
    };
    return colors[type] || '#6366f1';
}

function switchView(view) {
    currentView = view;

    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active-cal'));
    event.target.classList.add('active-cal');

    const month = document.getElementById('monthView');
    month.style.display = "none"
    month.classList.remove('active-cal');

    const week = document.getElementById('weekView');
    week.style.display = "none"
    week.classList.remove('active-cal');

    const day = document.getElementById('dayView');
    day.style.display = "none"
    day.classList.remove('active-cal');

    const currView = document.getElementById(view + 'View');
    currView.style.display = "block";
    currView.classList.add('active-cal');
    calendarInit();
}

function previousPeriod() {
    if (currentView === 'month') {
        currentDate.setMonth(currentDate.getMonth() - 1);
    } else if (currentView === 'week') {
        currentDate.setDate(currentDate.getDate() - 7);
    } else {
        currentDate.setDate(currentDate.getDate() - 1);
    }
    calendarInit();
}

function nextPeriod() {
    if (currentView === 'month') {
        currentDate.setMonth(currentDate.getMonth() + 1);
    } else if (currentView === 'week') {
        currentDate.setDate(currentDate.getDate() + 7);
    } else {
        currentDate.setDate(currentDate.getDate() + 1);
    }
    calendarInit();
}

function today() {
    currentDate = new Date();
    calendarInit();
}

function openModal(date){
    document.querySelector('.modal').style.display = 'flex'
    if (date) {
        document.getElementById('eventDate').value = date.toISOString().split('T')[0];
    }
}

function closeModal() {
    document.querySelector('.modal').style.display = 'none'
}

function addEvent(e){
    e.preventDefault();

    const newEvent = {
        id: events.length + 1,
        title: document.getElementById('eventTitle').value,
        type: document.getElementById('eventType').value,
        date: new Date(document.getElementById('eventDate').value),
        startTime: document.getElementById('eventStartTime').value,
        endTime: document.getElementById('eventEndTime').value,
        description: document.getElementById('eventDescription').value
    };

    events.push(newEvent);
    closeModal();
    calendarInit();
}

function showEventDetails(event){
    alert(`${event.title}\n\nType: ${event.type}\nDate: ${event.date.toDateString()}\nTime: ${event.startTime} = ${event.endTime}\n\n${event.description}`);
}
calendarInit();


document.querySelectorAll('.tab-btn')[0].onclick = previousPeriod;
document.querySelectorAll('.tab-btn')[1].onclick = today;
document.querySelectorAll('.tab-btn')[2].onclick = nextPeriod;