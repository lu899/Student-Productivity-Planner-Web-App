import { toggle, toRgbaWithAlpha, openModal, closeModal, months, setLoadingState, updateStreakDisplay } from "./script.js";
import { _supabase } from "./supabase_init.js";

const navlist = document.querySelector(".left-side");
const menuBar = document.querySelector(".menu-bar");
const addGoalBtn = document.getElementById('add-goal-btn');
const closeModalBtn  = document.getElementById("close-modal-btn");
const submitGoalBtn = document.getElementById('save-goal-btn');
const activeShortTerm = document.getElementById('st-active-goals');
const activeLongTerm = document.getElementById('lt-active-goals');
const activeEl = document.getElementById("no-active");
const completedEl = document.getElementById("no-completed");
const onTrackEl = document.getElementById("no-onTrack");
const needAttentionEl = document.getElementById("no-needAttention");
const completedGoals = document.querySelector(".weeks-focus-list");

let currentEditingGoalId = null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    setLoadingState(true);
    await authGuard();
    await loadGoals();
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

async function addGoal() {    
    const title = document.getElementById('title');
    const description = document.getElementById('description');
    const category = document.getElementById('category');
    const goalType = document.getElementById('goal-type');
    const priority = document.getElementById('priority');
    const deadline = document.getElementById('deadline');
    
    const goalData = {
        title: title.value,
        description: description.value,
        type: goalType.value,
        category: category.value,
        priority: priority.value,
        due_date: deadline.value
    };

    let error;
    if (currentEditingGoalId) {
        // Update existing goal
        const { error: updateError } = await _supabase
            .from('goals')
            .update(goalData)
            .eq('id', currentEditingGoalId);
        error = updateError;
    } else {
        // Create new goal
        const { error: insertError } = await _supabase
            .from('goals')
            .insert([{
                ...goalData,
                user_id: currentUser.id,
                total_tasks: 0,
                done_tasks: 0
            }]);
        error = insertError;
    }

    if (error) {
        console.log(error.message);
    } else{
        alert(currentEditingGoalId ? 'Goal updated successfully!!' : 'Goal saved successfully!!');
        title.value = '';
        description.value = '';
        deadline.value = '';
        currentEditingGoalId = null;
        submitGoalBtn.textContent = 'Save Goal';
        closeModal();
        loadGoals();
    }
}

async function loadGoals(){
    const { data: goals, error } = await _supabase
    .from('goals')
    .select()
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false});

    if(error){
        console.log("Error fetching data: " + error.message);
        return;        
    }

    const shortTermContainer = document.querySelector('.short-term-container');
    const longTermContainer = document.querySelector('.long-term-container');

    shortTermContainer.innerHTML = '';
    longTermContainer.innerHTML = '';
    completedGoals.innerHTML = '';

    let active = 0;
    let completed = 0;
    let onTrack = 0;
    let needAttention = 0;
    let stActiveCount = 0;
    let ltActiveCount = 0;

    for (const goal of goals) {
        const deadline = new Date(goal.due_date);
        const progress = await calculateGoalProgress(goal.id);

        const now = new Date();
        const diffDays = Math.floor((deadline - now) / (1000 * 3600 * 24 ));

        if(progress > 0 && !goal.is_completed){
            active++;
        }

        if (goal.is_completed) {
            completed++;
        }
        
        if(!goal.is_completed && diffDays > 3 && progress > 80 ){
            onTrack++;
        }

        if(!goal.is_completed && diffDays < 3){
            needAttention++;
        }

        if(!goal.is_completed){
            if(goal.type.toLowerCase() === 'short-term'){
                if(goal.done_tasks > 0){
                    ++stActiveCount;                
                }
                shortTermContainer.innerHTML += `
                    <div class="goal secondary-text" style="background-color: ${diffDays < 3 ? 'var(--opaque-orange)' : 'var(--opaque-blue)'};">
                        <div class="goal-heading">
                            <div class="main-text">
                                <h4>${goal.title}</h4>
                                <p>${goal.description != null ? goal.description : 'No description'}</p>
                            </div>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <span class="priority">${goal.priority}</span>
                                <i class="fa-solid fa-pen edit-goal" data-goal-id="${goal.id}" onclick="editGoal(this)"></i>
                            </div>
                        </div>
                        <div class="goal-info">
                            <div class="info-icons">
                                <span><i class="fa-solid fa-calendar"></i> ${months[deadline.getMonth()]} ${deadline.getDate()}, ${deadline.getFullYear()}</span>
                                <span><i class="fa-solid fa-square-check"></i> ${goal.done_tasks}/${goal.total_tasks} tasks</span>
                                <span>${goal.category}</span>
                            </div>
                            <i class="fa-solid fa-trash delete-goal" data-goal-id="${goal.id}" onclick="deleteGoal(this)"></i>
                        </div>
                        <div class="progress">
                            <div class="progress-text">
                                <p>Progress</p>
                                <p class="percentage">${progress}%</p>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-status" style="width: ${progress}%"></div>
                            </div>
                        </div>
                    </div>
                `;

                generateColors(goal, shortTermContainer);
            } else {
                if(goal.done_tasks > 0){
                ltActiveCount++;
                }
                longTermContainer.innerHTML += `
                    <div class="long-term-goal secondary-text">
                        <div class="long-term-goal-header">
                            <div>
                                <h4>${goal.title}</h4>
                                <p>${goal.description}</p>
                            </div>
                            <div>
                                <span class="priority">${goal.priority}</span>
                                <p class="percentage big-text">${progress}%</p>
                            </div>
                            
                        </div>
                        <div class="info-icons">
                            <span><i class="fa-solid fa-calendar"></i> ${months[deadline.getMonth()]} ${deadline.getFullYear()}</span>
                            <span><i class="fa-solid fa-bullseye"></i> ${goal.done_tasks}/${goal.total_tasks} tasks</span>
                            <i class="fa-solid fa-pen edit-goal" data-goal-id="${goal.id}" onclick="editGoal(this)"></i>
                            <i class="fa-solid fa-trash delete-goal" data-goal-id="${goal.id}" onclick="deleteGoal(this)"></i>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-status" style="width: ${progress}%"></div>
                        </div>
                    </div>
                `;
                generateColors(goal, longTermContainer);
            }
        } else {
            completedGoals.innerHTML += `
                <div class="goal-item">
                    <div class="goal-header">
                        <div class="goal-title">${goal.title}</div>
                            <span class="goal-badge badge-${goal.priority}">${goal.priority}</span>
                    </div>
                    <div class="goal-meta">
                        <span>📅 ${months[deadline.getMonth()]} ${deadline.getFullYear()}</span>
                        <span>📋 ${goal.total_tasks} tasks</span>
                        <span>✓ ${goal.done_tasks} completed</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-status" style="width: ${progress}%"></div>
                    </div>
                    <div style="text-align: right; margin-top: 5px; font-size: 0.85rem; color: #6366f1; font-weight: 600;">
                        ${progress}% Complete
                    </div>
                </div>
            `;
        }
    }

    activeEl.textContent = active;
    completedEl.textContent = completed;
    onTrackEl.textContent = onTrack;
    needAttentionEl.textContent = needAttention;
    activeShortTerm.textContent = stActiveCount;
    activeLongTerm.textContent = ltActiveCount;

    if(shortTermContainer.innerHTML === ''){
        shortTermContainer.innerHTML += `
            <div class="no-content">
                <h4>No Short Term Goals</h4>
            </div>
        `
    }
    if(longTermContainer.innerHTML === ''){
        longTermContainer.innerHTML += `
            <div class="no-content">
                <h4>No Long Term Goals</h4>
            </div>
        `
    }
    if(completedGoals.innerHTML === ''){
        completedGoals.innerHTML += `
            <div class="no-content">
                <h4>No Completed Goals</h4>
            </div>
        `
    }
}

