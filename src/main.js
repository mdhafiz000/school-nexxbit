import { state, updateState, syncSession, setToken } from './state/store.js';
import { supabase } from './config/supabase.js';
import { initAuth, showRoleSection } from './views/auth.js';
import { initSidebar } from './views/sidebar.js';
import { initSettings, fillSettingsFields } from './views/settings.js';
import { initPlayground, setupSubjectAndTopics, updatePlaygroundPreview } from './views/playground.js';
import { renderStudentDashboard, renderStudentAssignments, renderTeacherDashboard, renderSocialCircle, renderProgressChart } from './views/dashboard.js';
import { renderTeacherChecker } from './views/checker.js';
import { initParent, renderParentDashboard, renderConnectedKids } from './views/parent.js';
import { initTeacher } from './views/teacher.js';
import { initAdmin } from './views/admin.js';

// Global Custom Alert modal override
window.alert = function(message) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.background = 'rgba(15, 23, 42, 0.8)';
  overlay.style.backdropFilter = 'blur(5px)';
  overlay.style.zIndex = '9999999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '1rem';
  
  const card = document.createElement('div');
  card.style.background = 'var(--bg-secondary)';
  card.style.border = '1px solid var(--border-color)';
  card.style.borderRadius = 'var(--border-radius-md)';
  card.style.padding = '2rem';
  card.style.maxWidth = '400px';
  card.style.width = '100%';
  card.style.textAlign = 'center';
  card.style.boxShadow = 'var(--shadow-lg)';
  card.style.fontFamily = "'Outfit', sans-serif";
  
  card.innerHTML = `
    <div style="font-size:3rem; margin-bottom:1rem;">ℹ️</div>
    <h3 style="font-size:1.2rem; font-weight:700; color:var(--text-primary); margin-bottom:1.5rem; line-height:1.4;">${message}</h3>
    <button class="btn btn-primary close-btn" style="padding:0.6rem 2rem; font-weight:700; border-radius:var(--border-radius-sm); margin: 0 auto; display: block;">OK</button>
  `;
  
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  
  card.querySelector('.close-btn').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
};

// Global Custom Confirm dialog to replace native alerts
window.showConfirmDialog = function(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.background = 'rgba(15, 23, 42, 0.8)';
  overlay.style.backdropFilter = 'blur(5px)';
  overlay.style.zIndex = '999999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '1rem';
  
  const card = document.createElement('div');
  card.style.background = 'var(--bg-secondary)';
  card.style.border = '1px solid var(--border-color)';
  card.style.borderRadius = 'var(--border-radius-md)';
  card.style.padding = '2rem';
  card.style.maxWidth = '400px';
  card.style.width = '100%';
  card.style.textAlign = 'center';
  card.style.boxShadow = 'var(--shadow-lg)';
  card.style.fontFamily = "'Outfit', sans-serif";
  
  card.innerHTML = `
    <div style="font-size:3rem; margin-bottom:1rem;">🚪</div>
    <h3 style="font-size:1.25rem; font-weight:700; color:var(--text-primary); margin-bottom:1.5rem; line-height:1.4;">${message}</h3>
    <div style="display:flex; gap:1rem; justify-content:center;">
      <button class="btn btn-secondary cancel-btn" style="padding:0.6rem 1.5rem; font-weight:700; border-radius:var(--border-radius-sm);">Cancel</button>
      <button class="btn btn-danger confirm-btn" style="padding:0.6rem 1.5rem; font-weight:700; background:var(--danger); border-radius:var(--border-radius-sm);">Yes, Proceed</button>
    </div>
  `;
  
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  
  card.querySelector('.cancel-btn').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
  
  card.querySelector('.confirm-btn').addEventListener('click', () => {
    document.body.removeChild(overlay);
    onConfirm();
  });
};

window.safeConfirm = function(message, onConfirm) {
  if (window.showConfirmDialog) {
    window.showConfirmDialog(message, onConfirm);
  } else {
    if (confirm(message)) {
      onConfirm();
    }
  }
};

window.onerror = function(message, source, lineno, colno, error) {
  let errDiv = document.getElementById('debug-error-box');
  if (!errDiv) {
    errDiv = document.createElement('div');
    errDiv.id = 'debug-error-box';
    errDiv.style.position = 'fixed';
    errDiv.style.bottom = '10px';
    errDiv.style.right = '10px';
    errDiv.style.background = 'rgba(220, 38, 38, 0.95)';
    errDiv.style.color = '#fff';
    errDiv.style.padding = '10px';
    errDiv.style.borderRadius = '5px';
    errDiv.style.zIndex = '999999';
    errDiv.style.fontSize = '12px';
    errDiv.style.fontFamily = 'monospace';
    errDiv.style.maxWidth = '400px';
    document.body.appendChild(errDiv);
  }
  errDiv.innerHTML += `<div>Error: ${message} at ${source}:${lineno}:${colno}</div>`;
};

