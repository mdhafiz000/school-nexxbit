import { state, updateState, apiRequest } from '../state/store.js';

let activeSessions = [];
let mapAnimationId = null;

export function initAdmin() {
  const adminContainer = document.getElementById('admin-dashboard');
  if (!adminContainer) return;

  // Render initial frame
  renderAdminPanel();
  
  // Load data
  loadAdminStats();
  loadUserRoster();
  startActiveSessionsFeed();
}

async function loadAdminStats() {
  try {
    const stats = await apiRequest('/api/admin/stats');
    
    // Update stats counters
    document.getElementById('admin-stat-students').textContent = stats.students;
    document.getElementById('admin-stat-teachers').textContent = stats.teachers;
    document.getElementById('admin-stat-parents').textContent = stats.parents;
    document.getElementById('admin-stat-classes').textContent = stats.classrooms;
    document.getElementById('admin-stat-quizzes').textContent = stats.quizzesCompleted;
    
    // Update new metrics
    document.getElementById('admin-stat-questions-answered').textContent = stats.totalQuestionsAnswered;
    document.getElementById('admin-db-status').textContent = stats.dbStatus;
    document.getElementById('admin-db-latency').textContent = stats.dbLatency;
    document.getElementById('admin-db-type').textContent = stats.dbType;
  } catch (err) {
    console.error("Failed to load admin stats:", err);
  }
}