async function calculateGoalProgress(goalId) {
    const { data: goalTasks, error} = await _supabase
    .from('tasks')
    .select()
    .eq('goal_id', goalId);
    
    
    if (goalTasks.length === 0) return 0;

    const completed = goalTasks.filter(t => t.is_completed).length;

    return Math.round((completed / goalTasks.length) * 100);
}

window.editGoal = async el => {
    const goalID = el.dataset.goalId;

    const { data: goal, error } = await _supabase
        .from('goals')
        .select()
        .eq('id', goalID)
        .single();

    if (error) {
        console.error('Error fetching goal: ' + error.message);
        alert('Error loading goal for editing');
        return;
    }

    // Pre-fill the form with goal data
    document.getElementById('title').value = goal.title;
    document.getElementById('description').value = goal.description || '';
    document.getElementById('category').value = goal.category;
    document.getElementById('goal-type').value = goal.type;
    document.getElementById('priority').value = goal.priority;
    document.getElementById('deadline').value = goal.due_date;

    // Set the editing state and change button text
    currentEditingGoalId = goal.id;
    submitGoalBtn.textContent = 'Update Goal';

    // Open the modal
    openModal();
}

window.deleteGoal = async el => {
    if (confirm("Are you sure you want to delete this goal")) {
        const goalID = el.dataset.goalId;
        const taskIds = await getTasksLinkedToGoal(goalID);

        if (taskIds && taskIds.length > 0) {
            const res = await _supabase
            .from('tasks')
            .delete()
            .in('id', taskIds);

            if (res.error) {
                console.error('Error deleting tasks: ' + res.error.message);
                alert('Error deleting goal tasks');
                return;
            }
        }

        const response = await _supabase
        .from('goals')
        .delete()
        .eq('id', goalID);

        if (response.error) {
            alert('Error deleting goal: ' + response.error.message);
        } else {
            alert('Goal deleted successfully!!');
            loadGoals();
        }
    }
}

async function getTasksLinkedToGoal(goalID){
    const { data, error } = await _supabase
    .from('tasks')
    .select('id')
    .eq('goal_id', goalID);

    if(error) return console.error('Error retrieving tasks: ' + error.message);
    
    return data.map(goal => goal.id);
}

function generateColors(goal, container){
    const prioritySpan = container.lastElementChild.querySelector('.priority');
    const percentage = container.lastElementChild.querySelector('.percentage');

    const colors = ['--secondary-color', '--pink-accent', '--success-color'];
    const priorities = ['high', 'medium', 'low'];
    
    let i = priorities.indexOf(goal.priority);
    if(i != -1){
        percentage.style.color = `var(${colors[i]})`;
        prioritySpan.style.color = `var(${colors[i]})`;

        const computedColor = getComputedStyle(percentage).color;
        prioritySpan.style.backgroundColor = toRgbaWithAlpha(computedColor, 0.2);
    }
}

menuBar.addEventListener("click", () => toggle(navlist));
addGoalBtn.addEventListener('click', () => {
    // Reset for new goal creation
    currentEditingGoalId = null;
    submitGoalBtn.textContent = 'Save Goal';
    document.getElementById('title').value = '';
    document.getElementById('description').value = '';
    document.getElementById('deadline').value = '';
    openModal();
});

if(closeModalBtn){
    closeModalBtn.addEventListener("click", closeModal);
}
if(submitGoalBtn){
    submitGoalBtn.addEventListener('click', addGoal);
}