import { state, updateState, generateFriendCode, syncSession } from '../state/store.js';
import { supabase } from '../config/supabase.js';
import { generateQuestions } from '../generators/index.js';
import { SUBJECT_REGISTRY } from '../config/subjects.js';

let activeQuizQuestions = [];
let currentQuestionIndex = 0;
let scoreCount = 0;
let timerInterval = null;
let timeLeft = 15;
let isTimerActive = true;
let isAnswered = false;

function getElId(role, baseId) {
  if (role === 'student') {
    const mapping = {
      'start-quiz-btn': 'start-quiz-btn',
      'quiz-next-btn': 'quiz-next-btn',
      'finish-quiz-btn': 'finish-quiz-btn',
      'quiz-intro': 'quiz-intro',
      'quiz-screen': 'quiz-active',
      'quiz-results': 'quiz-results',
      'quiz-timer-val': 'quiz-timer-val',
      'quiz-progress-bar': 'quiz-progress-bar',
      'math-question-text': 'math-question-text',
      'quiz-options-grid': 'quiz-options-grid',
      'quiz-feedback-toast': 'quiz-feedback-toast'
    };
    return mapping[baseId] || baseId;
  } else {
    const mapping = {
      'start-quiz-btn': 'teacher-start-quiz-btn',
      'quiz-next-btn': 'teacher-quiz-next-btn',
      'finish-quiz-btn': 'teacher-finish-quiz-btn',
      'quiz-intro': 'teacher-quiz-intro',
      'quiz-screen': 'teacher-quiz-active',
      'quiz-results': 'teacher-quiz-results',
      'quiz-timer-val': 'teacher-quiz-timer-val',
      'quiz-progress-bar': 'teacher-quiz-progress-bar',
      'math-question-text': 'teacher-math-question-text',
      'quiz-options-grid': 'teacher-quiz-options-grid',
      'quiz-feedback-toast': 'teacher-quiz-feedback-toast'
    };
    return mapping[baseId] || `teacher-${baseId}`;
  }
}

export function initPlayground(role) {
  // Bind start buttons
  const startBtn = document.getElementById(getElId(role, 'start-quiz-btn'));
  if (startBtn) {
    startBtn.addEventListener('click', () => startQuizGameplay(role));
  }

  // Also bind retry/retry-quiz-btn for student
  if (role === 'student') {
    const retryBtn = document.getElementById('retry-quiz-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => startQuizGameplay(role));
    }
  }

  // Bind next button
  const nextBtn = document.getElementById(getElId(role, 'quiz-next-btn'));
  if (nextBtn) {
    nextBtn.addEventListener('click', () => advanceToNextQuestion(role));
  }

  // Bind return button
  const finishBtn = document.getElementById(getElId(role, 'finish-quiz-btn'));
  if (finishBtn) {
    finishBtn.addEventListener('click', () => {
      document.getElementById(getElId(role, 'quiz-results')).classList.remove('active');
      document.getElementById(getElId(role, 'quiz-intro')).classList.add('active');
    });
  }

  // Also bind go-dash-btn for student
  if (role === 'student') {
    const goDashBtn = document.getElementById('go-dash-btn');
    if (goDashBtn) {
      goDashBtn.addEventListener('click', () => {
        document.getElementById(getElId(role, 'quiz-results')).classList.remove('active');
        document.getElementById(getElId(role, 'quiz-intro')).classList.add('active');
        const dashTabBtn = document.querySelector('#student-section .sidebar-nav button[data-tab="student-dashboard"]');
        if (dashTabBtn) dashTabBtn.click();
      });
    }
  }

  // Render difficulty card selectors
  setupDifficultyCards(role);
  
  // Render Subject and Topic selectors based on registry
  setupSubjectAndTopics(role);
}

function setupDifficultyCards(role) {
  const cards = document.querySelectorAll(`#${role}-quiz-config .difficulty-card`);
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      
      const difficulty = card.dataset.difficulty;
      updateState(draft => {
        if (role === 'student') {
          draft.student.difficulty = difficulty;
        } else {
          draft.teacherConfig.difficulty = difficulty;
        }
      });
    });
  });
}

