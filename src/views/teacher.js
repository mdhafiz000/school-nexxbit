import { state, updateState, generateFriendCode, syncSession } from '../state/store.js';
import { supabase } from '../config/supabase.js';
import { generateQuestions } from '../generators/index.js';
import { renderTeacherDashboard } from './dashboard.js';

let tempAssignmentQuestions = [];
let tempLiveQuestions = [];

export function initTeacher() {
  // Bind Create Classroom Toggle Forms
  const addClassBtn = document.getElementById('add-classroom-btn');
  const cancelClassBtn = document.getElementById('cancel-create-class');
  const classFormContainer = document.getElementById('add-class-form-container');

  if (addClassBtn && classFormContainer && !addClassBtn.dataset.bound) {
    addClassBtn.dataset.bound = 'true';
    addClassBtn.addEventListener('click', () => {
      classFormContainer.style.display = classFormContainer.style.display === 'none' ? 'block' : 'none';
    });
  }

  if (cancelClassBtn && classFormContainer && !cancelClassBtn.dataset.bound) {
    cancelClassBtn.dataset.bound = 'true';
    cancelClassBtn.addEventListener('click', () => {
      classFormContainer.style.display = 'none';
    });
  }

  // Bind Create Classroom Form
  const classForm = document.getElementById('create-class-form');
  if (classForm && !classForm.dataset.bound) {
    classForm.dataset.bound = 'true';
    classForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const className = document.getElementById('new-class-name').value.trim();
      if (!className) return;

      try {
        const classId = 'class-' + Date.now();
        const inviteCode = 'C-' + generateFriendCode();

        const { error } = await supabase
          .from('classrooms')
          .insert({
            id: classId,
            name: className,
            code: inviteCode,
            teacher_id: state.currentUser.id
          });
        if (error) throw error;

        alert(`Classroom "${className}" created! Invite code: ${inviteCode} 🏫`);
        classForm.reset();
        if (classFormContainer) classFormContainer.style.display = 'none';

        // Refresh listings from database
        await syncSession();
        renderTeacherDashboard();
        populateClassroomsDropdown();
        populateLiveClassroomsDropdown();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Bind Assignment Creator Subject Selector Toggles
  const subjectSelect = document.getElementById('assign-subject');
  const subjectCards = document.querySelectorAll('.assign-subject-selector .subject-card');
  if (subjectSelect && subjectCards.length > 0) {
    subjectCards.forEach(card => {
      const newCard = card.cloneNode(true);
      card.parentNode.replaceChild(newCard, card);

      newCard.addEventListener('click', () => {
        const freshCards = document.querySelectorAll('.assign-subject-selector .subject-card');
        freshCards.forEach(c => c.classList.remove('active'));
        newCard.classList.add('active');

        const val = newCard.dataset.subject;
        subjectSelect.value = val;

        const mathGroup = document.getElementById('assign-math-topics-group');
        const englishGroup = document.getElementById('assign-english-topics-group');
        if (mathGroup) mathGroup.style.display = (val === 'math') ? 'block' : 'none';
        if (englishGroup) englishGroup.style.display = (val === 'english') ? 'block' : 'none';
      });
    });
  }

  // Populate dropdowns
  populateClassroomsDropdown();
  populateLiveClassroomsDropdown();

  // Bind Assignment Creation Form Submit
  const assignForm = document.getElementById('assignment-creation-form');
  if (assignForm && !assignForm.dataset.bound) {
    assignForm.dataset.bound = 'true';
    assignForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('assign-title').value.trim();
      const classId = document.getElementById('assign-class').value;
      const subject = document.getElementById('assign-subject').value;
      const qCount = parseInt(document.getElementById('assign-q-count').value) || 10;
      const difficulty = document.getElementById('assign-difficulty').value;
      const dueDate = document.getElementById('assign-due-date').value;

      const topics = [];
      const selector = subject === 'math' ? 'input[name="assign-operators"]:checked' : 'input[name="assign-english-topics"]:checked';
      assignForm.querySelectorAll(selector).forEach(box => {
        topics.push(box.value);
      });

      if (topics.length === 0) {
        alert('Please select at least one topic for the assignment!');
        return;
      }

      if (!classId) {
        alert('Please select a target classroom! Create one if you do not have one.');
        return;
      }

      // Generate Questions via Dispatcher
      tempAssignmentQuestions = generateQuestions(subject, difficulty, topics, qCount);
      if (tempAssignmentQuestions.length === 0) {
        alert('Failed to generate questions. Verify topics are valid!');
        return;
      }

      renderReviewQuestionsList();
      
      const reviewSection = document.getElementById('assignment-review-section');
      if (reviewSection) reviewSection.style.display = 'block';
    });
  }

  // Bind new assignment toggle card button
  const newAssignBtn = document.getElementById('new-assignment-btn');
  const creatorCard = document.getElementById('assignment-creator-card');
  if (newAssignBtn && creatorCard && !newAssignBtn.dataset.bound) {
    newAssignBtn.dataset.bound = 'true';
    newAssignBtn.addEventListener('click', () => {
      creatorCard.style.display = creatorCard.style.display === 'none' ? 'block' : 'none';
      const reviewSection = document.getElementById('assignment-review-section');
      if (reviewSection) reviewSection.style.display = 'none';
    });
  }

  // Bind Regenerate Selected Questions
  const regenBtn = document.getElementById('regenerate-selected-btn');
  if (regenBtn && !regenBtn.dataset.bound) {
    regenBtn.dataset.bound = 'true';
    regenBtn.addEventListener('click', () => {
      const subject = document.getElementById('assign-subject').value;
      const difficulty = document.getElementById('assign-difficulty').value;
      
      const topics = [];
      const selector = subject === 'math' ? 'input[name="assign-operators"]:checked' : 'input[name="assign-english-topics"]:checked';
      const form = document.getElementById('assignment-creation-form');
      form.querySelectorAll(selector).forEach(box => {
        topics.push(box.value);
      });

      const checkedBoxes = document.querySelectorAll('.review-q-check:checked');
      if (checkedBoxes.length === 0) {
        alert('Please check at least one question card to regenerate!');
        return;
      }

      checkedBoxes.forEach(box => {
        const index = parseInt(box.dataset.index);
        const singleGen = generateQuestions(subject, difficulty, topics, 1);
        if (singleGen.length > 0) {
          tempAssignmentQuestions[index] = singleGen[0];
        }
      });

      renderReviewQuestionsList();
    });
  }

  // Bind Approve and Publish
  const approveBtn = document.getElementById('approve-assignment-btn');
  if (approveBtn && !approveBtn.dataset.bound) {
    approveBtn.dataset.bound = 'true';
    approveBtn.addEventListener('click', () => {
      const title = document.getElementById('assign-title').value.trim();
      const classId = document.getElementById('assign-class').value;
      const subjectVal = document.getElementById('assign-subject').value;
      const dueDate = document.getElementById('assign-due-date').value;

      const classroomObj = state.classrooms.find(c => c.id === classId);
      const classroomName = classroomObj ? classroomObj.name : 'General Class';
      const totalStudents = classroomObj ? classroomObj.studentsCount : 0;

      updateState(draft => {
        draft.assignments.push({
          id: 'assign-' + Date.now(),
          title,
          classroom: classroomName,
          subject: subjectVal === 'math' ? 'Mathematics' : 'English Language',
          dueDate,
          submissions: `0/${totalStudents}`,
          averageScore: 'N/A',
          questions: tempAssignmentQuestions
        });
      });

      alert(`Assignment "${title}" published to ${classroomName}! 🚀`);
      tempAssignmentQuestions = [];

      // Close Form & Review sections
      const creatorCard = document.getElementById('assignment-creator-card');
      const reviewSection = document.getElementById('assignment-review-section');
      if (creatorCard) creatorCard.style.display = 'none';
      if (reviewSection) reviewSection.style.display = 'none';
      
      const form = document.getElementById('assignment-creation-form');
      if (form) form.reset();

      renderTeacherAssignments();
    });
  }

  // Bind Cancel Assignment Creator
  const cancelBtn = document.getElementById('cancel-assignment-btn');
  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.dataset.bound = 'true';
    cancelBtn.addEventListener('click', () => {
      const creatorCard = document.getElementById('assignment-creator-card');
      const reviewSection = document.getElementById('assignment-review-section');
      if (creatorCard) creatorCard.style.display = 'none';
      if (reviewSection) reviewSection.style.display = 'none';
      tempAssignmentQuestions = [];
    });
  }

  // Bind Add Classroom Subject Trigger
  const addSubjectBtn = document.getElementById('teacher-add-subject-btn');
  if (addSubjectBtn && !addSubjectBtn.dataset.bound) {
    addSubjectBtn.dataset.bound = 'true';
    addSubjectBtn.addEventListener('click', () => {
      const select = document.getElementById('teacher-add-subject-select');
      const subjectVal = select.value;

      const user = state.currentUser;
      const profile = state.users[user.username];
      if (!profile) return;

      if (!profile.subjects) profile.subjects = [];

      if (profile.subjects.includes(subjectVal)) {
        alert('This subject is already active in your classroom!');
        return;
      }

      updateState(draft => {
        const u = draft.users[user.username];
        if (!u.subjects) u.subjects = [];
        u.subjects.push(subjectVal);
      });

      alert(`Successfully added ${subjectVal === 'math' ? 'Mathematics' : 'English Language'} focus! 📚`);
      renderTeacherSubjectsWidgets();
    });
  }

  // ==========================================
  // LIVE TEST HUB EVENT LISTENERS
  // ==========================================
  
  // Bind Live Test Form subject cards
  const liveSubjectSelect = document.getElementById('live-subject');
  const liveSubjectCards = document.querySelectorAll('.live-subject-selector .subject-card');
  if (liveSubjectSelect && liveSubjectCards.length > 0) {
    liveSubjectCards.forEach(card => {
      const newCard = card.cloneNode(true);
      card.parentNode.replaceChild(newCard, card);

      newCard.addEventListener('click', () => {
        const freshCards = document.querySelectorAll('.live-subject-selector .subject-card');
        freshCards.forEach(c => c.classList.remove('active'));
        newCard.classList.add('active');

        const val = newCard.dataset.subject;
        liveSubjectSelect.value = val;

        const mathGroup = document.getElementById('live-math-topics-group');
        const englishGroup = document.getElementById('live-english-topics-group');
        if (mathGroup) mathGroup.style.display = (val === 'math') ? 'block' : 'none';
        if (englishGroup) englishGroup.style.display = (val === 'english') ? 'block' : 'none';
      });
    });
  }

  // Bind new Live Test container toggler
  const newLiveBtn = document.getElementById('new-live-test-btn');
  const liveCreatorCard = document.getElementById('live-test-creator-card');
  if (newLiveBtn && liveCreatorCard && !newLiveBtn.dataset.bound) {
    newLiveBtn.dataset.bound = 'true';
    newLiveBtn.addEventListener('click', () => {
      liveCreatorCard.style.display = liveCreatorCard.style.display === 'none' ? 'block' : 'none';
      const reviewSection = document.getElementById('live-test-review-section');
      if (reviewSection) reviewSection.style.display = 'none';
    });
  }

  // Bind Live Test creation form submit
  const liveCreationForm = document.getElementById('live-test-creation-form');
  if (liveCreationForm && !liveCreationForm.dataset.bound) {
    liveCreationForm.dataset.bound = 'true';
    liveCreationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('live-title').value.trim();
      const classId = document.getElementById('live-class-select').value;
      const subject = document.getElementById('live-subject').value;
      const qCount = parseInt(document.getElementById('live-q-count').value) || 5;
      const difficulty = document.getElementById('live-difficulty').value;

      const topics = [];
      const selector = subject === 'math' ? 'input[name="live-operators"]:checked' : 'input[name="live-english-topics"]:checked';
      liveCreationForm.querySelectorAll(selector).forEach(box => {
        topics.push(box.value);
      });

      if (topics.length === 0) {
        alert('Please choose at least one topic for the live test!');
        return;
      }

      if (!classId) {
        alert('Please select a target classroom! Create one if you do not have one.');
        return;
      }

      tempLiveQuestions = generateQuestions(subject, difficulty, topics, qCount);
      if (tempLiveQuestions.length === 0) {
        alert('Failed to generate questions!');
        return;
      }

      renderLiveQuestionsList();

      const reviewSection = document.getElementById('live-test-review-section');
      if (reviewSection) reviewSection.style.display = 'block';
    });
  }

  // Bind live-regenerate-selected-btn
  const liveRegenBtn = document.getElementById('live-regenerate-selected-btn');
  if (liveRegenBtn && !liveRegenBtn.dataset.bound) {
    liveRegenBtn.dataset.bound = 'true';
    liveRegenBtn.addEventListener('click', () => {
      const subject = document.getElementById('live-subject').value;
      const difficulty = document.getElementById('live-difficulty').value;
      
      const topics = [];
      const selector = subject === 'math' ? 'input[name="live-operators"]:checked' : 'input[name="live-english-topics"]:checked';
      const form = document.getElementById('live-test-creation-form');
      form.querySelectorAll(selector).forEach(box => {
        topics.push(box.value);
      });

      const checkedBoxes = document.querySelectorAll('.live-review-q-check:checked');
      if (checkedBoxes.length === 0) {
        alert('Please check at least one question card to regenerate!');
        return;
      }

      checkedBoxes.forEach(box => {
        const index = parseInt(box.dataset.index);
        const singleGen = generateQuestions(subject, difficulty, topics, 1);
        if (singleGen.length > 0) {
          tempLiveQuestions[index] = singleGen[0];
        }
      });

      renderLiveQuestionsList();
    });
  }

  // Bind Cancel live creation
  const cancelLiveBtn = document.getElementById('cancel-live-creation-btn');
  if (cancelLiveBtn && !cancelLiveBtn.dataset.bound) {
    cancelLiveBtn.dataset.bound = 'true';
    cancelLiveBtn.addEventListener('click', () => {
      const creatorCard = document.getElementById('live-test-creator-card');
      const reviewSection = document.getElementById('live-test-review-section');
      if (creatorCard) creatorCard.style.display = 'none';
      if (reviewSection) reviewSection.style.display = 'none';
      tempLiveQuestions = [];
    });
  }

  // Bind Save Live Test Set button
  const saveLiveBtn = document.getElementById('save-live-test-btn');
  if (saveLiveBtn && !saveLiveBtn.dataset.bound) {
    saveLiveBtn.dataset.bound = 'true';
    saveLiveBtn.addEventListener('click', () => {
      const title = document.getElementById('live-title').value.trim();
      const classId = document.getElementById('live-class-select').value;
      const subjectVal = document.getElementById('live-subject').value;
      const difficulty = document.getElementById('live-difficulty').value;

      const classroomObj = state.classrooms.find(c => c.id === classId);
      const classroomName = classroomObj ? classroomObj.name : 'General Class';

      updateState(draft => {
        draft.savedLiveTests.unshift({
          id: 'live-test-' + Date.now(),
          title: title,
          classroom: classroomName,
          classId: classId,
          subject: subjectVal === 'math' ? 'Mathematics' : 'English Language',
          qCount: tempLiveQuestions.length,
          difficulty: difficulty,
          questions: tempLiveQuestions
        });
      });

      alert('Live Test set generated and saved successfully! 💾');
      tempLiveQuestions = [];

      const creatorCard = document.getElementById('live-test-creator-card');
      const reviewSection = document.getElementById('live-test-review-section');
      if (creatorCard) creatorCard.style.display = 'none';
      if (reviewSection) reviewSection.style.display = 'none';

      const form = document.getElementById('live-test-creation-form');
      if (form) form.reset();

      renderSavedLiveTests();
    });
  }

  // Load Initial Lists
  renderTeacherAssignments();
  renderTeacherSubjectsWidgets();
  renderSavedLiveTests();
  renderCompletedLiveTests();
  syncTeacherSubjectsVisibility();
}

