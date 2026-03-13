import { _supabase } from "./supabase_init.js";

const email = document.getElementById("email");
const fname = document.getElementById('first-name');
const lname = document.getElementById('last-name');
const pass = document.getElementById('password');
const cpass = document.getElementById('confirm-password');

if(pass){
    pass.addEventListener("input", () => {
    document.getElementById("pass-strength").textContent = checkPasswordStrength(pass);
})
}

async function signUp(){
    if(cpass != pass){
        alert("Passwords don't match! Try Again!");
    } else {
        const { data, error } = await _supabase.auth.signUp(
            {
                email: email.value,
                password: pass.value,
                options: {
                    data: {
                        first_name: fname.value,
                        last_name: lname.value
                    }
                }
            }
        );

        if (error) {
            fname.value = "";
            lname.value = "";
            email.value = "";
            pass.value = "";
            cpass.value = "";
        } else {
            window.location.href = 'dashboard.html';
        }
    }    
}

async function login() {
    const pass = document.getElementById('login-password');

    const { data, error } = await _supabase.auth.signInWithPassword(
        {
            email: email.value,
            password: pass.value
        }
    );
    
    if (error) {
        email.value = "";
        pass.value = "";
        alert("Error: " + error)
    } else {
        window.location.href = 'dashboard.html';
    }
}

async function signInWithGoogle() {
  const { data, error } = await _supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.href = 'dashboard.html'
    }
  });

  if (error) {
    console.error('Error logging in:', error.message);
  }
}

async function sendResetEmail() {
    const email = document.getElementById("reset-email").value;
    const { data, error } = await _supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.href = `updatePassword.html`,
    });
    if (error) {
        alert("Error: " + error.message);
    } else {
        alert("Check your inbox! A reset link has been sent.");
    }
}

async function updatePassword() {
  const newPassword = document.getElementById('new-password').value;

  const { data, error } = await _supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    alert("Error updating password: " + error.message);
  } else {
    alert("Password updated successfully! Redirecting to login...");
    window.location.href = 'index.html';
  }
}

function checkPasswordStrength(pass) {
    let strength = 0;
    const password = pass.value;

    const criteria = {
        length: (password.length >= 8),
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[!@#$%^&*()-_+={}[\]|;:'"\\<,>.?/]/.test(password)
    };

    for (const check in criteria) {
        if (criteria[check]) {
            strength += 1;
        }
    }

    if (strength === 5) {
        return "Strong 💪";
    } else if (strength >= 3) {
        return "Moderate 😐";
    } else if (password.length > 0) {
        return "Weak 😟";
    } else {
        return "";
    }
}


const loginBtn = document.getElementById('login');
const GoogleLogin = document.getElementById("google-login");
const signUpBtn = document.getElementById('sign-up');
const GoogleSignUp = document.getElementById("google-signup");
const showPassBtn = document.querySelector('.show-password');
const forgotPassBtn = document.getElementById('forgot-pass');

showPassBtn.addEventListener("click", () => {
    let passInput = showPassBtn.previousElementSibling

    if(passInput.type === "password"){
        passInput.type = "text";
    } else {
        passInput.type = "password";
    }
})

forgotPassBtn.addEventListener("click", () => {
    const fgDialog = document.getElementById("forgot-password-section");
    fgDialog.style.display = "flex";
    document.getElementById("close-btn").addEventListener("click", () => fgDialog.style.display = "none");
})

if (loginBtn) {
    loginBtn.addEventListener("click", login);
}

if(GoogleLogin){
    GoogleLogin.addEventListener("click", signInWithGoogle);
}

if (signUpBtn) {
    signUpBtn.addEventListener("click", signUp);
}