export function setupSubjectAndTopics(role) {
  const subjectSelect = document.getElementById(`${role}-quiz-subject-select`);
  if (!subjectSelect) return;

  // Populate subject select from registry
  subjectSelect.innerHTML = '';
  Object.values(SUBJECT_REGISTRY).forEach(sub => {
    const opt = document.createElement('option');
    opt.value = sub.id;
    opt.textContent = `${sub.emoji} ${sub.name}`;
    subjectSelect.appendChild(opt);
  });

  // Handle subject change to render topics dynamically
  subjectSelect.addEventListener('change', () => {
    const subjectVal = subjectSelect.value;
    updateState(draft => {
      if (role === 'student') {
        draft.student.subject = subjectVal;
      } else {
        draft.teacherConfig.subject = subjectVal;
      }
    });
    renderTopicCheckboxes(role, subjectVal);
  });

  // Initial render
  const initialSubject = role === 'student' ? state.student.subject : state.teacherConfig.subject;
  subjectSelect.value = initialSubject;
  renderTopicCheckboxes(role, initialSubject);
}

function renderTopicCheckboxes(role, subjectKey) {
  const container = document.getElementById(`${role}-topics-checkbox-container`);
  if (!container) return;
  container.innerHTML = '';

  const subjectData = SUBJECT_REGISTRY[subjectKey];
  if (!subjectData) return;

  subjectData.topics.forEach(topic => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '0.5rem';
    div.style.padding = '0.75rem 1rem';
    div.style.background = 'var(--bg-primary)';
    div.style.border = '1px solid var(--border-color)';
    div.style.borderRadius = 'var(--border-radius-sm)';
    div.style.cursor = 'pointer';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = topic.id;
    checkbox.id = `${role}-topic-${topic.id}`;
    checkbox.style.cursor = 'pointer';

    // Set initial checked state
    if (role === 'student') {
      const activeTopics = (subjectKey === 'math') ? state.student.operators : state.student.englishTopics;
      checkbox.checked = activeTopics.includes(topic.id);
    } else {
      const activeTopics = (subjectKey === 'math') ? state.teacherConfig.operators : state.teacherConfig.englishTopics;
      checkbox.checked = activeTopics.includes(topic.id);
    }

    checkbox.addEventListener('change', () => {
      updateState(draft => {
        let activeList = [];
        if (role === 'student') {
          activeList = (subjectKey === 'math') ? draft.student.operators : draft.student.englishTopics;
        } else {
          activeList = (subjectKey === 'math') ? draft.teacherConfig.operators : draft.teacherConfig.englishTopics;
        }

        if (checkbox.checked) {
          if (!activeList.includes(topic.id)) activeList.push(topic.id);
        } else {
          const index = activeList.indexOf(topic.id);
          if (index > -1) activeList.splice(index, 1);
        }
      });
    });

    div.addEventListener('click', (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    });

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = `${topic.icon} ${topic.name}`;
    label.style.fontWeight = '700';
    label.style.cursor = 'pointer';

    div.appendChild(checkbox);
    div.appendChild(label);
    container.appendChild(div);
  });
}

function startQuizGameplay(role) {
  const subject = role === 'student' ? state.student.subject : state.teacherConfig.subject;
  const difficulty = role === 'student' ? state.student.difficulty : state.teacherConfig.difficulty;
  const topics = role === 'student' 
    ? (subject === 'math' ? state.student.operators : state.student.englishTopics) 
    : (subject === 'math' ? state.teacherConfig.operators : state.teacherConfig.englishTopics);
  
  let count = 10;
  if (role === 'student') {
    count = state.student.questionCount || 10;
  } else {
    const countCard = document.querySelector('.count-card.active');
    count = countCard ? parseInt(countCard.dataset.count) : 10;
  }

  // Generate Questions via Dispatcher unless playing an assignment
  if (role === 'student' && window.currentAssignmentId) {
    const assign = state.assignments.find(a => a.id === window.currentAssignmentId);
    if (assign) {
      activeQuizQuestions = assign.questions || [];
    } else {
      activeQuizQuestions = generateQuestions(subject, difficulty, topics, count);
    }
  } else {
    activeQuizQuestions = generateQuestions(subject, difficulty, topics, count);
  }
  
  if (activeQuizQuestions.length === 0) {
    alert('Please select at least one active topic to start!');
    return;
  }

  currentQuestionIndex = 0;
  scoreCount = 0;
  isAnswered = false;

  // Toggle Timer setting based on teacher config
  if (role === 'teacher') {
    const timerCheckbox = document.getElementById('teacher-timer-toggle');
    isTimerActive = timerCheckbox ? timerCheckbox.checked : true;
    const timerVal = document.getElementById('teacher-quiz-timer-val');
    if (timerVal) timerVal.style.display = isTimerActive ? 'inline-block' : 'none';
  } else {
    isTimerActive = true;
  }

  // Switch screens
  document.getElementById(getElId(role, 'quiz-intro')).classList.remove('active');
  document.getElementById(getElId(role, 'quiz-screen')).classList.add('active');

  renderPlaygroundQuestion(role);
}

