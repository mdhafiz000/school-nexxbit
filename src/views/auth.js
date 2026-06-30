import { state, updateState, setToken, syncSession } from '../state/store.js';
import { supabase } from '../config/supabase.js';
import { generateFriendCode } from '../state/store.js';

export function initAuth(onLoginSuccess) {
  const loginOverlay = document.getElementById('auth-overlay');
  const loginForm = document.getElementById('login-form');
  const loginFormArea = document.getElementById('login-form-area');
  const registerFormContainer = document.getElementById('register-form-container');
  const registerForm = document.getElementById('register-form');
  
  // New tab buttons
  const tabSigninBtn = document.getElementById('auth-tab-signin-btn');
  const tabSignupBtn = document.getElementById('auth-tab-signup-btn');
  
  // Student demo button
  const demoStudentBtn = document.getElementById('demo-student-login-btn');

  // Role dropdown select
  const registerRoleSelect = document.getElementById('register-role');

  const logoutBtn = document.getElementById('auth-logout-btn');

  // Helper to draw saved profile avatars
  function renderQuickLogins() {
    const quickLoginsSection = document.getElementById('quick-logins-section');
    const container = document.getElementById('quick-logins-container');
    if (!quickLoginsSection || !container) return;

    const trustedKeys = state.trustedLogins || [];
    if (trustedKeys.length === 0) {
      quickLoginsSection.style.display = 'none';
      return;
    }

    quickLoginsSection.style.display = 'block';
    container.innerHTML = '';

    trustedKeys.slice(0, 4).forEach(username => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quick-login-avatar-btn';
      btn.innerHTML = `
        <div class="quick-login-avatar-circle">🧒</div>
        <div class="quick-login-avatar-name" style="text-transform: capitalize;">${username}</div>
      `;

      btn.addEventListener('click', () => {
        const loginUsrEl = document.getElementById('login-username');
        const loginPassEl = document.getElementById('login-password');
        if (loginUsrEl && loginPassEl) {
          loginUsrEl.value = username;
          loginPassEl.value = '';
          loginPassEl.focus();
        }
      });

      container.appendChild(btn);
    });
  }

  // 1. Initial Session Check (sync with Supabase)
  async function checkInitialSession() {
    if (!supabase) return;
    const activeUser = await syncSession();
    if (activeUser) {
      if (loginOverlay) loginOverlay.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'block';
      showRoleSection(activeUser.role);
      if (onLoginSuccess) onLoginSuccess(activeUser);
    } else {
      if (loginOverlay) loginOverlay.style.display = 'flex';
      if (logoutBtn) logoutBtn.style.display = 'none';
      renderQuickLogins();
    }
  }

  checkInitialSession();

  // 2. Tab Switching logic
  if (tabSigninBtn && tabSignupBtn) {
    tabSigninBtn.addEventListener('click', () => {
      tabSigninBtn.classList.add('active');
      tabSignupBtn.classList.remove('active');
      if (loginFormArea) loginFormArea.style.display = 'block';
      if (registerFormContainer) registerFormContainer.style.display = 'none';
    });

    tabSignupBtn.addEventListener('click', () => {
      tabSignupBtn.classList.add('active');
      tabSigninBtn.classList.remove('active');
      if (loginFormArea) loginFormArea.style.display = 'none';
      if (registerFormContainer) registerFormContainer.style.display = 'block';
    });
  }

  // 3. Dynamic Registration fields switcher
  if (registerRoleSelect) {
    registerRoleSelect.addEventListener('change', () => {
      const val = registerRoleSelect.value;
      const studentFields = document.getElementById('register-student-only-fields');
      const teacherFields = document.getElementById('register-teacher-only-fields');
      const parentFields = document.getElementById('register-parent-only-fields');

      if (studentFields) studentFields.style.display = (val === 'student') ? 'contents' : 'none';
      if (teacherFields) teacherFields.style.display = (val === 'teacher') ? 'contents' : 'none';
      if (parentFields) parentFields.style.display = (val === 'parent') ? 'contents' : 'none';
    });
  }

  // 4. Demo student auto login
  if (demoStudentBtn) {
    demoStudentBtn.addEventListener('click', async () => {
      try {
        const demoUsername = 'eilhan';
        const demoEmail = 'eilhan@student.nexxbit.io';
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: 'abcd1234'
        });

        if (error) throw error;
        
        const activeUser = await syncSession();
        
        if (activeUser) {
          // Save to local trusted profiles
          updateState(draft => {
            if (!draft.trustedLogins) draft.trustedLogins = [];
            const list = draft.trustedLogins.filter(u => u !== demoUsername);
            list.unshift(demoUsername);
            draft.trustedLogins = list.slice(0, 4);
            localStorage.setItem('nexxbit_trusted_logins', JSON.stringify(draft.trustedLogins));
          });

          if (loginOverlay) loginOverlay.style.display = 'none';
          if (logoutBtn) logoutBtn.style.display = 'block';
          showRoleSection(activeUser.role);
          if (onLoginSuccess) onLoginSuccess(activeUser);
        }
      } catch (err) {
        alert(err.message || 'Demo login failed');
      }
    });
  }

  // 5. Submit Sign In Form with Auto Role Lookup
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;

      // Students use username-only logins. Map to synthetic email.
      const email = username.includes('@') ? username : `${username.toLowerCase()}@student.nexxbit.io`;

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (error) throw error;
        
        const activeUser = await syncSession();

        if (activeUser) {
          // Save to local trusted profiles
          updateState(draft => {
            if (!draft.trustedLogins) draft.trustedLogins = [];
            const list = draft.trustedLogins.filter(u => u !== activeUser.username);
            list.unshift(activeUser.username);
            draft.trustedLogins = list.slice(0, 4);
            localStorage.setItem('nexxbit_trusted_logins', JSON.stringify(draft.trustedLogins));
          });

          if (loginOverlay) loginOverlay.style.display = 'none';
          if (logoutBtn) logoutBtn.style.display = 'block';
          showRoleSection(activeUser.role);
          if (onLoginSuccess) onLoginSuccess(activeUser);
        }
      } catch (err) {
        alert(err.message || 'Login failed. Please check your credentials.');
      }
    });
  }

  // 6. Submit Register Form
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('register-username').value.trim().toLowerCase();
      const fullname = document.getElementById('register-fullname').value.trim();
      const password = document.getElementById('register-password').value;
      const role = document.getElementById('register-role').value;

      if (password.length < 8) {
        alert('Password must be at least 8 characters long!');
        return;
      }

      // Collect role-specific details
      let roleData = {};
      let email = '';
      
      if (role === 'student') {
        email = `${username}@student.nexxbit.io`;
        roleData = {
          gender: document.getElementById('register-gender').value,
          parentEmail: document.getElementById('register-parent-email').value.trim()
        };
      } else if (role === 'teacher') {
        const teacherEmail = document.getElementById('register-teacher-email').value.trim();
        if (!teacherEmail) {
          alert('Email Address is compulsory for Teachers!');
          return;
        }
        email = teacherEmail;
        roleData = {
          email: teacherEmail
        };
      } else if (role === 'parent') {
        const parentOwnEmail = document.getElementById('register-parent-own-email').value.trim();
        if (!parentOwnEmail) {
          alert('Email Address is compulsory for Parents!');
          return;
        }
        email = parentOwnEmail;
        roleData = {
          email: parentOwnEmail,
          parentRole: document.getElementById('register-parent-role').value
        };
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              name: fullname,
              role,
              avatar: '⭐',
              gender: roleData.gender || 'Male',
              parent_email: roleData.parentEmail || null,
              school: '',
              parent_role: roleData.parentRole || null,
              friend_code: generateFriendCode()
            }
          }
        });

        if (error) throw error;

        alert('Registration successful! Please sign in using your credentials.');
        
        // Auto toggle back to sign-in and pre-fill username
        if (tabSigninBtn) tabSigninBtn.click();
        const loginUsrEl = document.getElementById('login-username');
        if (loginUsrEl) {
          loginUsrEl.value = username;
          const loginPassEl = document.getElementById('login-password');
          if (loginPassEl) {
            loginPassEl.value = '';
            loginPassEl.focus();
          }
        }
      } catch (err) {
        alert(err.message || 'Registration failed');
      }
    });
  }

  // 7. Forgot Password handler
  const forgotPwLink = document.getElementById('auth-forgot-password-link');
  if (forgotPwLink) {
    forgotPwLink.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = prompt("Enter your registered email address to recover your password:");
      if (!email || !email.trim()) return;

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) throw error;
        alert(`Success! A password recovery link has been sent to: ${email.trim()}.\nPlease check your inbox.`);
      } catch (err) {
        alert(err.message || "Failed to trigger password recovery.");
      }
    });
  }
}

export function showRoleSection(role) {
  document.querySelectorAll('.role-section').forEach(sec => sec.classList.remove('active'));
  const targetSec = document.getElementById(`${role}-section`);
  if (targetSec) targetSec.classList.add('active');
}