export function updateSidebarNames(activeUser) {
  if (!activeUser) return;
  const profile = state.users[activeUser.username];
  if (!profile) return;
  
  const studentNameEl = document.getElementById('student-name');
  const teacherNameEl = document.getElementById('teacher-name');
  const parentNameEl = document.getElementById('parent-name');
  
  if (activeUser.role === 'student' && studentNameEl) {
    studentNameEl.textContent = profile.name;
    const fcodeEl = document.getElementById('student-my-friend-code');
    if (fcodeEl) {
      fcodeEl.textContent = profile.friendCode || 'NONE';
    }
    const card = studentNameEl.closest('.user-summary-card');
    if (card) {
      const avatarEl = card.querySelector('.avatar-placeholder');
      if (avatarEl) avatarEl.textContent = profile.avatar || '🧒';
    }
  } else if (activeUser.role === 'teacher' && teacherNameEl) {
    teacherNameEl.textContent = profile.name;
    const card = teacherNameEl.closest('.user-summary-card');
    if (card) {
      const avatarEl = card.querySelector('.avatar-placeholder');
      if (avatarEl) avatarEl.textContent = profile.avatar || '👩‍🏫';
    }
  } else if (activeUser.role === 'parent' && parentNameEl) {
    parentNameEl.textContent = profile.name;
    const card = parentNameEl.closest('.user-summary-card');
    if (card) {
      const avatarEl = card.querySelector('.avatar-placeholder');
      if (avatarEl) avatarEl.textContent = profile.avatar || '👨';
    }
  } else if (activeUser.role === 'admin') {
    const adminNameEl = document.getElementById('admin-name');
    if (adminNameEl) adminNameEl.textContent = profile.name;
    const card = document.getElementById('admin-avatar')?.closest('.user-summary-card');
    if (card) {
      const avatarEl = card.querySelector('.avatar-placeholder');
      if (avatarEl) avatarEl.textContent = profile.avatar || '⚙️';
    }
  }
}