function renderPlaygroundQuestion(role) {
  isAnswered = false;
  const q = activeQuizQuestions[currentQuestionIndex];
  
  // Progress text & Bar
  const currentNumEl = document.getElementById(role === 'student' ? 'current-q-num' : 'teacher-current-q-num');
  const totalNumEl = document.getElementById(role === 'student' ? 'total-q-num' : 'teacher-total-q-num');
  if (currentNumEl) currentNumEl.textContent = currentQuestionIndex + 1;
  if (totalNumEl) totalNumEl.textContent = activeQuizQuestions.length;

  const progBar = document.getElementById(getElId(role, 'quiz-progress-bar'));
  if (progBar) progBar.style.width = `${((currentQuestionIndex + 1) / activeQuizQuestions.length) * 100}%`;

  // Question Text
  const questionText = document.getElementById(getElId(role, 'math-question-text'));
  if (questionText) questionText.textContent = q.formula;

  // Hide toast & next button
  const toast = document.getElementById(getElId(role, 'quiz-feedback-toast'));
  if (toast) toast.classList.remove('show', 'correct', 'wrong');
  
  const nextBtn = document.getElementById(getElId(role, 'quiz-next-btn'));
  if (nextBtn) nextBtn.style.display = 'none';

  // Render options grid
  const grid = document.getElementById(getElId(role, 'quiz-options-grid'));
  if (grid) {
    grid.innerHTML = '';
    q.choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = choice;
      btn.addEventListener('click', () => handleChoiceSelection(role, btn, choice));
      grid.appendChild(btn);
    });
  }

  // Launch Timer
  timeLeft = 15;
  const timerDisplay = document.getElementById(getElId(role, 'quiz-timer-val'));
  if (timerDisplay) timerDisplay.textContent = `${timeLeft}s`;

  if (timerInterval) clearInterval(timerInterval);
  
  if (isTimerActive) {
    timerInterval = setInterval(() => {
      timeLeft--;
      if (timerDisplay) timerDisplay.textContent = `${timeLeft}s`;
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        handleTimeout(role);
      }
    }, 1000);
  }
}

function handleChoiceSelection(role, optionBtn, selectedValue) {
  if (isAnswered) return;
  isAnswered = true;
  if (timerInterval) clearInterval(timerInterval);

  const q = activeQuizQuestions[currentQuestionIndex];
  const isCorrect = selectedValue === q.correct;

  const toast = document.getElementById(getElId(role, 'quiz-feedback-toast'));
  const grid = document.getElementById(getElId(role, 'quiz-options-grid'));
  const buttons = grid.querySelectorAll('.option-btn');

  buttons.forEach(btn => {
    if (parseFloat(btn.textContent) === q.correct || btn.textContent === q.correct) {
      btn.classList.add('correct');
    } else if (btn === optionBtn && !isCorrect) {
      btn.classList.add('wrong');
    }
  });

  if (isCorrect) {
    scoreCount++;
    if (toast) {
      toast.textContent = 'Correct Answer! 🎉';
      toast.className = 'feedback-toast show correct';
    }
  } else {
    if (toast) {
      toast.textContent = `Oops! Correct answer was ${q.correct}.`;
      toast.className = 'feedback-toast show wrong';
    }
  }

  const nextBtn = document.getElementById(getElId(role, 'quiz-next-btn'));
  if (nextBtn) nextBtn.style.display = 'block';
}

function handleTimeout(role) {
  if (isAnswered) return;
  isAnswered = true;

  const q = activeQuizQuestions[currentQuestionIndex];
  const toast = document.getElementById(getElId(role, 'quiz-feedback-toast'));
  const grid = document.getElementById(getElId(role, 'quiz-options-grid'));
  const buttons = grid.querySelectorAll('.option-btn');

  buttons.forEach(btn => {
    if (parseFloat(btn.textContent) === q.correct || btn.textContent === q.correct) {
      btn.classList.add('correct');
    }
  });

  if (toast) {
    toast.textContent = `Time's up! Correct answer was ${q.correct}.`;
    toast.className = 'feedback-toast show wrong';
  }

  const nextBtn = document.getElementById(getElId(role, 'quiz-next-btn'));
  if (nextBtn) nextBtn.style.display = 'block';
}

