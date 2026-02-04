const pomodoro = document.getElementById("pomodoro-timer")
const short = document.getElementById("short-timer")
const long = document.getElementById("long-timer")
const timers = document.getElementById("timer-display")
const session = document.getElementById("pomodoro-session")
const shortBreak = document.getElementById("short-break")
const longBreak = document.getElementById("long-break")
const startBtn = document.getElementById("start")
const restartBtn = document.getElementById("restart")
const stopBtn = document.getElementById("stop")
const btn = document.querySelector(".button")
const menuBar = document.querySelector(".menu-bar")
const navBar = document.querySelector(".nav-bar");
const btnGroup = document.querySelector(".btn-group");

let currenttimer = null
let myInterval = null

function showDefaultTimer(){
    pomodoro.style.display = "block"
    short.style.display = "none"
    long.style.display = "none"
}

showDefaultTimer()

function hideAll(){

}

function showNavBar(){
    navBar.classList.toggle("bar-active");
    btnGroup.classList.toggle("bar-active");
}