async function loadUserRoster() {
  try {
    const users = await apiRequest('/api/admin/users');
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    users.forEach(u => {
      const isSelf = u.username === state.currentUser.username;
      
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
      
      tr.innerHTML = `
        <td style="padding: 0.5rem 0.75rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <div>
              <strong style="text-transform: uppercase; font-size: 0.8rem; font-family: monospace; letter-spacing: 0.02em;">${u.name}</strong>
              <span style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace; margin-left: 0.5rem;">@${u.username}</span>
            </div>
          </div>
        </td>
        <td style="padding: 0.5rem 0.75rem;">
          <select class="user-role-select" style="padding: 0.15rem 0.35rem; font-size: 0.75rem; font-family: monospace; background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-bright); border-radius: 2px;" ${isSelf ? 'disabled' : ''}>
            <option value="student" ${u.role === 'student' ? 'selected' : ''}>STUDENT</option>
            <option value="teacher" ${u.role === 'teacher' ? 'selected' : ''}>TEACHER</option>
            <option value="parent" ${u.role === 'parent' ? 'selected' : ''}>PARENT</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>ADMIN</option>
          </select>
        </td>
        <td style="padding: 0.5rem 0.75rem;">
          <span style="font-family: monospace; font-size: 0.75rem; color: var(--text-muted);">${u.xp || 0} XP</span>
        </td>
        <td style="padding: 0.5rem 0.75rem;">
          <span style="border: 1px solid ${u.status === 'active' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}; color: ${u.status === 'active' ? 'var(--success)' : 'var(--danger)'}; padding: 0.1rem 0.4rem; font-size: 0.65rem; font-family: monospace; border-radius: 2px; text-transform: uppercase; font-weight: 700; background: rgba(255,255,255,0.01);">
            ${u.status}
          </span>
        </td>
        <td style="padding: 0.5rem 0.75rem;">
          <div style="display:flex; gap:0.4rem;">
            <button class="btn reset-pw-btn" style="padding: 0.15rem 0.35rem; font-size: 0.7rem; font-family: monospace; border-radius: 2px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); color: var(--text-bright); cursor: pointer;">RESET_PW</button>
            <button class="btn toggle-status-btn" style="padding: 0.15rem 0.35rem; font-size: 0.7rem; font-family: monospace; border-radius: 2px; ${u.status === 'active' ? 'background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: var(--danger);' : 'background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); color: var(--text-bright);'} cursor: pointer;" ${isSelf ? 'disabled' : ''}>
              ${u.status === 'active' ? 'DISABLE' : 'ENABLE'}
            </button>
          </div>
        </td>
      `;

      // Event handlers
      tr.querySelector('.user-role-select').addEventListener('change', async (e) => {
        try {
          await apiRequest('/api/admin/users/update', 'POST', {
            targetUsername: u.username,
            role: e.target.value,
            status: u.status
          });
          loadUserRoster();
          loadAdminStats();
        } catch (err) {
          alert("Failed to update role: " + err.message);
        }
      });

      tr.querySelector('.reset-pw-btn').addEventListener('click', async () => {
        const newPassword = prompt(`Enter new password for ${u.name}:`, 'abcd1234');
        if (newPassword === null) return;
        if (newPassword.trim().length < 8) {
          alert('Password must be at least 8 characters long.');
          return;
        }
        try {
          await apiRequest('/api/admin/users/update', 'POST', {
            targetUsername: u.username,
            newPassword: newPassword.trim()
          });
          alert(`Successfully updated password for ${u.name}!`);
        } catch (err) {
          alert("Failed to reset password: " + err.message);
        }
      });

      tr.querySelector('.toggle-status-btn').addEventListener('click', async () => {
        const nextStatus = u.status === 'active' ? 'disabled' : 'active';
        try {
          await apiRequest('/api/admin/users/update', 'POST', {
            targetUsername: u.username,
            role: u.role,
            status: nextStatus
          });
          loadUserRoster();
          loadAdminStats();
        } catch (err) {
          alert("Failed to update status: " + err.message);
        }
      });

      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load user roster:", err);
  }
}

function startActiveSessionsFeed() {
  const fetchFeed = async () => {
    try {
      activeSessions = await apiRequest('/api/admin/active-sessions');
      updateTickerFeed();
    } catch (err) {
      console.error("Active sessions fetch error:", err);
    }
  };

  fetchFeed();
  const intervalId = setInterval(fetchFeed, 5000);

  // Stop interval on tab change/unload
  document.addEventListener('click', function cleanup(e) {
    if (e.target.closest('.sidebar-btn') && !e.target.closest('#sidebar-btn-admin')) {
      clearInterval(intervalId);
      if (mapAnimationId) cancelAnimationFrame(mapAnimationId);
      document.removeEventListener('click', cleanup);
    }
  });
}

function updateTickerFeed() {
  const list = document.getElementById('admin-live-ticker-list');
  if (!list) return;

  list.innerHTML = '';
  activeSessions.slice(0, 7).forEach(session => {
    const item = document.createElement('div');
    item.style.padding = '0.35rem 0.5rem';
    item.style.background = 'rgba(30, 41, 59, 0.2)';
    item.style.borderRadius = '2px';
    item.style.marginBottom = '0.25rem';
    item.style.fontSize = '0.75rem';
    item.style.fontFamily = 'monospace';
    item.style.borderLeft = session.role === 'student' ? '2px solid var(--success)' : 
                           (session.role === 'teacher' ? '2px solid var(--primary)' : '2px solid var(--warning)');

    item.innerHTML = `
      <span style="color:var(--text-muted); font-size:0.65rem;">[${new Date().toLocaleTimeString()}]</span>
      <span style="font-weight:700;">[${session.role.toUpperCase()}]</span> 
      <span>${session.username} (${session.city})</span> 
      <span style="color:var(--text-muted);">// ${session.activity}</span>
    `;
    list.appendChild(item);
  });
}

export function renderAdminPanel() {
  const adminContainer = document.getElementById('admin-dashboard');
  if (!adminContainer) return;

  adminContainer.innerHTML = `
    <!-- Minimal High-Tech Header -->
    <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1.25rem; display:flex; justify-content:space-between; align-items:flex-end;">
      <div>
        <span style="font-size: 0.65rem; font-family: monospace; color: var(--text-muted); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">ROOT_DIRECTORY // SYS_ADMIN</span>
        <h1 style="font-size: 1.35rem; font-weight: 800; letter-spacing: -0.02em; margin-top: 0.15rem; text-transform: uppercase;">System Administration</h1>
      </div>
      
      <!-- Database Health Panel -->
      <div style="background: rgba(30, 41, 59, 0.25); border: 1px solid var(--border-color); padding: 0.35rem 0.75rem; border-radius: 2px; font-family: monospace; font-size: 0.7rem; text-align: right; line-height:1.4;">
        <div>DB_CONN: <span id="admin-db-status" style="color:var(--success); font-weight:bold;">-</span></div>
        <div>DB_LATENCY: <span id="admin-db-latency" style="color:var(--text-bright);">-</span> // TYPE: <span id="admin-db-type" style="color:var(--text-muted);">-</span></div>
      </div>
    </div>

    <!-- High-Tech Metrics Bar -->
    <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.5rem; margin-bottom: 1.25rem;">
      <div style="background: rgba(30, 41, 59, 0.25); border: 1px solid var(--border-color); border-radius: 2px; padding: 0.5rem 0.75rem; text-align: left;">
        <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.15rem;">STUDENTS</div>
        <div id="admin-stat-students" style="font-size: 1.25rem; font-weight: 800; font-family: monospace; color: var(--success); line-height: 1;">-</div>
      </div>
      <div style="background: rgba(30, 41, 59, 0.25); border: 1px solid var(--border-color); border-radius: 2px; padding: 0.5rem 0.75rem; text-align: left;">
        <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.15rem;">TEACHERS</div>
        <div id="admin-stat-teachers" style="font-size: 1.25rem; font-weight: 800; font-family: monospace; color: var(--primary); line-height: 1;">-</div>
      </div>
      <div style="background: rgba(30, 41, 59, 0.25); border: 1px solid var(--border-color); border-radius: 2px; padding: 0.5rem 0.75rem; text-align: left;">
        <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.15rem;">PARENTS</div>
        <div id="admin-stat-parents" style="font-size: 1.25rem; font-weight: 800; font-family: monospace; color: var(--warning); line-height: 1;">-</div>
      </div>
      <div style="background: rgba(30, 41, 59, 0.25); border: 1px solid var(--border-color); border-radius: 2px; padding: 0.5rem 0.75rem; text-align: left;">
        <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.15rem;">CLASSROOMS</div>
        <div id="admin-stat-classes" style="font-size: 1.25rem; font-weight: 800; font-family: monospace; color: var(--text-bright); line-height: 1;">-</div>
      </div>
      <div style="background: rgba(30, 41, 59, 0.25); border: 1px solid var(--border-color); border-radius: 2px; padding: 0.5rem 0.75rem; text-align: left;">
        <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.15rem;">QUIZZES_TAKEN</div>
        <div id="admin-stat-quizzes" style="font-size: 1.25rem; font-weight: 800; font-family: monospace; color: var(--text-bright); line-height: 1;">-</div>
      </div>
      <div style="background: rgba(30, 41, 59, 0.25); border: 1px solid var(--border-color); border-radius: 2px; padding: 0.5rem 0.75rem; text-align: left;">
        <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.15rem;">ANSWERS_SUBMITTED</div>
        <div id="admin-stat-questions-answered" style="font-size: 1.25rem; font-weight: 800; font-family: monospace; color: var(--text-bright); line-height: 1;">-</div>
      </div>
    </div>

    <!-- Active User Map & Live Ticker split -->
    <div style="display:grid; grid-template-columns: 1.3fr 1fr; gap:0.75rem; margin-bottom: 1.25rem;">
      
      <!-- Malaysia Map Canvas Card -->
      <div class="card" style="display:flex; flex-direction:column; align-items:center; min-height:260px; position:relative; padding: 0.75rem; border-radius:2px;">
        <div style="width:100%; text-align:left; margin-bottom: 0.5rem; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:0.35rem;">
          <span style="font-size:0.75rem; font-weight:800; font-family:monospace; text-transform:uppercase; letter-spacing:0.05em;">SYS_MAP_FEED_MALAYSIA</span>
          <span class="user-badge" style="background:rgba(16,185,129,0.1); color:var(--success); font-family:monospace; font-size:0.65rem; border:1px solid rgba(16,185,129,0.3); padding:0.1rem 0.4rem;">LIVE</span>
        </div>
        <canvas id="malaysia-canvas-map" width="550" height="183" style="background: rgba(15, 23, 42, 0.6); border-radius:2px; border:1px solid var(--border-color); width:100%; max-width:550px;"></canvas>
      </div>

      <!-- Live Activities Ticker List -->
      <div class="card" style="display:flex; flex-direction:column; min-height:260px; padding: 0.75rem; border-radius:2px;">
        <div style="margin-bottom: 0.5rem; border-bottom:1px solid var(--border-color); padding-bottom:0.35rem;">
          <span style="font-size:0.75rem; font-weight:800; font-family:monospace; text-transform:uppercase; letter-spacing:0.05em;">SYS_ACTIVITY_LOG</span>
        </div>
        <div id="admin-live-ticker-list" style="flex:1; overflow-y:auto; max-height:175px; display:flex; flex-direction:column; gap:0.15rem;">
          <div style="text-align:center; padding:2rem 0; color:var(--text-muted); font-size:0.75rem; font-family:monospace;">LISTENING_FOR_EVENTS...</div>
        </div>
      </div>

    </div>

    <!-- User Manager Table Card -->
    <div class="card" style="padding: 0.75rem; border-radius:2px;">
      <div style="margin-bottom:0.75rem; border-bottom:1px solid var(--border-color); padding-bottom:0.35rem; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:0.75rem; font-weight:800; font-family:monospace; text-transform:uppercase; letter-spacing:0.05em;">SYS_USER_ACCOUNTS_MANAGER</span>
        <div style="display:flex; gap:0.5rem; align-items:center;">
          <input type="text" id="admin-roster-search" placeholder="FILTER_USERS..." style="padding:0.2rem 0.4rem; font-size:0.7rem; font-family:monospace; background:var(--bg-primary); border:1px solid var(--border-color); color:var(--text-bright); border-radius:2px; width:150px;" />
        </div>
      </div>
      <div class="table-container" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color);">
              <th style="text-align:left; font-size:0.7rem; font-family:monospace; padding:0.4rem 0.75rem; color:var(--text-muted);">USER_NAME</th>
              <th style="text-align:left; font-size:0.7rem; font-family:monospace; padding:0.4rem 0.75rem; color:var(--text-muted);">SYS_ROLE</th>
              <th style="text-align:left; font-size:0.7rem; font-family:monospace; padding:0.4rem 0.75rem; color:var(--text-muted);">METRIC_SCORE</th>
              <th style="text-align:left; font-size:0.7rem; font-family:monospace; padding:0.4rem 0.75rem; color:var(--text-muted);">STATUS</th>
              <th style="text-align:left; font-size:0.7rem; font-family:monospace; padding:0.4rem 0.75rem; color:var(--text-muted);">ACTIONS</th>
            </tr>
          </thead>
          <tbody id="admin-users-tbody">
            <tr>
              <td colspan="5" style="text-align:center; padding:2rem 0; color:var(--text-muted); font-size:0.75rem; font-family:monospace;">LOADING_ROSTER...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Database Console -->
    <div class="card" style="padding: 0.75rem; border-radius:2px; margin-top:1.25rem;">
      <div style="margin-bottom:0.75rem; border-bottom:1px solid var(--border-color); padding-bottom:0.35rem; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:0.75rem; font-weight:800; font-family:monospace; text-transform:uppercase; letter-spacing:0.05em;">SYS_DATABASE_CONSOLE</span>
        
        <div style="display:flex; gap:0.5rem; align-items:center;">
          <button id="admin-db-backup-btn" class="btn" style="padding:0.25rem 0.5rem; font-size:0.7rem; font-family:monospace; border-radius:2px; background:var(--primary); color:#fff; border:none; cursor:pointer; font-weight:700;">GENERATE_BACKUP</button>
          <button id="admin-db-restore-trigger" class="btn" style="padding:0.25rem 0.5rem; font-size:0.7rem; font-family:monospace; border-radius:2px; background:rgba(255,255,255,0.04); border:1px solid var(--border-color); color:var(--text-bright); cursor:pointer;">RESTORE_BACKUP</button>
          <input type="file" id="admin-db-restore-file" accept=".json" style="display:none;" />
        </div>
      </div>

      <!-- Selected backup summary info -->
      <div id="admin-db-backup-summary" style="display:none; background:rgba(30, 41, 59, 0.4); border:1px dashed var(--border-color); border-radius:2px; padding:0.5rem; margin-bottom:0.75rem; font-family:monospace; font-size:0.75rem;">
        <div style="font-weight:700; color:var(--warning); margin-bottom:0.25rem;">BACKUP_FILE_LOADED // CHOOSE OPERATION:</div>
        <div id="admin-db-backup-meta" style="color:var(--text-muted); margin-bottom:0.4rem;">-</div>
        <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
          <button id="admin-db-restore-full-btn" class="btn" style="background:var(--danger); color:#fff; border:none; padding:0.2rem 0.5rem; font-size:0.7rem; font-family:monospace; border-radius:2px; cursor:pointer; font-weight:700;">RUN_FULL_RESTORE</button>
          <span style="color:var(--text-muted);">or</span>
          <select id="admin-db-restore-user-select" style="padding:0.15rem; font-size:0.7rem; font-family:monospace; background:var(--bg-primary); border:1px solid var(--border-color); color:var(--text-bright); border-radius:2px; max-width:160px;"></select>
          <button id="admin-db-restore-user-btn" class="btn" style="background:var(--primary); color:#fff; border:none; padding:0.2rem 0.5rem; font-size:0.7rem; font-family:monospace; border-radius:2px; cursor:pointer; font-weight:700;">RESTORE_SINGLE_USER</button>
          <button id="admin-db-restore-cancel-btn" class="btn" style="background:rgba(255,255,255,0.04); border:1px solid var(--border-color); color:var(--text-bright); padding:0.2rem 0.5rem; font-size:0.7rem; font-family:monospace; border-radius:2px; cursor:pointer; margin-left:auto;">CANCEL</button>
        </div>
      </div>

      <!-- Live DB Table Inspector Controls -->
      <div style="display:flex; gap:0.5rem; margin-bottom:0.75rem; align-items:center;">
        <select id="admin-db-inspector-table" style="padding:0.25rem; font-size:0.75rem; font-family:monospace; background:var(--bg-primary); border:1px solid var(--border-color); color:var(--text-bright); border-radius:2px; width:180px;">
          <option value="users">TABLE: users</option>
          <option value="classrooms">TABLE: classrooms</option>
          <option value="quiz_history">TABLE: quiz_history</option>
          <option value="classroom_students">TABLE: classroom_students</option>
        </select>
        <input type="text" id="admin-db-inspector-search" placeholder="SEARCH_KEYWORD..." style="flex:1; padding:0.25rem 0.5rem; font-size:0.75rem; font-family:monospace; background:var(--bg-primary); border:1px solid var(--border-color); color:var(--text-bright); border-radius:2px;" />
      </div>

      <!-- Live DB Inspector Scrollable Grid -->
      <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 2px;">
        <table style="width: 100%; border-collapse: collapse; font-family: monospace; font-size: 0.7rem;">
          <thead style="position: sticky; top: 0; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); z-index:1;">
            <tr id="admin-db-inspector-thead-tr">
              <th style="padding: 0.35rem 0.5rem; text-align: left; color: var(--text-muted);">COLUMN</th>
            </tr>
          </thead>
          <tbody id="admin-db-inspector-tbody">
            <tr>
              <td style="padding: 1.5rem; text-align: center; color: var(--text-muted);">SELECT_A_TABLE_TO_QUERY</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // 1. Roster Search/Filter logic
  const rosterSearchInput = document.getElementById('admin-roster-search');
  if (rosterSearchInput) {
    rosterSearchInput.addEventListener('input', () => {
      const q = rosterSearchInput.value.trim().toLowerCase();
      const rows = document.querySelectorAll('#admin-users-tbody tr');
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }

  // 2. Database Inspector logic
  const tableSelect = document.getElementById('admin-db-inspector-table');
  const searchInput = document.getElementById('admin-db-inspector-search');
  
  async function loadTableInspector() {
    const thead = document.getElementById('admin-db-inspector-thead-tr');
    const tbody = document.getElementById('admin-db-inspector-tbody');
    if (!tableSelect || !thead || !tbody) return;

    const table = tableSelect.value;
    const q = searchInput ? searchInput.value.trim() : '';

    tbody.innerHTML = '<tr><td colspan="10" style="padding:1.5rem; text-align:center; color:var(--text-muted);">RUNNING_QUERY...</td></tr>';

    try {
      const res = await apiRequest(`/api/admin/db/tables/${table}?q=${encodeURIComponent(q)}`);
      
      thead.innerHTML = '';
      res.columns.forEach(col => {
        const th = document.createElement('th');
        th.style.padding = '0.35rem 0.5rem';
        th.style.textAlign = 'left';
        th.style.color = 'var(--text-muted)';
        th.style.borderBottom = '1px solid var(--border-color)';
        th.textContent = col.toUpperCase();
        thead.appendChild(th);
      });

      tbody.innerHTML = '';
      if (res.rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${res.columns.length}" style="padding:1.5rem; text-align:center; color:var(--text-muted);">NO_RECORDS_FOUND</td></tr>`;
        return;
      }

      res.rows.forEach(row => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
        res.columns.forEach(col => {
          const td = document.createElement('td');
          td.style.padding = '0.35rem 0.5rem';
          td.style.whiteSpace = 'nowrap';
          td.style.overflow = 'hidden';
          td.style.textOverflow = 'ellipsis';
          td.style.maxWidth = '180px';
          
          let val = row[col];
          if (val === null || val === undefined) val = 'NULL';
          else if (typeof val === 'object') val = JSON.stringify(val);
          
          td.textContent = val;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="10" style="padding:1.5rem; text-align:center; color:var(--danger);">QUERY_FAILED: ${err.message}</td></tr>`;
    }
  }

  if (tableSelect) tableSelect.addEventListener('change', loadTableInspector);
  if (searchInput) searchInput.addEventListener('input', loadTableInspector);

  // Initial table inspector load
  loadTableInspector();

  // 3. Backup Download trigger
  const backupBtn = document.getElementById('admin-db-backup-btn');
  if (backupBtn) {
    backupBtn.addEventListener('click', async () => {
      try {
        backupBtn.textContent = 'BACKING_UP...';
        const res = await apiRequest('/api/admin/db/backup');
        
        // Trigger file download
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `nexxbit_backup_${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        
        backupBtn.textContent = 'GENERATE_BACKUP';
        alert('Database backup JSON generated and downloaded successfully!');
      } catch (err) {
        backupBtn.textContent = 'GENERATE_BACKUP';
        alert('Failed to generate database backup: ' + err.message);
      }
    });
  }

  // 4. Restore hidden input handler
  const restoreTrigger = document.getElementById('admin-db-restore-trigger');
  const restoreFileInput = document.getElementById('admin-db-restore-file');
  const backupSummary = document.getElementById('admin-db-backup-summary');
  const backupMeta = document.getElementById('admin-db-backup-meta');
  const restoreUserSelect = document.getElementById('admin-db-restore-user-select');
  
  let loadedBackupData = null;

  if (restoreTrigger && restoreFileInput) {
    restoreTrigger.addEventListener('click', () => {
      restoreFileInput.click();
    });

    restoreFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        try {
          const data = JSON.parse(evt.target.result);
          if (!data || !data.users) {
            alert('Invalid backup file. Missing users payload.');
            return;
          }

          loadedBackupData = data;
          backupMeta.textContent = `USERS_COUNT: ${data.users.length} // CLASSROOMS_COUNT: ${(data.classrooms || []).length} // QUIZ_RECORDS_COUNT: ${(data.quiz_history || []).length}`;
          
          // Populate restore student dropdown list
          if (restoreUserSelect) {
            restoreUserSelect.innerHTML = '';
            data.users.forEach(u => {
              const opt = document.createElement('option');
              opt.value = u.username;
              opt.textContent = `${u.name.toUpperCase()} (@${u.username})`;
              restoreUserSelect.appendChild(opt);
            });
          }

          backupSummary.style.display = 'block';
        } catch (err) {
          alert('Failed to parse backup file: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  // Restore Cancel trigger
  const restoreCancelBtn = document.getElementById('admin-db-restore-cancel-btn');
  if (restoreCancelBtn) {
    restoreCancelBtn.addEventListener('click', () => {
      loadedBackupData = null;
      if (restoreFileInput) restoreFileInput.value = '';
      if (backupSummary) backupSummary.style.display = 'none';
    });
  }

  // Run Full Restoration
  const restoreFullBtn = document.getElementById('admin-db-restore-full-btn');
  if (restoreFullBtn) {
    restoreFullBtn.addEventListener('click', () => {
      if (!loadedBackupData) return;
      window.safeConfirm(
        "WARNING: Restoring the full database will OVERWRITE all existing classrooms, user profiles, and test records. Are you sure you want to proceed?",
        async () => {
          try {
            restoreFullBtn.textContent = 'RESTORING...';
            const res = await apiRequest('/api/admin/db/restore', 'POST', {
              mode: 'full',
              backupData: loadedBackupData
            });
            alert(res.message || 'Full database successfully restored!');
            
            loadedBackupData = null;
            if (restoreFileInput) restoreFileInput.value = '';
            if (backupSummary) backupSummary.style.display = 'none';
            
            loadAdminStats();
            loadUserRoster();
            loadTableInspector();
          } catch (err) {
            alert('Full restoration failed: ' + err.message);
          } finally {
            restoreFullBtn.textContent = 'RUN_FULL_RESTORE';
          }
        }
      );
    });
  }

  // Run Granular Single User Restoration
  const restoreUserBtn = document.getElementById('admin-db-restore-user-btn');
  if (restoreUserBtn && restoreUserSelect) {
    restoreUserBtn.addEventListener('click', () => {
      const selectedUser = restoreUserSelect.value;
      if (!selectedUser || !loadedBackupData) return;

      window.safeConfirm(
        `Are you sure you want to restore the profile and quiz history for @${selectedUser}? This will overwrite their current profile but keep all other database rows untouched.`,
        async () => {
          try {
            restoreUserBtn.textContent = 'RESTORING...';
            const res = await apiRequest('/api/admin/db/restore', 'POST', {
              mode: 'user',
              backupData: loadedBackupData,
              targetUsername: selectedUser
            });
            alert(res.message || `User @${selectedUser} successfully restored!`);

            loadedBackupData = null;
            if (restoreFileInput) restoreFileInput.value = '';
            if (backupSummary) backupSummary.style.display = 'none';

            loadAdminStats();
            loadUserRoster();
            loadTableInspector();
          } catch (err) {
            alert('User restoration failed: ' + err.message);
          } finally {
            restoreUserBtn.textContent = 'RESTORE_SINGLE_USER';
          }
        }
      );
    });
  }

  // Start Malaysia Canvas Draw Loop
  initMalaysiaCanvasMap();
}
function initMalaysiaCanvasMap() {
  const canvas = document.getElementById('malaysia-canvas-map');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let pulseRadius = 0;

  // Load the custom map image
  const mapImg = new Image();
  mapImg.src = '/public/malaysia-map.png';
  let imageLoaded = false;
  mapImg.onload = () => {
    imageLoaded = true;
  };

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 1. Draw Grid Lines (Futuristic Grid HUD)
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 2. Draw Malaysia map image
    if (imageLoaded) {
      ctx.save();
      // Sleek inversion filter to make the dark map elements light up on the dark background
      ctx.filter = 'invert(1) opacity(0.3)';
      ctx.drawImage(mapImg, 0, 0, w, h);
      ctx.restore();
    }

    // 3. Draw geographical labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = '8px monospace';
    ctx.fillText("WEST_MALAYSIA", w * 0.12, h * 0.65);
    ctx.fillText("EAST_MALAYSIA", w * 0.65, h * 0.65);

    // 4. Draw active sessions pulsing markers
    pulseRadius = (pulseRadius + 0.15) % 12;

    activeSessions.forEach(session => {
      // Map Lat/Lng to 3:1 Map Coordinate Space
      // Lng spans 99.5 to 119.5
      const x = ((session.lng - 99.5) / (119.5 - 99.5)) * w;
      // Lat spans 0.8 to 7.5
      const y = h - ((session.lat - 0.8) / (7.5 - 0.8)) * h;

      // Determine color based on role
      let color = '#10b981'; // Student: Green
      if (session.role === 'teacher') color = '#6366f1'; // Teacher: Indigo
      else if (session.role === 'parent') color = '#f59e0b'; // Parent: Amber
      else if (session.role === 'admin') color = '#ec4899'; // Admin: Pink

      // Draw pulse circle
      ctx.beginPath();
      ctx.arc(x, y, pulseRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw center dot
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Draw city/user details label (crisp monospaced text)
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 8px monospace';
      ctx.fillText(session.name.toUpperCase(), x + 8, y - 2);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '600 7px monospace';
      ctx.fillText(session.city.toUpperCase(), x + 8, y + 6);
    });

    mapAnimationId = requestAnimationFrame(draw);
  }

  draw();
}
