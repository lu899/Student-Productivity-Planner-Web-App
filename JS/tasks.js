import { toggle, generateRandomColor, openModal, closeModal, clearModalInputValues, setLoadingState, updateStreakDisplay } from "./script.js";
import { _supabase } from "./supabase_init.js";

const navlist = document.querySelector(".left-side");
const menuBar = document.querySelector(".menu-bar");
const subjectSelect = document.getElementById("subject");
const goalsSelect = document.getElementById("goal-link");
const addTaskBtn = document.getElementById("add-task-btn");
const closeModalBtn  = document.getElementById("close-modal-btn");
const submitBtn = document.getElementById("submit-btn");
const tasksInProgressNo = document.getElementById("tasks-in-progress");
const completedTasksNo = document.getElementById("completed-tasks");
const overDueTasksNo = document.getElementById("overdue-tasks");
const addOptionBtn = document.getElementById("add-option");

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    setLoadingState(true);
    await authGuard();
    await loadTasks();
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

async function addTask(){
    const title = document.getElementById("title");
    const subject = document.getElementById("subject");
    const priority = document.getElementById("priority");
    const type = document.getElementById("type");
    const goalLink = document.getElementById("goal-link");
    const dueDate = document.getElementById("due-date");
    const dueTime = document.getElementById("due-time");
    const description = document.getElementById("description");

    const dueDateTime = new Date(`${dueDate}T${dueTime}`);
    const now = new Date();

    if (dueDateTime < now) {
        alert("Due Date and Time can't be in the past!!");
        return;
    }

    const { error} = await _supabase.from('tasks').insert([{
        title: title.value,
        user_id: currentUser.id,
        subject: subject.value,
        goal_id: goalLink.value,
        type: type.value,
        priority: priority.value,
        due_date: dueDate.value,
        due_time: dueTime.value,
        description: description.value
    }])

    if(error){
        console.log(`Error saving tasks: ${error.message}`);
    } else {
        alert("Task saved successfully!!");
        title.value = '';
        dueDate.value = '';
        dueTime.value = '';
        description.value = '';
        if(goalLink){
            updateGoalProgress(goalLink.value, 'total_tasks');
        }
        closeModal();
        loadTasks();
    }
}