export function populateClassroomsDropdown() {
  const select = document.getElementById('assign-class');
  if (!select) return;
  select.innerHTML = '';

  if (state.classrooms.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '-- Create a Classroom First --';
    select.appendChild(opt);
    return;
  }

  state.classrooms.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });
}

export function populateLiveClassroomsDropdown() {
  const select = document.getElementById('live-class-select');
  if (!select) return;
  select.innerHTML = '';

  if (state.classrooms.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '-- Create a Classroom First --';
    select.appendChild(opt);
    return;
  }

  state.classrooms.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });
}

function renderReviewQuestionsList() {
  const grid = document.getElementById('assign-review-grid');
  if (!grid) return;
  grid.innerHTML = '';

  tempAssignmentQuestions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.style.background = 'var(--bg-secondary)';
    card.style.border = '1px solid var(--border-color)';
    card.style.borderRadius = 'var(--border-radius-sm)';
    card.style.padding = '1rem';
    card.style.position = 'relative';

    card.innerHTML = `
      <label style="position:absolute; top:10px; right:10px; cursor:pointer; display:flex; align-items:center; gap:0.25rem; font-size:0.75rem; color:var(--text-muted);">
        <input type="checkbox" class="review-q-check" data-index="${idx}"> Regenerate
      </label>
      <span style="font-size:0.75rem; color:var(--primary); font-weight:700;">Question #${idx + 1}</span>
      <div style="font-size:1.15rem; font-weight:700; margin:0.5rem 0; color:var(--text-primary);">${q.formula}</div>
      <div style="font-size:0.8rem; color:var(--success); font-weight:700;">Correct: ${q.correct}</div>
      <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">Choices: ${q.choices.join(', ')}</div>
    `;

    grid.appendChild(card);
  });
}

