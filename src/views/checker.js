import { state, updateState } from '../state/store.js';
import { injectApprovedQuestion } from '../generators/english.js';

export function renderTeacherChecker() {
  const container = document.getElementById('pending-questions-container');
  if (!container) return;
  container.innerHTML = '';

  const user = state.currentUser;
  const profileObj = state.users[user.username];
  if (!profileObj) return;

  // Render stats
  document.getElementById('teacher-contrib-xp').textContent = `${profileObj.contributionXp} XP`;
  document.getElementById('teacher-verified-count').textContent = profileObj.verifiedCount;

  // Render rank
  const leaderboard = Object.values(state.users)
    .filter(u => u.role === 'teacher')
    .map(u => ({
      name: u.username === user.username ? `${u.name} (You)` : u.name,
      xp: u.contributionXp || 0,
      verifiedCount: u.verifiedCount || 0,
      isMe: u.username === user.username
    }))
    .sort((a, b) => b.xp - a.xp);

  const rankIndex = leaderboard.findIndex(r => r.isMe) + 1;
  let rankTier = 'Novice';
  if (profileObj.contributionXp >= 200) rankTier = 'Contributor';
  if (profileObj.contributionXp >= 400) rankTier = 'Master';
  if (profileObj.contributionXp >= 800) rankTier = 'Legend';
  document.getElementById('teacher-contrib-rank').textContent = rankIndex > 0 ? `#${rankIndex} (${rankTier})` : `N/A (${rankTier})`;

  // Render Leaderboard List
  const lbContainer = document.getElementById('teacher-leaderboard-list');
  if (lbContainer) {
    lbContainer.innerHTML = '';
    leaderboard.forEach((row, index) => {
      const rowDiv = document.createElement('div');
      rowDiv.style.display = 'flex';
      rowDiv.style.justifyContent = 'space-between';
      rowDiv.style.alignItems = 'center';
      rowDiv.style.padding = '0.6rem 0.8rem';
      rowDiv.style.background = row.isMe ? 'var(--primary-glow)' : 'var(--bg-secondary)';
      rowDiv.style.border = row.isMe ? '1px solid var(--primary-border)' : '1px solid var(--border-color)';
      rowDiv.style.borderRadius = 'var(--border-radius-sm)';
      rowDiv.style.marginBottom = '0.4rem';
      
      rowDiv.innerHTML = `
        <span style="font-size:0.85rem; ${row.isMe ? 'font-weight:700;' : ''}"><strong>#${index + 1}</strong> ${row.name}</span>
        <span style="color:var(--warning); font-weight:800; font-size:0.85rem;">${row.xp} XP</span>
      `;
      lbContainer.appendChild(rowDiv);
    });
  }

  // Count pending questions
  const pendingCount = state.pendingQuestions.length;
  document.getElementById('pending-q-count').textContent = `${pendingCount} Pending`;

  if (pendingCount === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:2rem; background:var(--bg-primary); border:1px solid var(--border-color); border-radius:var(--border-radius-md);">
        <p style="color:var(--text-muted); font-size:0.95rem; margin-bottom:0.5rem;">🎉 Hooray! The verification queue is completely empty.</p>
        <span style="font-size:0.8rem; color:var(--text-secondary);">Waiting for Admin to sync new generated batches...</span>
      </div>
    `;
    return;
  }

  // Render pending cards
  state.pendingQuestions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.background = 'var(--bg-primary)';
    card.style.border = '1px solid var(--border-color)';
    card.style.padding = '1.25rem';
    card.style.borderRadius = 'var(--border-radius-md)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '0.75rem';

    const badgeText = `${q.subject.toUpperCase()} • ${q.category} (${q.difficulty})`;
    
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="user-badge" style="background:var(--bg-secondary); color:var(--text-muted); font-size:0.75rem; font-weight:700;">${badgeText}</span>
        <span style="font-size:0.75rem; color:var(--text-muted);">AI Generated</span>
      </div>
      <div style="font-size:1.05rem; font-weight:700; color:var(--text-primary); margin-top:0.25rem;">${q.formula}</div>
      <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:0.5rem; margin-top:0.25rem;">
        ${q.choices.map(c => {
          const isCorrect = c === q.correct;
          return `
            <div style="padding:0.5rem; border-radius:var(--border-radius-sm); border:1px solid ${isCorrect ? 'var(--success-border)' : 'var(--border-color)'}; background:${isCorrect ? 'var(--success-glow)' : 'var(--bg-secondary)'}; font-size:0.85rem; display:flex; align-items:center; gap:0.4rem;">
              <span>${isCorrect ? '✅' : '⚪'}</span>
              <span>${c}</span>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem; border-top:1px solid var(--border-color); padding-top:0.75rem;">
        <button type="button" class="btn btn-danger btn-small reject-q-btn" data-index="${idx}" style="padding:0.4rem 1rem;">Reject ❌</button>
        <button type="button" class="btn btn-success btn-small approve-q-btn" data-index="${idx}" style="padding:0.4rem 1rem;">Approve ✅</button>
      </div>
    `;

    // Bind Approve
    card.querySelector('.approve-q-btn').addEventListener('click', (e) => {
      const qIndex = parseInt(e.currentTarget.dataset.index);
      const approvedQ = state.pendingQuestions[qIndex];

      if (approvedQ.subject === 'english') {
        injectApprovedQuestion(approvedQ.category.toLowerCase(), approvedQ.difficulty, approvedQ);
      }

      updateState(draft => {
        draft.pendingQuestions.splice(qIndex, 1);
        const u = draft.users[draft.currentUser.username];
        u.contributionXp += 50;
        u.verifiedCount += 1;
      });

      renderTeacherChecker();
      alert('Question approved and added to active database! +50 Contribution XP 🎓');
    });

    // Bind Reject
    card.querySelector('.reject-q-btn').addEventListener('click', (e) => {
      const qIndex = parseInt(e.currentTarget.dataset.index);
      const rejectAction = () => {
        updateState(draft => {
          draft.pendingQuestions.splice(qIndex, 1);
        });
        renderTeacherChecker();
      };

      if (window.safeConfirm) {
        window.safeConfirm('Are you sure you want to reject this question? It will be discarded.', rejectAction);
      } else if (confirm('Are you sure you want to reject this question? It will be discarded.')) {
        rejectAction();
      }
    });

    container.appendChild(card);
  });
}
