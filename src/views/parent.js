import { state, updateState, apiRequest, syncSession } from '../state/store.js';

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
        await apiRequest('/api/parent/link', 'POST', { kidUsername, kidPassword });
        alert(`Success! Linked ${kidUsername} to your parent account! 🔗`);
        newForm.reset();
        await syncSession();
        renderConnectedKids();
        renderParentDashboard();
      } catch (err) {
        alert(err.message || 'Verification failed! Please verify that the child username and password are correct.');
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
      childrenSelector.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 1.5rem; text-align: center; color: var(--text-muted); border: 2px dashed var(--border-color); border-radius: var(--border-radius-md);">
          👶 No children connected. Go to the "Children Management" tab on the left to link your child's account!
        </div>
      `;
    }
    return;
  }

  kids.forEach((kidKey, index) => {
    // 1. Add to dashboard children selector
    if (childrenSelector) {
      const btn = document.createElement('button');
      btn.className = `child-profile-card ${index === 0 ? 'active' : ''}`;
      btn.dataset.child = kidKey;
      btn.innerHTML = `
        <span class="avatar">👦</span>
        <div class="details">
          <strong style="text-transform: capitalize;">${kidKey}</strong>
          <span>Student Profile</span>
        </div>
      `;
      btn.addEventListener('click', () => {
        childrenSelector.querySelectorAll('.child-profile-card').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        renderParentDashboard();
      });
      childrenSelector.appendChild(btn);
    }

    // 2. Add to settings connected kids list
    if (listContainer) {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '0.75rem 1rem';
      row.style.background = 'var(--bg-primary)';
      row.style.borderRadius = 'var(--border-radius-sm)';
      row.style.border = '1px solid var(--border-color)';
      row.style.marginBottom = '0.5rem';
      
      row.innerHTML = `
        <span style="font-weight:700; text-transform: capitalize;">👦 ${kidKey}</span>
        <div style="display:flex; gap:0.5rem;">
          <button class="btn btn-secondary btn-small reset-kid-pw-btn" style="padding:0.35rem 0.75rem;">Reset PW 🔑</button>
          <button class="btn btn-danger btn-small unlink-kid-btn" style="padding:0.35rem 0.75rem;">Unlink ❌</button>
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
          await apiRequest('/api/parent/child/reset-password', 'POST', {
            childUsername: kidKey,
            newPassword: newPassword.trim()
          });
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
    await apiRequest('/api/parent/unlink', 'POST', { kidUsername: kidKey });
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
    // Fetch latest child data from server securely
    const kidObj = await apiRequest(`/api/parent/child/${kidKey}`);
    const history = kidObj.history || [];
    
    // Render Struggles List
    const strugglingList = document.getElementById('parent-struggling-list');
    if (strugglingList) {
      strugglingList.innerHTML = '';
      
      // Compute struggle areas dynamically based on low accuracy (<70%)
      const lowAccuracyTopics = {};
      history.forEach(h => {
        if (h.accuracy < 70) {
          lowAccuracyTopics[h.subject] = (lowAccuracyTopics[h.subject] || 0) + 1;
        }
      });

      const struggleEntries = Object.keys(lowAccuracyTopics).map(subj => {
        const name = subj === 'math' ? 'Mathematics (Multiplication/Division)' : 'English Grammar & Vocabulary';
        return {
          area: name,
          level: 'Requires Support ⚠️',
          recommendation: `Complete at least 3 practice challenges in ${subj === 'math' ? 'Multiplication' : 'Spelling'} this week.`
        };
      });

      if (struggleEntries.length === 0) {
        strugglingList.innerHTML = `
          <div style="text-align:center; padding:1.5rem; color:var(--success); font-weight:700;">
            🎉 Doing awesome! No struggling areas detected. Keep it up!
          </div>
        `;
      } else {
        struggleEntries.forEach(st => {
          const item = document.createElement('div');
          item.className = 'struggle-item';
          item.innerHTML = `
            <div class="struggle-title">
              <span style="font-weight:700;">${st.area}</span>
              <span class="user-badge" style="background:rgba(239,68,68,0.15); color:var(--danger); font-size:0.75rem;">${st.level}</span>
            </div>
            <p class="struggle-rec" style="font-size:0.8rem; margin-top:0.35rem;">💡 <strong>Parent Tip:</strong> ${st.recommendation}</p>
          `;
          strugglingList.appendChild(item);
        });
      }
    }

    // Render Performance Breakdown
    const progressStats = document.getElementById('parent-progress-stats');
    if (progressStats) {
      progressStats.innerHTML = '';
      
      // Group history by category to find average accuracy
      const topicStats = {};
      history.forEach(h => {
        const cat = h.subject === 'math' ? 'Mathematics' : 'English Language';
        if (!topicStats[cat]) {
          topicStats[cat] = { sum: 0, count: 0 };
        }
        topicStats[cat].sum += h.accuracy;
        topicStats[cat].count++;
      });

      const categories = ['Mathematics', 'English Language'];
      categories.forEach(cat => {
        const stat = topicStats[cat];
        const acc = stat ? Math.round(stat.sum / stat.count) : 0;
        
        const row = document.createElement('div');
        row.className = 'topic-stat-row';
        row.style.marginBottom = '1rem';
        row.innerHTML = `
          <div class="topic-info-lbl" style="display:flex; justify-content:space-between; margin-bottom:0.25rem; font-size:0.85rem; font-weight:700;">
            <span>${cat}</span>
            <span>${acc > 0 ? acc + '%' : 'No practice yet'}</span>
          </div>
          <div class="bar-outer" style="background:var(--bg-secondary); border-radius:5px; height:8px; overflow:hidden;">
            <div class="bar-inner" style="width: ${acc}%; height:100%; background: ${acc >= 85 ? 'var(--success)' : (acc >= 60 ? 'var(--warning)' : 'var(--danger)')};"></div>
          </div>
        `;
        progressStats.appendChild(row);
      });
    }

    // Render Activity Log Table
    const tbody = document.getElementById('parent-history-tbody');
    if (tbody) {
      tbody.innerHTML = '';
      if (history.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center; color:var(--text-muted); padding:2rem 0;">No learning activities completed yet.</td>
          </tr>
        `;
      } else {
        history.slice(0, 8).forEach(h => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${h.date}</td>
            <td style="font-weight:700; text-transform:capitalize;">${h.subject} (${h.score.split('/')[1]} Qs)</td>
            <td style="color:${h.accuracy >= 70 ? 'var(--success)' : 'var(--danger)'}; font-weight:800;">${h.score} (${h.accuracy}%)</td>
            <td>${h.timeSpent}</td>
            <td>
              <span class="user-badge" style="background:${h.status === 'Passed' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${h.status === 'Passed' ? 'var(--success)' : 'var(--danger)'}; font-size:0.75rem;">
                ${h.status}
              </span>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
    }

    // Draw Charts
    renderParentCharts(history);
  } catch (err) {
    console.error("Failed to load active child data:", err);
  }
}

function renderParentCharts(history) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const labelColor = isDark ? '#cbd5e1' : '#475569';

  // 1. Accuracy Trend (Line)
  const accuracyCtx = document.getElementById('parentAccuracyChart');
  if (accuracyCtx) {
    if (parentAccuracyChartInstance) parentAccuracyChartInstance.destroy();

    const historyData = [...history].reverse();
    const dates = historyData.map(h => h.date.split('T')[0]); // handle ISO timestamp dates
    const values = historyData.map(h => h.accuracy);

    parentAccuracyChartInstance = new Chart(accuracyCtx, {
      type: 'line',
      data: {
        labels: dates.length > 0 ? dates : ['No Data'],
        datasets: [{
          label: 'Accuracy (%)',
          data: values.length > 0 ? values : [0],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointBackgroundColor: '#34d399',
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: labelColor, font: { family: 'Outfit' } } },
          y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: labelColor, font: { family: 'Outfit' } } }
        }
      }
    });
  }

  // 2. Question Volume & XP Metrics (Bar)
  const analysisCtx = document.getElementById('parentAnalysisChart');
  if (analysisCtx) {
    if (parentAnalysisChartInstance) parentAnalysisChartInstance.destroy();

    // Sum totals by subject
    let mathTotal = 0, mathCorrect = 0;
    let engTotal = 0, engCorrect = 0;

    history.forEach(h => {
      const total = parseInt(h.score.split('/')[1]) || 0;
      const correct = parseInt(h.score.split('/')[0]) || 0;
      if (h.subject === 'math') {
        mathTotal += total;
        mathCorrect += correct;
      } else {
        engTotal += total;
        engCorrect += correct;
      }
    });

    parentAnalysisChartInstance = new Chart(analysisCtx, {
      type: 'bar',
      data: {
        labels: ['Mathematics', 'English Language'],
        datasets: [
          {
            label: 'Total Answered',
            data: [mathTotal, engTotal],
            backgroundColor: '#6366f1',
            borderRadius: 6
          },
          {
            label: 'Correct Answers',
            data: [mathCorrect, engCorrect],
            backgroundColor: '#10b981',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: { color: labelColor, font: { family: 'Outfit', size: 10 } }
          }
        },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: labelColor, font: { family: 'Outfit' } } },
          y: { grid: { color: gridColor }, ticks: { color: labelColor, font: { family: 'Outfit' } } }
        }
      }
    });
  }
}
