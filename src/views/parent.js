import { state, updateState, syncSession } from '../state/store.js';
import { supabase } from '../config/supabase.js';

let parentAccuracyChartInstance = null;
let parentAnalysisChartInstance = null;

export function initParent() {
  const linkForm = document.getElementById('parent-link-child-form');
  if (linkForm) {
    // Prevent duplicate listeners
    const newForm = linkForm.cloneNode(true);
    linkForm.parentNode.replaceChild(newForm, linkForm);

    newForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const kidUsername = document.getElementById('parent-link-child-username').value.trim().toLowerCase();
      const kidPassword = document.getElementById('parent-link-child-password').value;

      try {
        // Authenticate the child account using a secondary Supabase client that does not persist session
        const tempClient = window.supabase.createClient(
          'https://kxuntlznooksffpmuzyu.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4dW50bHpub29rc2ZmcG11enl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MDAyODMsImV4cCI6MjA5ODM3NjI4M30.3cwd1RyYFtphF9jMki1UC_pIcogchAVecVGUeAmpDWw',
          { auth: { persistSession: false } }
        );

        const { data: authData, error: authError } = await tempClient.auth.signInWithPassword({
          email: `${kidUsername}@student.nexxbit.io`,
          password: kidPassword
        });

        if (authError || !authData.user) {
          throw new Error('Verification failed! Please verify that the child username and password are correct.');
        }

        // Successfully verified. Now link the parent's email to this student profile
        const { error: updateError } = await supabase
          .from('users')
          .update({ parent_email: state.currentUser.email })
          .eq('id', authData.user.id);

        if (updateError) throw updateError;

        alert(`Success! Linked ${kidUsername} to your parent account! 🔗`);
        newForm.reset();
        await syncSession();
        renderConnectedKids();
        renderParentDashboard();
      } catch (err) {
        alert(err.message || 'Verification failed!');
      }
    });
  }

  // Draw initial state
  renderConnectedKids();
  renderParentDashboard();
}