async function loadTasks(){
    const { data: mytasks, error } = await _supabase
    .from("tasks")
    .select("*")
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false})
    
    if (error) {
        console.log("Error fetching data: " + error.message);
        return;
    }

    const { data: allGoals } = await _supabase.from('goals').select('id, title');
    const goalMap = {};
    if(allGoals) {
        allGoals.forEach(goal => {
            goalMap[goal.id] = goal.title;
        });
    }

    let overdue = 0;
    let inProgress = 0;
    let completed = 0;

    const tasksContainer = document.getElementById('tasks-container');
    tasksContainer.innerHTML = '';
    const deadlinesContainer = document.getElementById('deadlines-container');
    deadlinesContainer.innerHTML = '';

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Nov", "Dec"];


    mytasks.forEach(task => {
        const createdTime = new Date(task.created_at);
        const dueDateTime = new Date(`${task.due_date}T${task.due_time}`);
        const now = new Date();

        const diffDays = Math.floor((dueDateTime - now) / (1000 * 3600 * 24 ));
        const cdiffDays = Math.floor((now - createdTime) / (1000 * 3600 * 24 ));
        
        if(!task.is_completed || cdiffDays <= 7){
            showTasks(tasksContainer, task, goalMap);

            if(diffDays <= 7 && diffDays >= 0 && !task.is_completed){
                deadlinesContainer.innerHTML += `
                    <div class="task" style="padding: 8px; justify-content: space-between;">
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
        
        if(task.is_completed){
            completed++;
        } else{            
            if(diffDays < 0){
                overdue++;
            } else {
                inProgress++;
            }
        }
    })

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

    tasksInProgressNo.textContent = inProgress;
    completedTasksNo.textContent = completed;
    overDueTasksNo.textContent = overdue;
}

function showTasks(tasksContainer, task, goalMap){
    tasksContainer.innerHTML += `
        <div class="task">
            <div class="line"></div>
            <div class="task-text">
                <p class="primary-text bold" style="margin-bottom: 5px; ${task.is_completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${task.title}</p>
                <span class="task-goal-link ${task.goal_id ? '' : 'no-goal'}">
                    🎯 ${task.goal_id && goalMap[task.goal_id] ? goalMap[task.goal_id] : "No Goal"}
                </span>
                <span class="priority-text">${task.priority}</span>
            </div>
            <div class="task-checkbox ${task.is_completed ? 'checked' : ''}"
                data-task-id="${task.id}"
                data-completed="${task.is_completed ? 'true' : 'false'}"
                onclick="toogleTask(this)">
                ${task.is_completed ? '✔' : ''}
            </div>
        </div>
    `;
    const line = tasksContainer.lastElementChild.querySelector('.line');
    generateRandomColor(line, task.priority);
}

window.toogleTask = async function(el) {
    const taskId = el.dataset.taskId;
    const currentStatus = el.dataset.completed === 'true';

    const { data, error } = await _supabase
        .from('tasks')
        .update({ is_completed: !currentStatus })
        .eq('id', taskId)
        .select();
    
    if(error){
        console.log("Error: " + error.message);
        return;
    }

    data.forEach(async t => {
        if(t.goal_id){
            await updateGoalProgress(t.goal_id, 'done_tasks', t.is_completed);
        }
    })

    loadTasks();
}

async function loadSubjects() {
    const { data: subjects, error} = await _supabase
        .from('subjects')
        .select('name')
        .eq('user_id', currentUser.id);

    if(error){
        console.log(error.message);
        return;
    }

    subjectSelect.innerHTML = '';
    if(subjects){
        subjects.forEach(subject => {
            const newOption = document.createElement('option');
            newOption.text = subject.name;
            newOption.value = subject.name.toLowerCase();
            subjectSelect.add(newOption);
        });
    }
}

async function saveSubjectToDatabase(sbjText, userId) {
    await _supabase.from('subjects').insert([{
        name: sbjText,
        user_id: userId
    }]);
}

function addSubject(){
    const optionEL = document.getElementById("new-option");
    optionEL.classList.toggle('no-display');

    optionEL.addEventListener('keypress', async e => {
        if(e.key === 'Enter'){
            e.preventDefault();
            let optionTxt = optionEL.value;

            if(optionTxt.trim() != ''){
                await saveSubjectToDatabase(optionTxt, currentUser.id);

                const newOption = document.createElement('option');
                newOption.text = optionTxt;
                newOption.value = optionTxt.toLowerCase();

                subjectSelect.add(newOption);
                optionEL.value = '';
                optionEL.classList.add('no-display');
            } else {
                alert('Please enter a value for the new option.')
            }
        }
    });
}

async function loadGoals(){
    const { data: goals, error} = await _supabase
    .from('goals')
    .select()
    .eq('user_id', currentUser.id);

    if(error){
        console.log("Error loading goals" + error.message);
        return;
    }

    goalsSelect.innerHTML = '';
    if(goals){
        goals.forEach(goal => {
            const option = document.createElement('option');
            option.text = goal.title;
            option.value = goal.id;
            goalsSelect.add(option);
        })
    }

    const optionObj = document.createElement('option');
    optionObj.text = 'No Associated Goal';
    optionObj.value = null,
    goalsSelect.add(optionObj);
}

async function updateGoalProgress(goalId, column, status=false) {
    const { data: goals, error } = await _supabase
    .from('goals')
    .select()
    .eq('id', goalId);

    if(error){
        console.log("Error getting goal: " + error.message);
        return 0;
    }

    const goal = goals[0];
    
    let newValue = goal[column];

    if(column === 'total_tasks'){
        newValue++;
    } else if(column === 'done_tasks'){
        if(status){
            newValue++;
        } else {
            newValue--;
        }
    } else {
        console.log("Wrong column value. Couldn't update goal!!");
        return 0;
    }

    const { error: updateError } = await _supabase
    .from('goals')
    .update({[column]: newValue})
    .eq('id', goalId);

    if(updateError){
        console.log("Error updating goal: " + updateError.message);
        return 0;
    }

    if(goal.total_tasks === goal.done_tasks){
        markGoalStatus(goal.id, true);
    } else {
        markGoalStatus(goal.id, false);
    }
    return newValue;
}

async function markGoalStatus(goalID, status){
    const { error } = await _supabase
    .from('goals')
    .update({is_completed: status})
    .eq('id', goalID);

    if (error) {
        console.log(error.message);   
    }    
}

menuBar.addEventListener("click", () => toggle(navlist));
addTaskBtn.addEventListener("click", async () => {
    setLoadingState(true);
    await loadSubjects();
    await loadGoals();
    openModal();
    setLoadingState(false);
});
addOptionBtn.addEventListener("click", addSubject);

if(closeModalBtn){
    closeModalBtn.addEventListener("click", closeModal);
}

if(submitBtn){
    submitBtn.addEventListener("click", addTask);
    clearModalInputValues();
}