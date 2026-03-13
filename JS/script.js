import { _supabase } from "./supabase_init.js";

export function toggle(navlist){
    navlist.classList.toggle("visible");
}

const colors = ['--secondary-color', '--pink-accent', '--success-color'];
const priorities = ['high', 'medium', 'low'];
export const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Nov", "Dec"];

export function generateRandomColor(line, priority){
    let i = priorities.indexOf(priority.toLowerCase());
    if(i != -1){
        line.style.background = `var(${colors[i]})`;

        const computedColor = getComputedStyle(line).backgroundColor;

        const taskDiv = line.closest('.task');
        if (taskDiv) {
            const priorityEl = taskDiv.querySelector('.priority-text');
            const checkbox = taskDiv.querySelector('.checked');
            if (priorityEl) {
                priorityEl.style.background = toRgbaWithAlpha(computedColor, 0.2);
                priorityEl.style.color = computedColor;
            }
            if (checkbox) {            
                checkbox.style.border = `2px solid ${computedColor}`;
                checkbox.style.color = 'white';
                checkbox.style.background = computedColor;
            }
        }
    }
}

export function toRgbaWithAlpha(rgb, alpha) {
    const match = rgb.match(/rgba?\(([^)]+)\)/);
    if (!match) return rgb;
    let parts = match[1].split(',').map(s => s.trim());
    if (parts.length === 3) parts.push(alpha);
    else if (parts.length === 4) parts[3] = alpha;
    return `rgba(${parts.join(',')})`;
}

export function clearModalInputValues() {
  const modal = document.querySelector('div#eventModal');
  if (modal) {
    const inputFields = modal.querySelectorAll('input, textarea, select');
    inputFields.forEach(field => {
      switch (field.tagName.toLowerCase()) {
        case 'input':
          switch (field.type) {
            case 'checkbox':
            case 'radio':
              field.checked = false;
              break;
            case 'file':
              field.value = '';
              break;
            default:
              field.value = '';
              break;
          }
          break;
        case 'textarea':
          field.value = '';
          break;
        case 'select':
          field.selectedIndex = 0
          break;
        default:
          break;
      }
    });
  }
}

export function openModal(){
    document.querySelector('.modal').style.display = 'flex';
}

export function closeModal() {
    document.querySelector('.modal').style.display = 'none';
    clearModalInputValues();
}

function setupLogout() {
  document.getElementById('log-out').addEventListener('click', async () => {
    await _supabase.auth.signOut();
    window.location.href = 'index.html';
  });
}

export function setLoadingState(loading) {
  const main = document.querySelector('.main');
  main.style.opacity = loading ? '0.5' : '1';
  main.style.pointerEvents = loading ? 'none' : 'auto';
  main.style.transition = 'opacity 0.3s ease';
}

export function calculateCurrentStreak(sortedDates) {
  if (sortedDates.length === 0) return 0;

  let streak = 1;
  const today = new Date();
  const lastStudyDate = new Date(sortedDates[0]);

  const daysDiff = Math.floor((today - lastStudyDate) / (1000 * 60 * 60 * 24));
  if (daysDiff > 1) return 0;

  for (let i = 0; i < sortedDates.length - 1; i++) {
    const current = new Date(sortedDates[i]);
    const next = new Date(sortedDates[i + 1]);
    const diff = Math.floor((current - next) / (1000 * 60 * 60 * 24));

    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export async function updateStreakDisplay(currentUser) {
  const streakElement = document.getElementById('streak-days');
  if (!streakElement) return;

  const { data, error } = await _supabase
    .from('sessions')
    .select('study_date')
    .eq('user_id', currentUser.id)
    .order('study_date', { ascending: false });

  if (error) return;

  const uniqueDates = [...new Set(data.map(s => s.study_date).filter(d => d))].sort().reverse();
  const currentStreak = calculateCurrentStreak(uniqueDates);
  
  streakElement.textContent = currentStreak;
}

function getDuration(time){
    const timeArr = time.split(':');
    
    const hours = timeArr[0] * 3600 * 1000;
    const mins = timeArr[1] * 60000;
    const secs = timeArr[2] * 1000;

    return (hours + mins + secs) / 60000;
}

export function getDurationInMinutes(startTime, endTime){
    return Number(Math.ceil(getDuration(endTime) - getDuration(startTime)).toFixed(0));
}
const form = document.querySelector('form');

document.getElementById('log-out').addEventListener('click', setupLogout);
if(form){
    form.addEventListener('submit', e => e.preventDefault());
}

