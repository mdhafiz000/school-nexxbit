import { state, updateState, syncSession } from '../state/store.js';
import { supabase } from '../config/supabase.js';
import { launchAssignmentQuiz } from './playground.js';

let progressChartInstance = null;

export function getTierForXp(xp) {
  if (xp < 500) return { name: 'Bronze I', className: 'tier-bronze' };
  if (xp < 1000) return { name: 'Bronze II', className: 'tier-bronze' };
  if (xp < 1500) return { name: 'Silver I', className: 'tier-silver' };
  if (xp < 2000) return { name: 'Silver II', className: 'tier-silver' };
  if (xp < 3000) return { name: 'Gold III', className: 'tier-gold' };
  if (xp < 4000) return { name: 'Gold Master', className: 'tier-gold' };
  return { name: 'Diamond Champion', className: 'tier-diamond' };
}

export function renderProgressChart() {
  const ctx = document.getElementById('progressChart');
  if (!ctx) return;

  const profile = state.users[state.currentUser.username];
  if (!profile) return;

  const historyData = [...(profile.history || [])].reverse();
  const slicedData = historyData.slice(-10); // Show last 10 quizzes

  const labels = slicedData.map(h => {
    const d = new Date(h.date);
    return isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const accuracyValues = slicedData.map(h => h.accuracy);

  if (progressChartInstance) {
    progressChartInstance.destroy();
    progressChartInstance = null;
  }

  const noDataNotice = document.getElementById('progress-chart-no-data');
  if (accuracyValues.length === 0) {
    ctx.style.display = 'none';
    if (!noDataNotice) {
      const notice = document.createElement('div');
      notice.id = 'progress-chart-no-data';
      notice.style.height = '100%';
      notice.style.display = 'flex';
      notice.style.alignItems = 'center';
      notice.style.justifyContent = 'center';
      notice.style.color = 'var(--text-muted)';
      notice.style.fontSize = '0.9rem';
      notice.style.fontStyle = 'italic';
      notice.textContent = '📈 No quiz history yet. Complete a practice quiz to view progress trend!';
      ctx.parentNode.appendChild(notice);
    } else {
      noDataNotice.style.display = 'flex';
    }
    return;
  } else {
    ctx.style.display = 'block';
    if (noDataNotice) noDataNotice.style.display = 'none';
  }

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const labelColor = isDark ? '#cbd5e1' : '#475569';

  try {
    progressChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Accuracy Score (%)',
          data: accuracyValues,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointBackgroundColor: '#818cf8',
          pointRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: labelColor, font: { family: 'Outfit' } }
          },
          y: {
            min: 0,
            max: 100,
            grid: { color: gridColor },
            ticks: { color: labelColor, font: { family: 'Outfit' } }
          }
        }
      }
    });
  } catch (err) {
    console.error('Error drawing chart:', err);
  }
}