function renderLiveQuestionsList() {
  const grid = document.getElementById('live-review-grid');
  if (!grid) return;
  grid.innerHTML = '';

  tempLiveQuestions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.style.background = 'var(--bg-secondary)';
    card.style.border = '1px solid var(--border-color)';
    card.style.borderRadius = 'var(--border-radius-sm)';
    card.style.padding = '1rem';
    card.style.position = 'relative';

    card.innerHTML = `
      <label style="position:absolute; top:10px; right:10px; cursor:pointer; display:flex; align-items:center; gap:0.25rem; font-size:0.75rem; color:var(--text-muted);">
        <input type="checkbox" class="live-review-q-check" data-index="${idx}"> Regenerate
      </label>
      <span style="font-size:0.75rem; color:var(--primary); font-weight:700;">Question #${idx + 1}</span>
      <div style="font-size:1.15rem; font-weight:700; margin:0.5rem 0; color:var(--text-primary);">${q.formula}</div>
      <div style="font-size:0.8rem; color:var(--success); font-weight:700;">Correct: ${q.correct}</div>
      <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">Choices: ${q.choices.join(', ')}</div>
    `;

    grid.appendChild(card);
  });
}

export function renderTeacherAssignments() {
  const tbody = document.getElementById('teacher-assignments-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (state.assignments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem 0;">No active assignments. Click Create Assignment above to build one!</td></tr>';
    return;
  }

  state.assignments.forEach(assign => {
    // Dynamic calculate submissions based on actual student histories matching this assignmentId
    const submissions = [];
    Object.values(state.users).forEach(u => {
      if (u.role === 'student' && u.history) {
        const log = u.history.find(h => h.assignmentId === assign.id);
        if (log) submissions.push(log);
      }
    });

    const classroomObj = state.classrooms.find(c => c.name === assign.classroom);
    const totalClassroomStudents = classroomObj ? classroomObj.studentsCount : 0;
    const subProgressStr = `${submissions.length}/${totalClassroomStudents}`;

    let totalAccuracy = 0;
    submissions.forEach(s => totalAccuracy += s.accuracy);
    const avgScoreStr = submissions.length > 0 ? `${Math.round(totalAccuracy / submissions.length)}%` : 'N/A';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:700; color:var(--text-primary);">${assign.title}</td>
      <td>${assign.classroom}</td>
      <td>${assign.dueDate}</td>
      <td>${subProgressStr}</td>
      <td><span style="color:var(--warning); font-weight:800;">${avgScoreStr}</span></td>
      <td>
        <div style="display:flex; gap:0.5rem;">
          <button class="btn btn-secondary btn-small view-report-btn" style="padding:0.35rem 0.75rem;">Report 📊</button>
          <button class="btn btn-danger btn-small delete-assign-btn" style="padding:0.35rem 0.75rem;">Delete 🗑️</button>
        </div>
      </td>
    `;

    tr.querySelector('.view-report-btn').addEventListener('click', () => {
      showAssignmentReport(assign.id);
    });

    tr.querySelector('.delete-assign-btn').addEventListener('click', () => {
      const deleteAction = () => {
        updateState(draft => {
          draft.assignments = draft.assignments.filter(a => a.id !== assign.id);
        });
        renderTeacherAssignments();
      };

      window.safeConfirm('Are you sure you want to delete this assignment?', deleteAction);
    });

    tbody.appendChild(tr);
  });
}

function showAssignmentReport(assignId) {
  const assign = state.assignments.find(a => a.id === assignId);
  if (!assign) return;

  const submissions = [];
  Object.values(state.users).forEach(u => {
    if (u.role === 'student' && u.history) {
      const log = u.history.find(h => h.assignmentId === assignId);
      if (log) {
        submissions.push({
          name: u.name,
          score: log.score,
          accuracy: log.accuracy,
          date: log.date
        });
      }
    }
  });

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
  overlay.style.padding = '1.5rem';

  const card = document.createElement('div');
  card.style.background = 'var(--bg-secondary)';
  card.style.border = '1px solid var(--border-color)';
  card.style.borderRadius = 'var(--border-radius-md)';
  card.style.padding = '2.5rem';
  card.style.maxWidth = '800px';
  card.style.width = '100%';
  card.style.maxHeight = '90vh';
  card.style.overflowY = 'auto';
  card.style.boxShadow = 'var(--shadow-lg)';
  card.style.fontFamily = "'Outfit', sans-serif";
  card.style.textAlign = 'left';

  const questionsHtml = (assign.questions || []).map((q, idx) => `
    <div style="padding:1rem; background:var(--bg-primary); border:1px solid var(--border-color); border-radius:var(--border-radius-sm); margin-bottom:0.75rem;">
      <span style="font-size:0.75rem; color:var(--primary); font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">Question #${idx + 1}</span>
      <div style="font-size:1.15rem; font-weight:700; margin:0.35rem 0; color:var(--text-primary);">${q.formula}</div>
      <div style="font-size:0.9rem; color:var(--success); font-weight:700; margin-top:0.25rem;">Correct Answer: ${q.correct}</div>
      <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">Choices: ${q.choices.join(', ')}</div>
    </div>
  `).join('');

  const classroomObj = state.classrooms.find(c => c.name === assign.classroom);
  const totalClassroomStudents = classroomObj ? classroomObj.studentsCount : 0;

  const submissionsHtml = submissions.length === 0 
    ? '<div style="text-align:center; color:var(--text-muted); font-size:0.9rem; font-style:italic; padding:1.5rem; border:1px dashed var(--border-color); border-radius:var(--border-radius-sm); background:var(--bg-primary);">No students have submitted this assignment yet.</div>'
    : submissions.map(s => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem 1rem; background:var(--bg-primary); border:1px solid var(--border-color); border-radius:var(--border-radius-sm); margin-bottom:0.5rem; font-size:0.9rem;">
          <span style="font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">👦 ${s.name}</span>
          <span style="color:var(--warning); font-weight:800; font-size:0.95rem;">${s.accuracy}% (${s.score})</span>
        </div>
      `).join('');

  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; border-bottom:1px solid var(--border-color); padding-bottom:1rem;">
      <div>
        <h3 style="font-size:1.6rem; font-weight:800; color:var(--text-primary); margin-bottom:0.25rem;">📊 Assignment Analytics</h3>
        <p style="font-size:0.95rem; color:var(--text-muted);">Assignment: <strong style="color:var(--text-primary);">${assign.title}</strong> | Classroom: ${assign.classroom}</p>
      </div>
      <span class="user-badge" style="background:var(--primary-glow); color:var(--primary); font-size:0.85rem; padding:0.5rem 1rem; font-weight:700;">Active Code</span>
    </div>
    
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:2rem; margin-bottom:2rem;">
      <div>
        <h4 style="font-weight:700; margin-bottom:0.75rem; color:var(--text-primary); font-size:1.1rem; display:flex; align-items:center; gap:0.5rem;">📝 <span>Generated Questions</span></h4>
        <div style="max-height:350px; overflow-y:auto; padding-right:0.5rem;">
          ${questionsHtml}
        </div>
      </div>

      <div>
        <h4 style="font-weight:700; margin-bottom:0.75rem; color:var(--text-primary); font-size:1.1rem; display:flex; align-items:center; gap:0.5rem;">🎓 <span>Student Submissions (${submissions.length} out of ${totalClassroomStudents} students)</span></h4>
        <div style="max-height:350px; overflow-y:auto; padding-right:0.5rem;">
          ${submissionsHtml}
        </div>
      </div>
    </div>

    <div style="display:flex; justify-content:flex-end;">
      <button class="btn btn-secondary close-report-btn" style="padding:0.75rem 2rem; font-weight:700; width:150px;">Close Report</button>
    </div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  card.querySelector('.close-report-btn').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
}

export function renderTeacherSubjectsWidgets() {
  const container = document.getElementById('teacher-subjects-widgets-container');
  if (!container) return;
  container.innerHTML = '';

  const user = state.currentUser;
  if (!user) return;
  const profile = state.users[user.username];
  if (!profile) return;

  const subjects = profile.subjects || [];
  if (subjects.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 1.5rem; text-align: center; color: var(--text-muted); border: 2px dashed var(--border-color); border-radius: var(--border-radius-md);">
        📚 No active classroom focus subjects added. Use the selection widget above to add Mathematics or English Language focuses!
      </div>
    `;
    return;
  }

  subjects.forEach(subjectKey => {
    const card = document.createElement('div');
    card.className = 'subject-widget-card';
    card.style.background = 'var(--bg-primary)';
    card.style.padding = '1.25rem';
    card.style.borderRadius = 'var(--border-radius-md)';
    card.style.border = '1px solid var(--border-color)';
    card.style.textAlign = 'center';

    let icon = '📐';
    let title = 'Mathematics';
    let topics = 'Addition, Subtraction, Multiplication, Division';
    if (subjectKey === 'english') {
      icon = '📖';
      title = 'English Language';
      topics = 'Spelling, Vocabulary, Grammar';
    }

    card.innerHTML = `
      <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">${icon}</div>
      <h4 style="font-weight: 800; font-size: 1.15rem; margin-bottom: 0.25rem; color:var(--text-primary);">${title}</h4>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1.25rem;">${topics}</p>
      <button class="btn btn-danger btn-small remove-subj-btn" style="width: 100%; padding:0.4rem;">Remove Subject 🗑️</button>
    `;

    card.querySelector('.remove-subj-btn').addEventListener('click', () => {
      const removeAction = () => {
        updateState(draft => {
          const u = draft.users[user.username];
          u.subjects = u.subjects.filter(s => s !== subjectKey);
        });
        renderTeacherSubjectsWidgets();
      };

      window.safeConfirm(`Are you sure you want to remove the classroom subject: ${title}?`, removeAction);
    });

    container.appendChild(card);
  });

  syncTeacherSubjectsVisibility();
}

export function renderSavedLiveTests() {
  const tbody = document.getElementById('saved-live-tests-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const saved = state.savedLiveTests || [];
  if (saved.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:2rem 0;">No saved live test templates. Click "Create Live Test" above to build one!</td></tr>';
    return;
  }

  saved.forEach(test => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:700; color:var(--text-primary);">${test.title}</td>
      <td>${test.classroom}</td>
      <td>${test.qCount} Questions</td>
      <td><span class="user-badge" style="text-transform:capitalize;">${test.difficulty}</span></td>
      <td>
        <div style="display:flex; gap:0.5rem;">
          <button class="btn btn-primary btn-small launch-live-btn" style="padding:0.35rem 0.75rem;">Launch Lobby 🚀</button>
          <button class="btn btn-danger btn-small delete-live-btn" style="padding:0.35rem 0.75rem;">Delete 🗑️</button>
        </div>
      </td>
    `;

    // Bind Launch Lobby
    tr.querySelector('.launch-live-btn').addEventListener('click', () => {
      launchLiveTest(test.id);
    });

    // Bind Delete Test
    tr.querySelector('.delete-live-btn').addEventListener('click', () => {
      const deleteAction = () => {
        updateState(draft => {
          draft.savedLiveTests = draft.savedLiveTests.filter(t => t.id !== test.id);
        });
        renderSavedLiveTests();
      };

      window.safeConfirm('Are you sure you want to delete this live test template?', deleteAction);
    });

    tbody.appendChild(tr);
  });
}