function advanceToNextQuestion(role) {
  currentQuestionIndex++;
  if (currentQuestionIndex < activeQuizQuestions.length) {
    renderPlaygroundQuestion(role);
  } else {
    showQuizResultsScreen(role);
  }
}

function showQuizResultsScreen(role) {
  if (timerInterval) clearInterval(timerInterval);
  
  document.getElementById(getElId(role, 'quiz-screen')).classList.remove('active');
  document.getElementById(getElId(role, 'quiz-results')).classList.add('active');

  const accuracy = Math.round((scoreCount / activeQuizQuestions.length) * 100);
  
  const scoreDisplay = document.getElementById(role === 'student' ? 'res-score' : 'teacher-res-score');
  const accuracyDisplay = document.getElementById(role === 'student' ? 'res-accuracy' : 'teacher-res-accuracy');
  if (scoreDisplay) scoreDisplay.textContent = `${scoreCount}/${activeQuizQuestions.length}`;
  if (accuracyDisplay) accuracyDisplay.textContent = `${accuracy}%`;

  if (role === 'student') {
    const pointsGained = scoreCount * 50;
    
    (async () => {
      try {
        const { error: histError } = await supabase
          .from('quiz_history')
          .insert({
            student_id: state.currentUser.id,
            subject: state.student.subject,
            score: `${scoreCount}/${activeQuizQuestions.length}`,
            accuracy: accuracy,
            time_spent: `${15 * activeQuizQuestions.length - timeLeft}s`,
            status: accuracy >= 70 ? 'Passed' : 'Failed'
          });
        if (histError) throw histError;

        const { data: profile } = await supabase
          .from('users')
          .select('xp, streak')
          .eq('id', state.currentUser.id)
          .single();
        
        const newXp = (profile.xp || 0) + pointsGained;
        const newStreak = (profile.streak || 0) + 1;

        const { error: userError } = await supabase
          .from('users')
          .update({
            xp: newXp,
            streak: newStreak
          })
          .eq('id', state.currentUser.id);
        if (userError) throw userError;

        await syncSession();
      } catch (err) {
        console.error("Failed to submit quiz results:", err);
      }
    })();

    const xpEarnedText = document.getElementById('student-res-xp-earned');
    if (xpEarnedText) xpEarnedText.textContent = `+${pointsGained} Practice XP Gained!`;
  }
}

export function launchAssignmentQuiz(assignmentId) {
  const assign = state.assignments.find(a => a.id === assignmentId);
  if (!assign) return;

  activeQuizQuestions = assign.questions || [];
  currentQuestionIndex = 0;
  scoreCount = 0;
  isAnswered = false;
  isTimerActive = true;

  const titleEl = document.getElementById('playground-title');
  const descEl = document.getElementById('playground-desc');
  if (titleEl) titleEl.textContent = assign.title;
  if (descEl) descEl.textContent = `Assigned task from classroom: ${assign.classroom}. Solutions yield XP!`;

  const diffEl = document.getElementById('preview-difficulty');
  const countEl = document.getElementById('preview-count');
  const typesEl = document.getElementById('preview-types');
  if (diffEl) diffEl.textContent = (assign.questions[0]?.difficulty || 'medium').toUpperCase();
  if (countEl) countEl.textContent = assign.questions.length;
  if (typesEl) typesEl.textContent = assign.subject;

  window.currentAssignmentId = assignmentId;

  const playTabBtn = document.querySelector('#student-section .sidebar-nav button[data-tab="student-playground"]');
  if (playTabBtn) {
    playTabBtn.click();
  }
}

export function updatePlaygroundPreview() {
  const diffEl = document.getElementById('preview-difficulty');
  const countEl = document.getElementById('preview-count');
  const typesEl = document.getElementById('preview-types');
  if (!diffEl || !countEl || !typesEl) return;

  const subject = state.student.subject || 'math';
  const difficulty = state.student.difficulty || 'medium';
  const count = state.student.questionCount || 10;
  const topics = (subject === 'math') ? state.student.operators : state.student.englishTopics;

  diffEl.textContent = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  countEl.textContent = count;
  
  const topicNames = topics.map(t => {
    if (subject === 'math') {
      if (t === 'add') return 'Addition';
      if (t === 'subtract') return 'Subtraction';
      if (t === 'multiply') return 'Multiplication';
      if (t === 'divide') return 'Division';
    } else {
      if (t === 'spelling') return 'Spelling';
      if (t === 'vocabulary') return 'Vocabulary';
      if (t === 'grammar') return 'Grammar';
    }
    return t;
  });
  typesEl.textContent = topicNames.join(', ') || 'None';
}
