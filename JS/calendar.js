import { _supabase } from "./supabase_init.js";
import { updateStreakDisplay, openModal, closeModal, toggle, setLoadingState } from "./script.js";

const monthYear = document.getElementById('monthYear');
const addEventBtn = document.querySelector('.add-event-btn');
const closeModalBtn  = document.getElementById("close-modal-btn");
const submitBtn = document.querySelector('.submit-btn');
const viewBtns = document.querySelectorAll('.view-btn');
const menuBar = document.querySelector(".menu-bar");
const navlist = document.querySelector(".left-side");
const tabBtns = document.querySelectorAll('.tab-btn');

let currentDate = new Date();
let currentView = 'month';

document.addEventListener('DOMContentLoaded', async () => {
    setLoadingState(true);
    await calendarInit();
    await updateStreakDisplay(currentUser);
    setLoadingState(false);
})

async function calendarInit(){    
    updateMonthYearDisplay();
    if(currentView == 'month'){
        setLoadingState(true);
       await renderMonthView();
       setLoadingState(false);
    } else if(currentView == 'week'){
        setLoadingState(true);
        await renderWeekView();
        setLoadingState(false);
    } else {
        renderDayView();
    }
}

function updateMonthYearDisplay(){
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    monthYear.textContent = `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
}

async function renderMonthView(){
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
        const cell = await createDayCell(prevLastDayDate-i, true);
        grid.appendChild(cell);
    }

    for (let day = 1; day <= lastDayDate; day++) {
        const cell = await createDayCell(day, false);
        grid.appendChild(cell);
    }
}

async function createDayCell(day, isOtherMonth){
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
        const dateStr = formatDate(cellDate);
        const dayEvents = await getEventsForDate(dateStr);
        
        if (dayEvents.length > 0) {
            dayEvents.forEach(event => {
                const eventEl = document.createElement('div');
                eventEl.className = `event ${event.type}`;
                eventEl.textContent = event.title;
                eventEl.setAttribute('data-completed', event.is_completed);
                eventEl.setAttribute('data-event-id', event.id);
                eventEl.style.textDecoration = event.is_completed ? 'line-through' : 'none';
                eventEl.onclick = async e => {
                    e.stopPropagation();
                    showEventDetails(event);
                    if (confirm("Do you want to mark as Completed?")) {
                        await markCompleted(eventEl);
                    }
                };
                cell.appendChild(eventEl);
            });
        }
    }

    cell.onclick = () => openModal(cellDate);
    return cell;
}

async function getEventsForDate(date){
    const { data: events, error } = await _supabase
        .from("schedule")
        .select()
        .eq('on_date', date);

    if(error){
        console.log("Error: " + error.message);
        return [];
    }
    
    return events || [];   
}

function formatDate(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function renderWeekView(){
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

    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());
    console.log(weekStart.getDate());
    
    // Fetch events for the entire week
    const weekEvents = {};
    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + i);
        const dateStr = formatDate(dayDate);
        const dayEventsData = await getEventsForDate(dateStr);
        weekEvents[dateStr] = dayEventsData || [];
    }
    
    // Create time slots and cells
    times.forEach((time, timeIndex) => {
        grid.appendChild(createTimeSlot(time));
        
        for(let dayIndex = 0; dayIndex < 7; dayIndex++){
            const cell = document.createElement('div');
            cell.className = 'week-day-cell';
            
            // Get date for this day
            const dayDate = new Date(weekStart);
            dayDate.setDate(weekStart.getDate() + dayIndex);
            const dateStr = formatDate(dayDate);
            
            // Get events for this day
            const dayEventsData = weekEvents[dateStr] || [];
            
            // Find events that match this time slot
            const timeHour = parseInt(time.split(' ')[0]);
            
            const slotEvents = dayEventsData.filter(event => {
                const eventHour = parseInt(convert24to12hr(event.starttime).split(':')[0]);
                return eventHour === timeHour;
            });
            
            // Add event to cell if found
            if(slotEvents.length > 0) {
                slotEvents.forEach(event => {
                    const eventEl = document.createElement('div');
                    eventEl.className = `week-event ${event.type}`;
                    eventEl.style.background = getEventColor(event.type);
                    eventEl.textContent = event.title;
                    eventEl.onclick = e => {
                        e.stopPropagation();
                        showEventDetails(event);
                    };
                    cell.appendChild(eventEl);
                });
            }
            
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

function convert24to12hr(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

async function renderDayView(){
    const schedule = document.getElementById('daySchedule');
    schedule.innerHTML = '<h2>Today\'s Schedule</h2>';

    const date = formatDate(new Date());
    const dayEvents = await getEventsForDate(date);
    dayEvents.sort((a, b) => a.starttime.localeCompare(b.starttime));

    dayEvents.forEach(event => {
        const item = document.createElement('div');
        item.className = 'schedule-item';
        item.style.borderLeftColor = getEventColor(event.type);

        item.innerHTML = `
            <div class="schedule-time">${convert24to12hr(event.starttime)} - ${convert24to12hr(event.endtime)}</div>
            <div class="schedule-details">
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

async function addEvent(e){
    e.preventDefault();

    const { data: { user } } = await _supabase.auth.getUser();

    if(!user){
        alert('Please log in first!');
        return;
    }

    const title = document.getElementById("eventTitle");
    const priority = document.getElementById("priority");
    const type = document.getElementById("eventType");
    const date = document.getElementById("eventDate");
    const startTime = document.getElementById("eventStartTime");
    const endTime = document.getElementById("eventEndTime");
    const description = document.getElementById("eventDescription");

    const dateTime = new Date(`${date}T${endTime}`);

    if(dateTime < new Date()){
        alert("You can't create a past event");
        return;
    }

    const { error } = await _supabase.from('schedule').insert([{
        title: title.value,
        type: type.value,
        priority: priority.value,
        on_date: date.value,
        starttime: startTime.value,
        endtime: endTime.value,
        description: description.value,
        user_id: user.id
    }])

    if(error){
        console.log(`Error adding event: ${error.message}`);
    } else {
        alert("Event saved successfully!!");
        title.value = '';
        date.value = '';
        startTime.value = '';
        endTime.value = '';
        description.value = '';
    }

    closeModal();
    calendarInit();
}

async function markCompleted(eventElement) {
    const eventId = eventElement.getAttribute('data-event-id');
    const isCurrentlyCompleted = eventElement.getAttribute('data-completed') === 'true';
    const newCompletedStatus = !isCurrentlyCompleted;

    const { data, error } = await _supabase
        .from("schedule")
        .update({ is_completed: newCompletedStatus })
        .eq('id', eventId);

    if (error) {
        return console.error("Error updating completion status: " + error.message);
    }

    eventElement.setAttribute('data-completed', newCompletedStatus);
    eventElement.style.textDecoration = newCompletedStatus ? 'line-through' : 'none';
}

function showEventDetails(event){
    alert(`${event.title}\n\nType: ${event.type}\nPriority: ${event.priority}\nDate: ${event.on_date}\nTime: ${convert24to12hr(event.starttime)} - ${convert24to12hr(event.endtime)}\n\n${event.description}`);
}

viewBtns.forEach(btn => btn.addEventListener('click', () => switchView(btn.textContent.toLowerCase())));
menuBar.addEventListener("click", () => toggle(navlist));
addEventBtn.addEventListener('click', openModal);
tabBtns[0].addEventListener('click', previousPeriod);
tabBtns[1].addEventListener('click', today);
tabBtns[2].addEventListener('click', nextPeriod);

if(closeModalBtn){
    closeModalBtn.addEventListener("click", closeModal);
}

if(submitBtn){
    submitBtn.addEventListener("click", addEvent)
}