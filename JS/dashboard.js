import { _supabase } from "./supabase_init.js";
import { toggle, updateStreakDisplay, generateRandomColor, setLoadingState, getDurationInMinutes } from "./script.js";

const navlist = document.querySelector(".left-side");
const menuBar = document.querySelector(".menu-bar");
const username = document.getElementById('username');
const tasksContainer = document.getElementById('tasks-container');
const deadlinesContainer = document.getElementById('deadlines-container');
const doneTasks = document.getElementById('task-completed');
const totalTasksEl = document.getElementById('total-tasks');
const studyHrsEl = document.getElementById('study-hrs');

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    setLoadingState(true);
    await authGuard();
    await Promise.all([
        checkUser(),
        viewTasks(),
        loadStudyHours()
    ]);
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

async function viewTasks(){
  const { data: mytasks, error } = await _supabase
    .from("tasks")
    .select("*")
    .order('created_at', { ascending: false})
    
  if (error) {
      console.log("Error fetching data: " + error.message);
      return;
  }

  let goalsCompleted = 0;

   const { data: allGoals } = await _supabase.from('goals').select('id, title, is_completed');
    const goalMap = {};
    if(allGoals) {
        allGoals.forEach(goal => {
            goalMap[goal.id] = goal.title;
            if(goal.is_completed) goalsCompleted++;
        });
    }

    document.getElementById('goals-achieved').textContent = `${goalsCompleted}/${allGoals.length}`;

  let tasksCompleted = 0;
  let totalTasks = 0;

  tasksContainer.innerHTML = '';
  deadlinesContainer.innerHTML = '';

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Nov", "Dec"];

  mytasks.forEach(task => {
      const createdTime = new Date(task.created_at);
      const dueDateTime = new Date(`${task.due_date}T${task.due_time}`);
      const now = new Date();
      const diffDays = Math.floor((dueDateTime - now) / (1000 * 3600 * 24 ));
      const cdiffDays = Math.floor((now - createdTime) / (1000 * 3600 * 24 ));

      if(!task.is_completed || cdiffDays <= 7){
          tasksContainer.innerHTML += `
              <div class="task">
                  <div class="line"></div>
                  <div class="task-text">
                      <p class="primary-text bold" style="${task.is_completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${task.title}</p>
                      <div class="task-details">
                          <span class="task-goal-link ${task.goalId ? '' : 'no-goal'}">
                              🎯 ${task.goal_id && goalMap[task.goal_id] ? goalMap[task.goal_id] : "No Goal"}
                          </span>
                          <span class="priority-text">${task.priority}</span>
                      </div>
                  </div>
                  <div class="task-checkbox ${task.is_completed ? 'checked' : ''}"
                      data-task-id="${task.id}"
                      data-completed="${task.is_completed ? 'true' : 'false'}"
                      onclick="markTask(this)">
                      ${task.is_completed ? '✔' : ''}
                  </div>
              </div>
          `;
          const line = tasksContainer.lastElementChild.querySelector('.line');
          generateRandomColor(line, task.priority);

          if(diffDays <= 7 && diffDays >= 0 && !task.is_completed){
              deadlinesContainer.innerHTML += `
                  <div class="task" style="padding: 8px;">
                      <div class="left">
                          <div class="line"></div>
                          <div class="task-text" style="display: flex; flex-direction: column; gap: 5px; padding: 8px;">
                              <p class="primary-text bold">${task.title}</p>
                              <p class="secondary-text">${months[dueDateTime.getMonth()]} ${dueDateTime.getDate()}</p>
                          </div>
                      </div>
                      <span class="priority-text">${task.priority}</span>
                  </div>
              `
              const line2 = deadlinesContainer.lastElementChild.querySelector('.line');
              generateRandomColor(line2, task.priority);
          }
        }
      
      totalTasks++;
      if(task.is_completed){
        tasksCompleted++;
      }
  });

  if(tasksContainer.innerHTML === ''){
      tasksContainer.innerHTML += `
          <div class="no-content">
              <h4>No Available Tasks</h4>
          </div>
      `
  }
  if(deadlinesContainer.innerHTML === ''){
      deadlinesContainer.innerHTML += `
          <div class="no-content">
              <h4>No Upcoming Deadlines</h4>
          </div>
      `
  }
  doneTasks.textContent = tasksCompleted;
  totalTasksEl.textContent = totalTasks;
}

window.markTask = async function(el) {
    const taskId = el.dataset.taskId;
    const currentStatus = el.dataset.completed === 'true';

    const { error } = await _supabase
        .from('tasks')
        .update({ is_completed: !currentStatus })
        .eq('id', taskId);
    
    if(error){
        console.log("Error: " + error.message);
        return;
    }

    loadTasks();
}

async function checkUser() {
  const { data: { user } } = await _supabase.auth.getUser();

  if (!user) {
    window.location.href = 'index.html';
  } else {
    username.textContent = user.user_metadata.first_name;
  }
}

async function loadStudyHours(){
    const { data, error } = await _supabase
    .from('sessions')
    .select()
    .eq('user_id', currentUser.id);

    if(error) return console.error('Error Retrieving sessions: ' + error.message);
    let tltMins = 0;

    if(data){
        data.forEach(s => tltMins += getDurationInMinutes(s.start_time, s.end_time));
    }
    studyHrsEl.textContent = `${(tltMins / 60).toFixed(2)} Hrs`;
}
menuBar.addEventListener("click", () => toggle(navlist));