window.updateSidebarNames = updateSidebarNames;

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Auth system
  initAuth((activeUser) => {
    // On Login Success: Trigger roles initial setups
    setupRoleNavigation(activeUser.role);
    updateSidebarNames(activeUser);
  });

  // Bind password toggle button click handlers
  document.body.addEventListener('click', (e) => {
    if (e.target.classList.contains('password-toggle-btn')) {
      const input = e.target.previousElementSibling;
      if (input && (input.type === 'password' || input.type === 'text')) {
        if (input.type === 'password') {
          input.type = 'text';
          e.target.textContent = '🙈';
        } else {
          input.type = 'password';
          e.target.textContent = '👁️';
        }
      }
    }
  });

  // Bind delegated logout trigger (immune to DOM timing issues)
  document.body.addEventListener('click', (e) => {
    if (e.target.id === 'auth-logout-btn') {
      e.preventDefault();
      window.safeConfirm('Are you sure you want to log out?', async () => {
        if (supabase) {
          await supabase.auth.signOut();
        }
        setToken(null);
        updateState(draft => {
          draft.currentUser = null;
        });
        window.location.reload();
      });
    }
  });

  // Bind Theme Toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);
      const icon = themeToggle.querySelector('.theme-icon');
      if (icon) icon.textContent = nextTheme === 'dark' ? '☀️' : '🌙';
      updateState(draft => {
        draft.theme = nextTheme;
      });

      // Redraw chart to update grid colors
      if (state.currentUser && state.currentUser.role === 'student') {
        renderProgressChart();
      }
    });

    document.documentElement.setAttribute('data-theme', state.theme);
    const icon = themeToggle.querySelector('.theme-icon');
    if (icon) icon.textContent = state.theme === 'dark' ? '☀️' : '🌙';
  }

  // 2. Initialize Settings forms & handlers
  initSettings();

  // 3. Initialize Playgrounds
  initPlayground('student');
  initPlayground('teacher');

  // 4. Bind Teacher Question Counts Radio Cards
  const countCards = document.querySelectorAll('.count-card');
  countCards.forEach(card => {
    card.addEventListener('click', () => {
      countCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      
      const count = parseInt(card.dataset.count) || 10;
      updateState(draft => {
        draft.teacherConfig.questionCount = count;
      });
    });
  });

  // 5. Join Classroom handler (API-driven)
  const joinBtn = document.getElementById('join-class-btn');
  if (joinBtn) {
    joinBtn.addEventListener('click', async () => {
      const codeInput = document.getElementById('join-class-code');
      const code = codeInput.value.trim().toUpperCase();
      if (!code) {
        alert('Please enter a classroom invite code!');
        return;
      }

      try {
        const { data: classroom, error: classError } = await supabase
          .from('classrooms')
          .select('id, name')
          .eq('code', code)
          .single();
        if (classError || !classroom) throw new Error('Classroom code not found!');

        const { error: joinError } = await supabase
          .from('classroom_students')
          .insert({
            classroom_id: classroom.id,
            student_id: state.currentUser.id
          });
        if (joinError) {
          if (joinError.code === '23505') throw new Error('You have already joined this classroom!');
          throw joinError;
        }

        alert(`Successfully joined classroom: ${classroom.name}! 🏫`);
        codeInput.value = '';
        await syncSession();
        renderStudentDashboard();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // 6. Social Circle Add Friend handler (API-driven)
  const addFriendBtn = document.getElementById('add-friend-btn');
  if (addFriendBtn) {
    addFriendBtn.addEventListener('click', async () => {
      const rawCode = document.getElementById('add-friend-code').value.trim().toUpperCase();
      if (!rawCode) {
        alert('Please enter a friend code!');
        return;
      }

      try {
        const { data: friend, error: friendErr } = await supabase
          .from('users')
          .select('id, username, name')
          .eq('friend_code', rawCode)
          .single();
        if (friendErr || !friend) throw new Error('Friend code not found!');
        if (friend.id === state.currentUser.id) throw new Error('You cannot add yourself!');

        const { data: profile } = await supabase
          .from('users')
          .select('friends')
          .eq('id', state.currentUser.id)
          .single();
        
        const friendsList = profile.friends || [];
        if (friendsList.includes(friend.username)) throw new Error('This user is already in your Circle!');

        friendsList.push(friend.username);
        const { error: updateErr } = await supabase
          .from('users')
          .update({ friends: friendsList })
          .eq('id', state.currentUser.id);
        if (updateErr) throw updateErr;

        alert(`Success! Added ${friend.name} to your Circle! 🎉`);
        document.getElementById('add-friend-code').value = '';
        await syncSession();
        renderSocialCircle();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // 7. Bind Teacher elements initially (will run if user is teacher)
  if (state.currentUser && state.currentUser.role === 'teacher') {
    initTeacher();
  }
});

function setupRoleNavigation(role) {
  // Sync profiles to state
  const user = state.currentUser;
  if (user) {
    const profile = state.users[user.username];
    if (profile) {
      if (role === 'student') {
        updateState(draft => {
          draft.student.name = profile.name;
          draft.student.xp = profile.xp || 0;
          draft.student.streak = profile.streak || 0;
        });
      }
    }
  }

  // Run initial dashboard draws
  if (role === 'student') {
    renderStudentDashboard();
    setupSubjectAndTopics('student');
    updatePlaygroundPreview();
    renderSocialCircle();
  } else if (role === 'teacher') {
    renderTeacherDashboard();
    setupSubjectAndTopics('teacher');
    initTeacher();
  } else if (role === 'parent') {
    initParent();
  } else if (role === 'admin') {
    initAdmin();
  }

  // Pre-fill profile fields immediately on login
  fillSettingsFields();

  // Bind Sidebar tab updates
  initSidebar(role, (activeTabId) => {
    if (activeTabId === 'student-dashboard') {
      renderStudentDashboard();
    } else if (activeTabId === 'student-assignments') {
      renderStudentAssignments();
    } else if (activeTabId === 'student-playground') {
      updatePlaygroundPreview();
    } else if (activeTabId === 'student-my-circle') {
      renderSocialCircle();
    } else if (activeTabId === 'teacher-classrooms') {
      renderTeacherDashboard();
    } else if (activeTabId === 'teacher-checker') {
      renderTeacherChecker();
    } else if (activeTabId === 'parent-dashboard') {
      renderParentDashboard();
    } else if (activeTabId === 'parent-settings') {
      renderConnectedKids();
    } else if (activeTabId === 'admin-dashboard') {
      initAdmin();
    } else if (activeTabId === 'student-account' || activeTabId === 'teacher-account' || activeTabId === 'parent-account') {
      fillSettingsFields();
    }
  });

  // Make sure header profile display reflects correctly
  const pName = document.getElementById('profile-name');
  if (pName) pName.textContent = state.currentUser.name;
}