export function renderStudentDashboard() {
  const profile = state.users[state.currentUser.username];
  if (!profile) return;

  const xpVal = profile.xp || 0;
  const streakVal = profile.streak || 0;

  const xpEl = document.getElementById('student-xp');
  const streakEl = document.getElementById('student-streak');
  const accEl = document.getElementById('student-accuracy');
  const tierDisplayEl = document.getElementById('student-tier-display');
  const tierSidebarEl = document.getElementById('student-tier');

  if (xpEl) xpEl.textContent = `${xpVal} XP`;
  if (streakEl) streakEl.textContent = `${streakVal} Days`;
  
  // Calculate average accuracy from student's history
  const history = profile.history || [];
  let totalAcc = 0;
  history.forEach(h => totalAcc += h.accuracy);
  const avgAcc = history.length > 0 ? Math.round(totalAcc / history.length) : 0;
  if (accEl) accEl.textContent = `${avgAcc}%`;

  const tier = getTierForXp(xpVal);
  if (tierDisplayEl) tierDisplayEl.textContent = tier.name;
  if (tierSidebarEl) {
    tierSidebarEl.textContent = `Tier: ${tier.name}`;
    tierSidebarEl.className = 'user-badge';
    tierSidebarEl.classList.add(tier.className);
  }

  // Render Co-op Quests
  const questsContainer = document.getElementById('coop-quests-container');
  if (questsContainer) {
    questsContainer.innerHTML = '';
    
    const quests = state.student.coopQuests || [];
    quests.forEach(q => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.background = 'var(--bg-primary)';
      card.style.padding = '1.25rem';
      card.style.borderRadius = 'var(--border-radius-md)';
      card.style.border = '1px solid var(--border-color)';
      
      const pct = Math.round((q.progress / q.target) * 100);
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <h4 style="font-weight:700;">${q.title}</h4>
          <span class="user-badge" style="background:var(--primary-glow); color:var(--primary); font-size:0.75rem;">${pct}% Complete</span>
        </div>
        <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.75rem;">Category: ${q.category} | Reward: ${q.reward}</p>
        <div style="background:var(--bg-secondary); border-radius:5px; height:10px; overflow:hidden; margin-bottom:0.5rem;">
          <div style="background:var(--primary); height:100%; width:${pct}%;"></div>
        </div>
        <span style="font-size:0.75rem; color:var(--text-secondary);">Participants: ${q.participants.join(', ')}</span>
      `;
      questsContainer.appendChild(card);
    });
  }

  // Render Enrolled Classrooms
  const classList = document.getElementById('student-classrooms-list');
  if (classList) {
    classList.innerHTML = '';
    
    const joinedClasses = state.classrooms.filter(c => c.students.some(s => s.name === profile.name));

    if (joinedClasses.length === 0) {
      classList.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 1.5rem; text-align: center; color: var(--text-muted); border: 2px dashed var(--border-color); border-radius: var(--border-radius-md); background: var(--bg-primary);">
          🏫 You haven't joined any classrooms yet. Enter an invite code in the "Join Classroom" box above!
        </div>
      `;
    } else {
      joinedClasses.forEach(c => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.background = 'var(--bg-primary)';
        card.style.border = '1px solid var(--border-color)';
        card.style.borderRadius = 'var(--border-radius-md)';
        card.style.padding = '1.25rem';
        
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <h4 style="font-weight:800; font-size:1.1rem; color:var(--text-primary);">${c.name}</h4>
            <span class="user-badge" style="font-size:0.75rem; background: var(--bg-secondary); color: var(--text-primary); font-weight: 700;">${c.code}</span>
          </div>
          <p style="font-size:0.8rem; color:var(--text-secondary);">Students: <strong>${c.studentsCount}</strong></p>
          <p style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">Joined successfully! Let's check assignments.</p>
        `;
        classList.appendChild(card);
      });
    }
  }

  // Render Achievements Badges
  renderStudentAchievements();

  // Render Line Graph
  setTimeout(renderProgressChart, 50);

  // Render student recent history table
  const tbody = document.getElementById('student-history-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:2rem 0;">No quiz history yet. Start a challenge!</td></tr>';
    } else {
      history.forEach(h => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${h.date}</td>
          <td style="text-transform:capitalize; font-weight:700; color:var(--text-primary);">${h.subject}</td>
          <td><span class="user-badge" style="text-transform:capitalize;">${h.difficulty || 'medium'}</span></td>
          <td><strong style="color:var(--primary);">${h.score}</strong></td>
          <td><strong style="color:${h.accuracy >= 70 ? 'var(--success)' : 'var(--danger)'};">${h.accuracy}%</strong></td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  // Also render Student's Assignments list
  renderStudentAssignments();
}

export function renderStudentAssignments() {
  const listContainer = document.getElementById('student-assignments-list');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  const activeAssigns = state.assignments || [];
  if (activeAssigns.length === 0) {
    listContainer.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 2rem; text-align: center; color: var(--text-muted); border: 2px dashed var(--border-color); border-radius: var(--border-radius-md); background:var(--bg-primary);">
        🌴 No active class assignments! Take a break, or start a practice quiz in the "Play Quiz" tab.
      </div>
    `;
    return;
  }

  activeAssigns.forEach(assign => {
    const user = state.currentUser;
    const profile = state.users[user.username];
    const completed = profile && profile.history && profile.history.some(h => h.assignmentId === assign.id);

    const card = document.createElement('div');
    card.className = 'card';
    card.style.background = 'var(--bg-primary)';
    card.style.padding = '1.5rem';
    card.style.borderRadius = 'var(--border-radius-md)';
    card.style.border = '1px solid var(--border-color)';
    card.style.position = 'relative';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <span class="user-badge" style="background:var(--primary-glow); color:var(--primary); font-size:0.75rem; font-weight:700;">${assign.subject}</span>
        <span style="font-size:0.8rem; color:${completed ? 'var(--success)' : 'var(--warning)'}; font-weight:700;">
          ${completed ? '✅ Completed' : '⏱️ Due ' + assign.dueDate}
        </span>
      </div>
      <h3 style="font-size:1.15rem; font-weight:800; margin-bottom:0.5rem; color:var(--text-primary);">${assign.title}</h3>
      <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:1.25rem;">Classroom: ${assign.classroom}</p>
      
      ${completed 
        ? `<button class="btn btn-secondary" disabled style="width:100%; cursor:not-allowed;">Passed Challenge 🎉</button>`
        : `<button class="btn btn-primary start-assign-btn" style="width:100%;">Start Challenge ⚡</button>`
      }
    `;

    if (!completed) {
      card.querySelector('.start-assign-btn').addEventListener('click', () => {
        launchAssignmentQuiz(assign.id);
      });
    }

    listContainer.appendChild(card);
  });
}

export function renderStudentAchievements() {
  const container = document.getElementById('achievements-list');
  if (!container) return;
  container.innerHTML = '';

  const user = state.currentUser;
  if (!user) return;
  const profile = state.users[user.username];
  if (!profile) return;

  const xpVal = profile.xp || 0;
  const streakVal = profile.streak || 0;
  const history = profile.history || [];
  const joinedClassesCount = state.classrooms.filter(c => c.students.some(s => s.name === profile.name)).length;

  const englishQuizCount = history.filter(h => h.subject && (h.subject.toLowerCase() === 'english' || h.subject.toLowerCase() === 'english language')).length;
  const hasPerfectQuiz = history.some(h => h.accuracy === 100);

  const achievements = [
    {
      id: 'math-explorer',
      title: 'Math Explorer',
      icon: '📐',
      unlocked: xpVal >= 200,
      requirement: 'Earn at least 200 XP total to unlock'
    },
    {
      id: 'speed-demon',
      title: 'Speed Demon',
      icon: '⚡',
      unlocked: hasPerfectQuiz,
      requirement: 'Get 100% accuracy on any quiz'
    },
    {
      id: 'daily-warrior',
      title: 'Daily Warrior',
      icon: '🔥',
      unlocked: streakVal >= 3,
      requirement: 'Reach a daily streak of 3 days'
    },
    {
      id: 'english-scholar',
      title: 'English Scholar',
      icon: '📖',
      unlocked: englishQuizCount >= 2,
      requirement: 'Complete 2 English Language quizzes'
    },
    {
      id: 'classroom-hero',
      title: 'Classroom Hero',
      icon: '🏫',
      unlocked: joinedClassesCount >= 1,
      requirement: 'Join at least 1 classroom'
    }
  ];

  achievements.forEach(a => {
    const card = document.createElement('div');
    card.className = 'achievement-card';
    card.style.background = 'var(--bg-secondary)';
    card.style.border = '1px solid var(--border-color)';
    card.style.borderRadius = 'var(--border-radius-sm)';
    card.style.padding = '1.25rem 1rem';
    card.style.textAlign = 'center';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'center';
    card.style.justifyContent = 'center';
    card.style.transition = 'all var(--transition-speed)';
    
    if (!a.unlocked) {
      card.style.filter = 'grayscale(100%) opacity(50%)';
      card.style.borderStyle = 'dashed';
    } else {
      card.style.boxShadow = 'var(--shadow-sm)';
      card.style.borderColor = 'var(--primary)';
    }

    card.innerHTML = `
      <div style="font-size:2.5rem; margin-bottom:0.5rem;">${a.icon}</div>
      <strong style="display:block; font-size:1rem; margin-bottom:0.25rem; color:var(--text-primary);">${a.title}</strong>
      <span style="font-size:0.75rem; color:var(--text-muted); line-height:1.3; min-height:32px; display:flex; align-items:center; justify-content:center;">
        ${a.unlocked ? '<span style="color:var(--success); font-weight:700;">Unlocked! 🎉</span>' : a.requirement}
      </span>
    `;

    container.appendChild(card);
  });
}

export function renderSocialCircle() {
  const tbody = document.getElementById('friends-leaderboard-tbody');
  const feed = document.getElementById('friends-activity-feed');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (feed) feed.innerHTML = '';

  const user = state.currentUser;
  if (!user) return;
  const profile = state.users[user.username];
  if (!profile) return;

  const friendsKeys = profile.friends || [];
  
  const players = [];
  players.push({
    name: `${profile.name} (You)`,
    weeklyXp: profile.xp || 0,
    streak: profile.streak || 0,
    recentMilestone: profile.history && profile.history.length > 0 ? `Completed ${profile.history[0].subject} quiz!` : 'Joined school by nexxbit! 🚀',
    avatar: profile.avatar || '🧒',
    isMe: true
  });

  friendsKeys.forEach(friendUsername => {
    const friendObj = state.users[friendUsername];
    if (friendObj) {
      players.push({
        name: friendObj.name,
        weeklyXp: friendObj.xp || 0,
        streak: friendObj.streak || 0,
        recentMilestone: friendObj.history && friendObj.history.length > 0 ? `Completed ${friendObj.history[0].subject} quiz!` : 'Joined school by nexxbit! 🚀',
        avatar: friendObj.avatar || '🧒',
        isMe: false
      });
    }
  });

  players.sort((a, b) => b.weeklyXp - a.weeklyXp);

  players.forEach((p, index) => {
    const tr = document.createElement('tr');
    if (p.isMe) {
      tr.style.background = 'rgba(99, 102, 241, 0.1)';
      tr.style.fontWeight = '700';
    }

    let medal = `${index + 1}`;
    if (index === 0) medal = '🥇';
    if (index === 1) medal = '🥈';
    if (index === 2) medal = '🥉';

    tr.innerHTML = `
      <td style="font-weight:800; text-align:center;">${medal}</td>
      <td style="font-weight:700; color:var(--text-primary);"><span style="margin-right:0.35rem;">${p.avatar}</span>${p.name}</td>
      <td style="color:var(--warning); font-weight:800;">${p.weeklyXp} XP</td>
      <td style="color:var(--danger); font-weight:700;">🔥 ${p.streak} days</td>
      <td style="font-size:0.8rem; color:var(--text-muted);">${p.recentMilestone}</td>
    `;
    tbody.appendChild(tr);

    if (feed && !p.isMe) {
      const feedItem = document.createElement('div');
      feedItem.className = 'activity-feed-item';
      feedItem.style.background = 'var(--bg-primary)';
      feedItem.style.border = '1px solid var(--border-color)';
      feedItem.style.borderRadius = 'var(--border-radius-sm)';
      feedItem.style.padding = '0.75rem 1rem';
      feedItem.style.display = 'flex';
      feedItem.style.justifyContent = 'space-between';
      feedItem.style.alignItems = 'center';
      feedItem.style.marginBottom = '0.5rem';
      
      feedItem.innerHTML = `
        <div>
          <strong>${p.avatar} ${p.name}</strong>
          <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">${p.recentMilestone}</p>
        </div>
        <div style="display:flex; gap:0.35rem;">
          <button class="btn btn-secondary btn-small reaction-btn" style="padding: 0.25rem 0.5rem;">🔥</button>
          <button class="btn btn-secondary btn-small reaction-btn" style="padding: 0.25rem 0.5rem;">👏</button>
          <button class="btn btn-secondary btn-small reaction-btn" style="padding: 0.25rem 0.5rem;">🙌</button>
        </div>
      `;

      feedItem.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          alert(`You cheered for ${p.name}! 🎉`);
        });
      });

      feed.appendChild(feedItem);
    }
  });

  if (feed && feed.children.length === 0) {
    feed.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:1rem; font-size:0.85rem; font-style:italic;">No recent activities from your friends. Invite them using their friend code!</div>';
  }
}

export function renderTeacherDashboard() {
  const container = document.getElementById('teacher-classrooms-grid');
  const strugglingCard = document.getElementById('teacher-struggling-card');
  const rosterCard = document.getElementById('student-roster-card');
  
  if (!container) return;
  container.innerHTML = '';

  if (state.classrooms.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 2rem; text-align: center; color: var(--text-muted); border: 2px dashed var(--border-color); border-radius: var(--border-radius-md); background:var(--bg-primary);">
        🏫 No classrooms registered yet. Click "Add Classroom" above to create your first class!
      </div>
    `;
    if (strugglingCard) strugglingCard.style.display = 'none';
    if (rosterCard) rosterCard.style.display = 'none';
    return;
  }

  // Ensure activeTeacherClassroomId is set to a valid classroom, defaulting to the first one
  let activeClass = state.classrooms.find(c => c.id === state.activeTeacherClassroomId);
  if (!activeClass) {
    activeClass = state.classrooms[0];
    updateState(draft => {
      draft.activeTeacherClassroomId = activeClass.id;
    });
  }

  // Show secondary cards now that classrooms exist
  if (strugglingCard) strugglingCard.style.display = 'block';
  if (rosterCard) rosterCard.style.display = 'block';

  // Render classroom cards
  state.classrooms.forEach((classroom, index) => {
    const isActive = state.activeTeacherClassroomId === classroom.id;
    const card = document.createElement('div');
    card.className = `card classroom-card ${isActive ? 'active' : ''}`;
    card.style.padding = '1.5rem';
    card.style.borderRadius = 'var(--border-radius-md)';
    card.style.border = isActive ? '2.5px solid var(--primary)' : '1px solid var(--border-color)';
    card.style.background = isActive ? 'var(--primary-glow)' : 'var(--bg-primary)';
    card.style.cursor = 'pointer';
    card.style.boxShadow = isActive ? '0 4px 16px var(--primary-glow)' : 'none';
    card.style.transition = 'all 0.25s ease';
    
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <h3 style="font-weight:800; font-size:1.35rem;">${classroom.name}</h3>
        <span class="user-badge" style="background:var(--bg-secondary); color:var(--primary); font-size:1.1rem; padding:0.5rem 0.85rem; border:1px solid var(--border-color); border-radius:var(--border-radius-sm);">Invite Code: <strong style="font-size:1.2rem; font-family:'Outfit', sans-serif;">${classroom.code}</strong></span>
      </div>
      <div style="display:flex; gap:0.5rem; margin-top:1rem;">
        <button class="btn btn-secondary btn-small edit-class-btn" style="flex:1; padding:0.5rem;">Edit Name ✏️</button>
        <button class="btn btn-danger btn-small delete-class-btn" style="flex:1; padding:0.5rem;">Delete Classroom 🗑️</button>
      </div>
    `;

    // Bind selection event
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn')) return; // ignore buttons
      updateState(draft => {
        draft.activeTeacherClassroomId = classroom.id;
      });
      renderTeacherDashboard();
    });

    // Bind Edit Name
    card.querySelector('.edit-class-btn').addEventListener('click', async () => {
      const newName = prompt('Enter new classroom name:', classroom.name);
      if (newName && newName.trim() !== '') {
        try {
          const { error } = await supabase
            .from('classrooms')
            .update({ name: newName.trim() })
            .eq('id', classroom.id);
          if (error) throw error;

          await syncSession();
          renderTeacherDashboard();
        } catch (err) {
          alert(err.message);
        }
      }
    });

    // Bind Delete Classroom
    card.querySelector('.delete-class-btn').addEventListener('click', () => {
      window.safeConfirm(`Are you sure you want to delete classroom: ${classroom.name}?`, async () => {
        try {
          const { error } = await supabase
            .from('classrooms')
            .delete()
            .eq('id', classroom.id);
          if (error) throw error;

          await syncSession();
          renderTeacherDashboard();
        } catch (err) {
          alert(err.message);
        }
      });
    });

    container.appendChild(card);
  });

  // Update Roster Header
  const rosterHeader = document.getElementById('student-roster-header');
  if (rosterHeader) {
    rosterHeader.textContent = `Student Progress & Tier Status: ${activeClass.name}`;
  }

  // Calculate dynamic struggling areas for active class
  const strugglingDesc = document.getElementById('struggling-desc-text');
  const strugglingTitle = document.getElementById('teacher-struggling-title');
  const strugglingIcon = document.getElementById('teacher-struggling-icon');
  
  if (strugglingDesc && strugglingCard) {
    const students = activeClass.students || [];
    if (students.length === 0) {
      if (strugglingIcon) strugglingIcon.textContent = 'ℹ️';
      if (strugglingTitle) strugglingTitle.textContent = 'Classroom is empty';
      strugglingDesc.innerHTML = `No students enrolled in <strong>${activeClass.name}</strong> yet. Share the invite code <strong>${activeClass.code}</strong> with your students to get started!`;
      strugglingCard.style.borderLeft = '4px solid var(--primary)';
    } else {
      // Aggregate struggling areas across students in this class
      const lowAccuracyTopics = {};
      let totalQuizzes = 0;

      students.forEach(s => {
        const profile = Object.values(state.users).find(u => u.role === 'student' && u.name === s.name);
        if (profile) {
          const history = profile.history || [];
          totalQuizzes += history.length;
          history.forEach(h => {
            if (h.accuracy < 70) {
              const name = h.subject === 'math' ? 'Mathematics (Arithmetic)' : 'English Spelling & Vocabulary';
              lowAccuracyTopics[name] = (lowAccuracyTopics[name] || 0) + 1;
            }
          });
        }
      });

      const struggleEntries = Object.entries(lowAccuracyTopics)
        .sort((a, b) => b[1] - a[1]); // sort descending

      if (totalQuizzes === 0) {
        if (strugglingIcon) strugglingIcon.textContent = '📈';
        if (strugglingTitle) strugglingTitle.textContent = 'No practice data yet';
        strugglingDesc.innerHTML = `Students in <strong>${activeClass.name}</strong> have not completed any quizzes yet. Assign a challenge to gather learning insights!`;
        strugglingCard.style.borderLeft = '4px solid var(--warning)';
      } else if (struggleEntries.length === 0) {
        if (strugglingIcon) strugglingIcon.textContent = '🎉';
        if (strugglingTitle) strugglingTitle.textContent = 'Performing Excellently!';
        strugglingDesc.innerHTML = `All students in <strong>${activeClass.name}</strong> are doing awesome! No struggling areas detected (average accuracy >= 70% for everyone).`;
        strugglingCard.style.borderLeft = '4px solid var(--success)';
      } else {
        if (strugglingIcon) strugglingIcon.textContent = '⚠️';
        if (strugglingTitle) strugglingTitle.textContent = 'Primary Struggling Areas detected!';
        
        const mainStruggle = struggleEntries[0][0];
        const studentCountStr = struggleEntries[0][1] === 1 ? '1 student' : `${struggleEntries[0][1]} students`;
        
        let extraStr = '';
        if (struggleEntries.length > 1) {
          extraStr = `, followed by <strong>${struggleEntries[1][0]}</strong>`;
        }

        strugglingDesc.innerHTML = `In <strong>${activeClass.name}</strong>, ${studentCountStr} struggles with <strong>${mainStruggle}</strong>${extraStr}. Recommendation: Create a targeted classroom assignment.`;
        strugglingCard.style.borderLeft = '4px solid var(--danger)';
      }
    }
  }

  // Populate dynamic Student Progress & Tier Status table (filtered by active class)
  const tbody = document.getElementById('student-roster-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    
    const classStudents = activeClass.students || [];

    if (classStudents.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem 0;">
            No students enrolled yet in this classroom. Share the invite code <strong>${activeClass.code}</strong>!
          </td>
        </tr>
      `;
    } else {
      classStudents.forEach(std => {
        const profile = Object.values(state.users).find(u => u.role === 'student' && u.name === std.name);
        const xpVal = profile ? (profile.xp || 0) : 0;
        const history = profile ? (profile.history || []) : [];
        
        let totalAcc = 0;
        history.forEach(h => totalAcc += h.accuracy);
        const avgAcc = history.length > 0 ? Math.round(totalAcc / history.length) : 100;
        const tier = getTierForXp(xpVal).name;

        const strugglingSet = new Set();
        history.forEach(h => {
          if (h.accuracy < 70) {
            strugglingSet.add(h.subject === 'math' ? 'Math' : 'English');
          }
        });
        const strugglingAreas = strugglingSet.size > 0 ? Array.from(strugglingSet).join(', ') : 'None';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight:700; color:var(--text-primary);">👦 ${std.name}</td>
          <td><strong style="color:${avgAcc >= 70 ? 'var(--success)' : 'var(--danger)'};">${avgAcc}%</strong></td>
          <td>${history.length} Quizzes</td>
          <td><span class="user-badge" style="text-transform:capitalize;">${tier}</span></td>
          <td style="color:${strugglingAreas !== 'None' ? 'var(--danger)' : 'var(--text-muted)'}; font-weight:700;">${strugglingAreas}</td>
          <td>
            <button class="btn btn-danger btn-small remove-student-btn" style="padding:0.25rem 0.5rem;">Remove ❌</button>
          </td>
        `;

        tr.querySelector('.remove-student-btn').addEventListener('click', () => {
          window.safeConfirm(`Are you sure you want to remove ${std.name} from classroom: ${activeClass.name}?`, async () => {
            try {
              // Find the student's profile by name in state
              const studentProfile = Object.values(state.users).find(u => u.role === 'student' && u.name === std.name);
              if (!studentProfile) throw new Error("Student profile not found for " + std.name);

              const { error } = await supabase
                .from('classroom_students')
                .delete()
                .eq('classroom_id', activeClass.id)
                .eq('student_id', studentProfile.id);
              if (error) throw error;

              await syncSession();
              renderTeacherDashboard();
            } catch (err) {
              alert(err.message);
            }
          });
        });

        tbody.appendChild(tr);
      });
    }
  }
}