export function renderCompletedLiveTests() {
  const tbody = document.getElementById('completed-live-tests-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const completed = state.completedLiveTests || [];
  if (completed.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem 0;">No live tests completed yet. Run a live lobby with your students!</td></tr>';
    return;
  }

  completed.forEach(test => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:700; color:var(--text-primary);">${test.title}</td>
      <td>${test.classroom}</td>
      <td>${test.date}</td>
      <td>${test.participants} Students</td>
      <td><strong style="color:var(--success);">${test.topStudent}</strong></td>
      <td>
        <button class="btn btn-secondary btn-small view-report-btn" style="padding:0.35rem 0.75rem;">Report 📊</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function launchLiveTest(testId) {
  const test = state.savedLiveTests.find(t => t.id === testId);
  if (!test) return;

  const liveActive = document.getElementById('live-active');
  const savedContainer = document.getElementById('saved-live-tests-container');
  const completedContainer = document.getElementById('completed-live-tests-container');
  
  if (savedContainer) savedContainer.style.display = 'none';
  if (completedContainer) completedContainer.style.display = 'none';
  
  if (liveActive) {
    liveActive.style.display = 'block';
    const activeTitle = document.getElementById('live-active-title');
    if (activeTitle) activeTitle.textContent = test.title;

    // Set index and totals
    const qIndexDisp = document.getElementById('live-q-index-disp');
    const qTotalDisp = document.getElementById('live-q-total-disp');
    if (qIndexDisp) qIndexDisp.textContent = '1';
    if (qTotalDisp) qTotalDisp.textContent = test.qCount;

    // Bind lobby control buttons
    const endLobbyBtn = document.getElementById('teacher-end-lobby-btn');
    if (endLobbyBtn) {
      const newEndLobbyBtn = endLobbyBtn.cloneNode(true);
      endLobbyBtn.parentNode.replaceChild(newEndLobbyBtn, endLobbyBtn);
      
      newEndLobbyBtn.addEventListener('click', () => {
        liveActive.style.display = 'none';
        if (savedContainer) savedContainer.style.display = 'block';
        if (completedContainer) completedContainer.style.display = 'block';
      });
    }
  }
}

export function syncTeacherSubjectsVisibility() {
  const user = state.currentUser;
  if (!user || user.role !== 'teacher') return;
  const profile = state.users[user.username];
  if (!profile) return;

  const activeSubjects = profile.subjects || [];

  // Quiz Settings Form
  const quizForm = document.getElementById('teacher-settings-form');
  // Assignment Creator form
  const assignForm = document.getElementById('assignment-creation-form');
  // Live Test creator form
  const liveForm = document.getElementById('live-test-creation-form');

  const forms = [quizForm, assignForm, liveForm];
  forms.forEach(form => {
    if (!form) return;
    
    // Check if warning element exists
    let warning = form.parentNode.querySelector('.teacher-no-subjects-warning');
    if (!warning) {
      warning = document.createElement('div');
      warning.className = 'teacher-no-subjects-warning';
      warning.style.padding = '2rem';
      warning.style.textAlign = 'center';
      warning.style.color = 'var(--text-muted)';
      warning.style.border = '2px dashed var(--border-color)';
      warning.style.borderRadius = 'var(--border-radius-md)';
      warning.style.background = 'var(--bg-secondary)';
      warning.style.marginBottom = '1.5rem';
      warning.innerHTML = `
        <div style="font-size:2.5rem; margin-bottom:0.5rem;">📚</div>
        <h4 style="font-weight:700; color:var(--text-primary); margin-bottom:0.25rem;">Active Classroom Focus Required</h4>
        <p style="font-size:0.85rem; color:var(--text-secondary); line-height:1.4;">Please add active focus subjects (Mathematics / English Language) under <strong>Account Settings ⚙️</strong> first to access and configure this form!</p>
      `;
      form.parentNode.insertBefore(warning, form);
    }

    if (activeSubjects.length === 0) {
      warning.style.display = 'block';
      form.style.display = 'none';
    } else {
      warning.style.display = 'none';
      form.style.display = 'block';

      // Synchronize active cards inside this form
      const mathCards = form.querySelectorAll('.subject-card[data-subject="math"]');
      const englishCards = form.querySelectorAll('.subject-card[data-subject="english"]');

      mathCards.forEach(c => {
        c.style.display = activeSubjects.includes('math') ? 'flex' : 'none';
      });
      englishCards.forEach(c => {
        c.style.display = activeSubjects.includes('english') ? 'flex' : 'none';
      });

      // Auto-select the first available subject card if the currently active card is hidden
      const activeCard = form.querySelector('.subject-card.active');
      if (!activeCard || activeCard.style.display === 'none') {
        const firstVisibleCard = form.querySelector('.subject-card:not([style*="display: none"])');
        if (firstVisibleCard) {
          firstVisibleCard.click();
        }
      }
    }
  });
}
