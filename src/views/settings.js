import { state, updateState, apiRequest, syncSession } from '../state/store.js';
import { renderTeacherSubjectsWidgets } from './teacher.js';

export function initSettings() {
  // Bind Student Quiz Config Form
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    const subjectCards = document.querySelectorAll('.subject-selector-widget .subject-card');
    const hiddenSelect = document.getElementById('student-subject-select');
    
    subjectCards.forEach(card => {
      card.addEventListener('click', () => {
        subjectCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        
        const val = card.dataset.subject;
        if (hiddenSelect) {
          hiddenSelect.value = val;
        }

        const mathGroup = document.getElementById('student-math-topics-group');
        const englishGroup = document.getElementById('student-english-topics-group');
        if (mathGroup) mathGroup.style.display = (val === 'math') ? 'block' : 'none';
        if (englishGroup) englishGroup.style.display = (val === 'english') ? 'block' : 'none';
      });
    });

    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const subject = document.getElementById('student-subject-select').value;
      const difficulty = settingsForm.querySelector('input[name="difficulty"]:checked').value;
      const count = parseInt(settingsForm.querySelector('input[name="q-count"]:checked').value) || 10;
      
      const operators = [];
      const englishTopics = [];

      if (subject === 'math') {
        settingsForm.querySelectorAll('input[name="operators"]:checked').forEach(box => {
          operators.push(box.value);
        });
        if (operators.length === 0) {
          alert('Please choose at least one math operator type!');
          return;
        }
      } else {
        settingsForm.querySelectorAll('input[name="english-topics"]:checked').forEach(box => {
          englishTopics.push(box.value);
        });
        if (englishTopics.length === 0) {
          alert('Please choose at least one English topic!');
          return;
        }
      }

      updateState(draft => {
        draft.student.subject = subject;
        draft.student.difficulty = difficulty;
        draft.student.questionCount = count;
        if (subject === 'math') {
          draft.student.operators = operators;
        } else {
          draft.student.englishTopics = englishTopics;
        }
      });
      alert('Quiz settings saved! Let\'s go play! 🎯');
    });
  }

  // Bind Student Profile Form
  const studentForm = document.getElementById('student-profile-form');
  if (studentForm) {
    studentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('student-profile-fullname').value.trim();
      const pass = document.getElementById('student-profile-password').value;
      const avatar = document.getElementById('student-profile-avatar').value;

      if (pass && pass.length < 8) {
        alert('Password must be at least 8 characters long!');
        return;
      }

      try {
        await apiRequest('/api/settings/update', 'POST', {
          fullname: name,
          password: pass || undefined,
          avatar: avatar
        });
        await syncSession();
        if (window.updateSidebarNames) {
          window.updateSidebarNames(state.currentUser);
        }
        alert('Student account profile saved successfully! 💾');
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Bind Teacher Profile Form
  const teacherForm = document.getElementById('teacher-profile-form');
  if (teacherForm) {
    teacherForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('teacher-profile-fullname').value.trim();
      const pass = document.getElementById('teacher-profile-password').value;
      const avatar = document.getElementById('teacher-profile-avatar').value;

      if (pass && pass.length < 8) {
        alert('Password must be at least 8 characters long!');
        return;
      }

      try {
        await apiRequest('/api/settings/update', 'POST', {
          fullname: name,
          password: pass || undefined,
          avatar: avatar
        });
        await syncSession();
        if (window.updateSidebarNames) {
          window.updateSidebarNames(state.currentUser);
        }
        alert('Teacher account profile saved successfully! 💾');
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Bind Parent Profile Form
  const parentForm = document.getElementById('parent-profile-form');
  if (parentForm) {
    parentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('parent-profile-fullname').value.trim();
      const pass = document.getElementById('parent-profile-password').value;
      const avatar = document.getElementById('parent-profile-avatar').value;

      if (pass && pass.length < 8) {
        alert('Password must be at least 8 characters long!');
        return;
      }

      try {
        await apiRequest('/api/settings/update', 'POST', {
          fullname: name,
          password: pass || undefined,
          avatar: avatar
        });
        await syncSession();
        if (window.updateSidebarNames) {
          window.updateSidebarNames(state.currentUser);
        }
        alert('Parent account profile saved successfully! 💾');
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Bind Teacher Presentation Quiz Settings Form
  const teacherSettingsForm = document.getElementById('teacher-settings-form');
  if (teacherSettingsForm) {
    const teacherSubjectCards = document.querySelectorAll('.teacher-quiz-subject-selector .subject-card');
    const teacherHiddenSelect = document.getElementById('teacher-student-subject-select');
    
    if (teacherSubjectCards.length > 0 && teacherHiddenSelect) {
      teacherSubjectCards.forEach(card => {
        card.addEventListener('click', () => {
          teacherSubjectCards.forEach(c => c.classList.remove('active'));
          card.classList.add('active');

          const val = card.dataset.subject;
          teacherHiddenSelect.value = val;

          const mathGroup = document.getElementById('teacher-student-math-topics-group');
          const englishGroup = document.getElementById('teacher-student-english-topics-group');
          if (mathGroup) mathGroup.style.display = (val === 'math') ? 'block' : 'none';
          if (englishGroup) englishGroup.style.display = (val === 'english') ? 'block' : 'none';
        });
      });
    }

    teacherSettingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const subject = document.getElementById('teacher-student-subject-select').value;
      const difficulty = teacherSettingsForm.querySelector('input[name="teacher-difficulty"]:checked').value;
      const count = parseInt(teacherSettingsForm.querySelector('input[name="teacher-q-count"]:checked').value) || 10;
      
      const operators = [];
      const englishTopics = [];

      if (subject === 'math') {
        teacherSettingsForm.querySelectorAll('input[name="teacher-operators"]:checked').forEach(box => {
          operators.push(box.value);
        });
        if (operators.length === 0) {
          alert('Please choose at least one math operator type!');
          return;
        }
      } else {
        teacherSettingsForm.querySelectorAll('input[name="teacher-english-topics"]:checked').forEach(box => {
          englishTopics.push(box.value);
        });
        if (englishTopics.length === 0) {
          alert('Please choose at least one English topic!');
          return;
        }
      }

      updateState(draft => {
        draft.teacherConfig.subject = subject;
        draft.teacherConfig.difficulty = difficulty;
        draft.teacherConfig.questionCount = count;
        if (subject === 'math') {
          draft.teacherConfig.operators = operators;
        } else {
          draft.teacherConfig.englishTopics = englishTopics;
        }
      });

      alert("Quiz settings saved! Let's go play! 🎯");
    });
  }
}

export function fillSettingsFields() {
  const user = state.currentUser;
  if (!user) return;
  const profile = state.users[user.username];
  if (!profile) return;

  if (user.role === 'student') {
    const fnInput = document.getElementById('student-profile-fullname');
    if (fnInput) fnInput.value = profile.name;
    const peInput = document.getElementById('student-profile-parentemail');
    if (peInput) peInput.value = profile.parentEmail || '';
    const passInput = document.getElementById('student-profile-password');
    if (passInput) passInput.value = '';

    const avatarInput = document.getElementById('student-profile-avatar');
    if (avatarInput) {
      avatarInput.value = profile.avatar || (profile.gender === 'female' ? '👧' : '👦');
    }

    const parentContainer = document.getElementById('student-connected-parents-list');
    if (parentContainer) {
      parentContainer.innerHTML = '';
      const kidUsername = user.username.toLowerCase();
      const connectedParents = Object.values(state.users).filter(u => u.role === 'parent' && u.linkedKids && u.linkedKids.includes(kidUsername));
      
      if (connectedParents.length === 0) {
        parentContainer.innerHTML = '<span style="font-size:0.8rem; color:var(--text-muted); font-style:italic;">No parent accounts connected yet. Link this child from the Parent account dashboard!</span>';
      } else {
        connectedParents.forEach(p => {
          const div = document.createElement('div');
          div.style.display = 'flex';
          div.style.alignItems = 'center';
          div.style.gap = '0.5rem';
          div.style.padding = '0.5rem 0.75rem';
          div.style.background = 'var(--bg-secondary)';
          div.style.borderRadius = 'var(--border-radius-sm)';
          div.style.border = '1px solid var(--border-color)';
          div.innerHTML = `
            <span>❤️ <strong>${p.name}</strong> (${p.username})</span>
          `;
          parentContainer.appendChild(div);
        });
      }
    }

    const schoolStr = profile.school || '';
    const parts = schoolStr.split(' ');
    const prefixInput = document.getElementById('student-profile-school-prefix');
    const schoolNameInput = document.getElementById('student-profile-school-name');
    if (parts.length > 1 && prefixInput && schoolNameInput) {
      prefixInput.value = parts[0];
      schoolNameInput.value = parts.slice(1).join(' ');
    } else if (schoolNameInput) {
      schoolNameInput.value = schoolStr;
    }

    // Prefill settings-form
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
      const subject = state.student.subject || 'math';
      const hiddenSelect = document.getElementById('student-subject-select');
      if (hiddenSelect) hiddenSelect.value = subject;

      const subjectCards = settingsForm.querySelectorAll('.subject-selector-widget .subject-card');
      subjectCards.forEach(card => {
        if (card.dataset.subject === subject) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      });

      const mathGroup = document.getElementById('student-math-topics-group');
      const englishGroup = document.getElementById('student-english-topics-group');
      if (mathGroup) mathGroup.style.display = (subject === 'math') ? 'block' : 'none';
      if (englishGroup) englishGroup.style.display = (subject === 'english') ? 'block' : 'none';

      const diffVal = state.student.difficulty || 'medium';
      const diffRadio = settingsForm.querySelector(`input[name="difficulty"][value="${diffVal}"]`);
      if (diffRadio) diffRadio.checked = true;

      const countVal = state.student.questionCount || 10;
      const countRadio = settingsForm.querySelector(`input[name="q-count"][value="${countVal}"]`);
      if (countRadio) countRadio.checked = true;

      const mathOps = state.student.operators || ['add', 'subtract', 'multiply'];
      settingsForm.querySelectorAll('input[name="operators"]').forEach(box => {
        box.checked = mathOps.includes(box.value);
      });

      const engTopics = state.student.englishTopics || ['spelling', 'vocabulary'];
      settingsForm.querySelectorAll('input[name="english-topics"]').forEach(box => {
        box.checked = engTopics.includes(box.value);
      });
    }
  } else if (user.role === 'teacher') {
    const fnInput = document.getElementById('teacher-profile-fullname');
    if (fnInput) fnInput.value = profile.name;
    const passInput = document.getElementById('teacher-profile-password');
    if (passInput) passInput.value = '';

    const avatarInput = document.getElementById('teacher-profile-avatar');
    if (avatarInput) {
      avatarInput.value = profile.avatar || '👩‍🏫';
    }

    const schoolStr = profile.school || '';
    const parts = schoolStr.split(' ');
    const prefixInput = document.getElementById('teacher-profile-school-prefix');
    const schoolNameInput = document.getElementById('teacher-profile-school-name');
    if (parts.length > 1 && prefixInput && schoolNameInput) {
      prefixInput.value = parts[0];
      schoolNameInput.value = parts.slice(1).join(' ');
    } else if (schoolNameInput) {
      schoolNameInput.value = schoolStr;
    }

    renderTeacherSubjectsWidgets();
  } else if (user.role === 'parent') {
    const fnInput = document.getElementById('parent-profile-fullname');
    if (fnInput) fnInput.value = profile.name;
    const passInput = document.getElementById('parent-profile-password');
    if (passInput) passInput.value = '';

    const avatarInput = document.getElementById('parent-profile-avatar');
    if (avatarInput) {
      avatarInput.value = profile.avatar || '👨';
    }
  }
}