export function renderConnectedKids() {
  const user = state.currentUser;
  if (!user || user.role !== 'parent') return;
  const profile = state.users[user.username];
  const listContainer = document.getElementById('parent-connected-kids-list');
  const childrenSelector = document.querySelector('.children-selector');
  if (!profile) return;

  if (listContainer) listContainer.innerHTML = '';
  if (childrenSelector) childrenSelector.innerHTML = '';

  const kids = profile.linkedKids || [];
  if (kids.length === 0) {
    if (listContainer) {
      listContainer.innerHTML = '<span style="font-size:0.9rem; color:var(--text-muted); font-style:italic;">No kids linked yet.</span>';
    }
    if (childrenSelector) {
      childrenSelector.innerHTML = '<span style="font-size:0.9rem; color:var(--text-muted); font-style:italic;">Add a child to view reports.</span>';
    }
    return;
  }

  // Populate Dashboard child selector list & child manager rows
  kids.forEach((kidKey, idx) => {
    const kidData = state.users[kidKey];
    if (!kidData) return;

    // A. Add to Dashboard Selector
    if (childrenSelector) {
      const card = document.createElement('button');
      card.className = `child-profile-card ${idx === 0 ? 'active' : ''}`;
      card.dataset.child = kidKey;
      card.innerHTML = `
        <div class="child-avatar">${kidData.avatar || '🧒'}</div>
        <div class="child-details">
          <div class="child-name" style="text-transform:capitalize;">${kidData.name}</div>
          <div class="child-xp">${kidData.xp || 0} XP // STREAK ${kidData.streak || 0}🔥</div>
        </div>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.child-profile-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        renderParentDashboard();
      });

      childrenSelector.appendChild(card);
    }

    // B. Add to Manager Settings list
    if (listContainer) {
      const row = document.createElement('div');
      row.className = 'connected-kid-row';
      row.innerHTML = `
        <div class="kid-info">
          <span class="kid-avatar">${kidData.avatar || '🧒'}</span>
          <div>
            <span class="kid-name" style="text-transform:capitalize;">${kidData.name} (@${kidKey})</span>
            <div class="kid-meta" style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">FRIEND_CODE: ${kidData.friendCode || 'N/A'}</div>
          </div>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <button class="btn btn-secondary btn-small reset-kid-pw-btn">Reset PW 🔑</button>
          <button class="btn btn-danger btn-small unlink-kid-btn">Unlink ❌</button>
        </div>
      `;

      row.querySelector('.reset-kid-pw-btn').addEventListener('click', async () => {
        const newPassword = prompt(`Enter new password for ${kidKey}:`, 'abcd1234');
        if (newPassword === null) return;
        if (newPassword.trim().length < 8) {
          alert('Password must be at least 8 characters long!');
          return;
        }
        try {
          // Trigger Postgres security definer RPC function to change child password securely
          const { error } = await supabase.rpc('reset_student_password', {
            student_username: kidKey,
            new_password: newPassword.trim()
          });
          
          if (error) throw error;
          alert(`Successfully updated password for ${kidKey}!`);
        } catch (err) {
          alert(err.message || 'Failed to update child password.');
        }
      });

      row.querySelector('.unlink-kid-btn').addEventListener('click', () => {
        const unlinkAction = () => {
          unlinkChild(kidKey);
        };
        
        if (window.safeConfirm) {
          window.safeConfirm(`Are you sure you want to unlink ${kidKey}?`, unlinkAction);
        } else if (confirm(`Are you sure you want to unlink ${kidKey}?`)) {
          unlinkAction();
        }
      });

      listContainer.appendChild(row);
    }
  });
}

async function unlinkChild(kidKey) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ parent_email: null })
      .eq('username', kidKey);
    
    if (error) throw error;

    await syncSession();
    renderConnectedKids();
    renderParentDashboard();
  } catch (err) {
    alert(err.message);
  }
}

export async function renderParentDashboard() {
  const user = state.currentUser;
  if (!user || user.role !== 'parent') return;
  const profile = state.users[user.username];
  if (!profile) return;

  const activeChildBtn = document.querySelector('.child-profile-card.active');
  const kidKey = activeChildBtn ? activeChildBtn.dataset.child : null;

  const insightsGrid = document.querySelector('.parent-insights-grid');
  const dashboardVisuals = document.querySelector('.dashboard-visuals');
  const logsCard = document.querySelector('#parent-dashboard .card:last-of-type');

  if (!kidKey) {
    if (insightsGrid) insightsGrid.style.display = 'none';
    if (dashboardVisuals) dashboardVisuals.style.display = 'none';
    if (logsCard) logsCard.style.display = 'none';
    return;
  }

  // Show widgets
  if (insightsGrid) insightsGrid.style.display = 'grid';
  if (dashboardVisuals) dashboardVisuals.style.display = 'grid';
  if (logsCard) logsCard.style.display = 'block';

  try {
    // Fetch latest child data from Supabase
    const { data: kid, error: kidErr } = await supabase
      .from('users')
      .select('*')
      .eq('username', kidKey)
      .single();
    if (kidErr || !kid) throw kidErr;

    const { data: dbHistory } = await supabase
      .from('quiz_history')
      .select('*')
      .eq('student_id', kid.id)
      .order('date', { ascending: false });

    const history = dbHistory ? dbHistory.map(h => ({
      date: h.date,
      subject: h.subject,
      score: h.score,
      accuracy: h.accuracy,
      timeSpent: h.time_spent,
      status: h.status
    })) : [];
    
    // Render Struggles List
    const strugglingList = document.getElementById('parent-struggling-list');
    if (strugglingList) {
      strugglingList.innerHTML = '';
      
      const lowAccuracyTopics = {};
      history.forEach(quiz => {
        if (quiz.accuracy < 70) {
          const key = `${quiz.subject.toUpperCase()}`;
          lowAccuracyTopics[key] = (lowAccuracyTopics[key] || 0) + 1;
        }
      });

      const struggleKeys = Object.keys(lowAccuracyTopics);
      if (struggleKeys.length === 0) {
        strugglingList.innerHTML = '<li style="font-size:0.85rem; color:var(--text-muted);">Doing great! No current focus areas needed.</li>';
      } else {
        struggleKeys.forEach(area => {
          const li = document.createElement('li');
          li.style.display = 'flex';
          li.style.justifyContent = 'space-between';
          li.style.fontSize = '0.85rem';
          li.style.marginBottom = '0.25rem';
          li.innerHTML = `
            <span>⚠️ ${area} Subject Practice</span>
            <span class="user-badge status-alert" style="color:var(--danger); border-color:var(--danger); background:rgba(239,68,68,0.05); font-size:0.65rem;">${lowAccuracyTopics[area]} Quizzes &lt; 70%</span>
          `;
          strugglingList.appendChild(li);
        });
      }
    }

    // Render Stats
    const totalQuizzes = document.getElementById('parent-total-quizzes');
    const avgAccuracy = document.getElementById('parent-avg-accuracy');
    const childRank = document.getElementById('parent-child-rank');

    if (totalQuizzes) totalQuizzes.textContent = history.length;
    if (avgAccuracy) {
      const sum = history.reduce((acc, q) => acc + q.accuracy, 0);
      avgAccuracy.textContent = history.length > 0 ? `${Math.round(sum / history.length)}%` : '0%';
    }
    if (childRank) {
      childRank.textContent = kid.xp > 3000 ? 'Champion' : kid.xp > 1500 ? 'Expert' : 'Novice';
    }

    // Render Progress History table
    const tableBody = document.getElementById('parent-quiz-logs-body');
    if (tableBody) {
      tableBody.innerHTML = '';
      if (history.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:1rem; font-style:italic;">No quiz logs recorded yet.</td></tr>';
      } else {
        history.slice(0, 10).forEach(log => {
          const tr = document.createElement('tr');
          const formattedDate = new Date(log.date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
          tr.innerHTML = `
            <td style="font-family:var(--font-mono); font-size:0.75rem;">${formattedDate}</td>
            <td style="text-transform:uppercase; font-size:0.8rem; font-weight:700;">${log.subject}</td>
            <td>${log.score}</td>
            <td>${log.accuracy}%</td>
            <td><span class="user-badge status-${log.status === 'Passed' ? 'active' : 'disabled'}">${log.status}</span></td>
          `;
          tableBody.appendChild(tr);
        });
      }
    }

    // Draw Parent Charts
    drawParentCharts(history);

  } catch (err) {
    console.error("Failed to load child dashboard data:", err);
  }
}

function drawParentCharts(history) {
  const accCtx = document.getElementById('parent-accuracy-chart');
  const anaCtx = document.getElementById('parent-subject-analysis-chart');
  
  if (!accCtx || !anaCtx) return;

  const reversedLogs = [...history].reverse();
  const accLabels = reversedLogs.map((_, i) => `Q${i + 1}`);
  const accData = reversedLogs.map(q => q.accuracy);

  // 1. Line Chart (Accuracy Progress)
  if (parentAccuracyChartInstance) parentAccuracyChartInstance.destroy();
  parentAccuracyChartInstance = new Chart(accCtx, {
    type: 'line',
    data: {
      labels: accLabels,
      datasets: [{
        label: 'Quiz Accuracy (%)',
        data: accData,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 2,
        tension: 0.35,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { grid: { display: false } }
      }
    }
  });

  // 2. Bar Chart (Subject Breakdown)
  const subjectSums = {};
  const subjectCounts = {};
  history.forEach(q => {
    subjectSums[q.subject] = (subjectSums[q.subject] || 0) + q.accuracy;
    subjectCounts[q.subject] = (subjectCounts[q.subject] || 0) + 1;
  });

  const subjects = Object.keys(subjectCounts);
  const avgAccuracies = subjects.map(s => Math.round(subjectSums[s] / subjectCounts[s]));

  if (parentAnalysisChartInstance) parentAnalysisChartInstance.destroy();
  parentAnalysisChartInstance = new Chart(anaCtx, {
    type: 'bar',
    data: {
      labels: subjects.map(s => s.toUpperCase()),
      datasets: [{
        data: avgAccuracies,
        backgroundColor: ['rgba(99,102,241,0.7)', 'rgba(6,182,212,0.7)', 'rgba(236,72,153,0.7)'],
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { grid: { display: false } }
      }
    }
  });
}
