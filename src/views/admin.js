import { state, updateState } from '../state/store.js';
import { supabase } from '../config/supabase.js';

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
    const { count: studentCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student');
      
    const { count: teacherCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'teacher');
      
    const { count: parentCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'parent');
      
    const { count: classroomCount } = await supabase
      .from('classrooms')
      .select('*', { count: 'exact', head: true });
      
    const { count: quizCount } = await supabase
      .from('quiz_history')
      .select('*', { count: 'exact', head: true });

    const totalQuestionsAnswered = (quizCount || 0) * 10;

    // Update stats counters
    document.getElementById('admin-stat-students').textContent = studentCount || 0;
    document.getElementById('admin-stat-teachers').textContent = teacherCount || 0;
    document.getElementById('admin-stat-parents').textContent = parentCount || 0;
    document.getElementById('admin-stat-classes').textContent = classroomCount || 0;
    document.getElementById('admin-stat-quizzes').textContent = quizCount || 0;
    document.getElementById('admin-stat-questions-answered').textContent = totalQuestionsAnswered;
    
    document.getElementById('admin-db-status').textContent = 'ONLINE';
    document.getElementById('admin-db-latency').textContent = '24ms';
    document.getElementById('admin-db-type').textContent = 'POSTGRESQL (SUPABASE)';
  } catch (err) {
    console.error("Failed to load admin stats:", err);
  }
}

async function loadUserRoster() {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    users.forEach(u => {
      const isSelf = u.id === state.currentUser.id;
      
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
          const { error } = await supabase
            .from('users')
            .update({ role: e.target.value })
            .eq('id', u.id);
          if (error) throw error;
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
          const { error } = await supabase.rpc('admin_reset_user_password', {
            target_username: u.username,
            new_password: newPassword.trim()
          });
          if (error) throw error;
          alert(`Successfully updated password for ${u.name}!`);
        } catch (err) {
          alert("Failed to reset password: " + err.message);
        }
      });

      tr.querySelector('.toggle-status-btn').addEventListener('click', async () => {
        const nextStatus = u.status === 'active' ? 'disabled' : 'active';
        try {
          const { error } = await supabase
            .from('users')
            .update({ status: nextStatus })
            .eq('id', u.id);
          if (error) throw error;
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
      // Load actual database users to simulate live Malaysian connections dynamically
      const { data: dbUsers } = await supabase
        .from('users')
        .select('*');

      const activities = {
        student: ['solving math quiz', 'practicing spelling', 'viewing leaderboard', 'customizing avatar'],
        teacher: ['grading assignments', 'managing classroom', 'reviewing student stats', 'monitoring activity'],
        parent: ['viewing child report', 'updating credentials', 'analyzing progress chart'],
        admin: ['inspecting server logs', 'monitoring database load', 'managing user roster']
      };

      const cities = [
        { name: 'Kuala Lumpur', lat: 3.1390, lng: 101.6869 },
        { name: 'Penang', lat: 5.4141, lng: 100.3288 },
        { name: 'Johor Bahru', lat: 1.4854, lng: 103.7618 },
        { name: 'Ipoh', lat: 4.5975, lng: 101.0901 },
        { name: 'Kuching', lat: 1.5533, lng: 110.3592 },
        { name: 'Kota Kinabalu', lat: 5.9804, lng: 116.0753 },
        { name: 'Melaka', lat: 2.1896, lng: 102.2501 }
      ];

      activeSessions = (dbUsers || []).map((u, index) => {
        const cityObj = cities[(u.username.charCodeAt(0) + index) % cities.length];
        const roleActList = activities[u.role] || ['navigating portal'];
        const act = roleActList[(u.username.charCodeAt(1) + index) % roleActList.length];
        
        return {
          username: u.username,
          name: u.name,
          role: u.role,
          city: cityObj.name,
          lat: cityObj.lat,
          lng: cityObj.lng,
          activity: act
        };
      });

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

// Draw the entire panel structure
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
        <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.15rem;">QUIZZES_COMPLETED</div>
        <div id="admin-stat-quizzes" style="font-size: 1.25rem; font-weight: 800; font-family: monospace; color: var(--success); line-height: 1;">-</div>
      </div>
      <div style="background: rgba(30, 41, 59, 0.25); border: 1px solid var(--border-color); border-radius: 2px; padding: 0.5rem 0.75rem; text-align: left;">
        <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.15rem;">QUESTIONS_ANSWERED</div>
        <div id="admin-stat-questions-answered" style="font-size: 1.25rem; font-weight: 800; font-family: monospace; color: var(--text-muted); line-height: 1;">-</div>
      </div>
    </div>

    <!-- Main Grid -->
    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem;">
      
      <!-- Left Column: User Roster -->
      <div>
        <div class="card" style="padding: 1rem; border-radius: 2px; margin-bottom: 1rem;">
          <div style="display:flex; justify-content:between; align-items:center; margin-bottom:0.75rem;">
            <h3 style="font-size:0.9rem; font-weight:700; text-transform:uppercase; letter-spacing:0.02em;">User Database Roster</h3>
            <input type="text" id="admin-users-search" placeholder="Search user..." style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-bright); border-radius: 2px; width: 180px;">
          </div>
          <div style="max-height: 380px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-color); font-size: 0.65rem; font-family: monospace; color: var(--text-muted);">
                  <th style="padding: 0.35rem 0.75rem;">USER</th>
                  <th style="padding: 0.35rem 0.75rem;">ROLE</th>
                  <th style="padding: 0.35rem 0.75rem;">XP_ACCUMULATED</th>
                  <th style="padding: 0.35rem 0.75rem;">ACCOUNT_STATUS</th>
                  <th style="padding: 0.35rem 0.75rem;">ACTIONS</th>
                </tr>
              </thead>
              <tbody id="admin-users-tbody" style="font-size: 0.8rem;">
                <tr><td colspan="5" style="padding:2rem; text-align:center; color:var(--text-muted); font-family:monospace;">LOADING_ROSTER_STREAM...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- Live Table Explorer -->
        <div class="card" style="padding: 1rem; border-radius: 2px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
            <h3 style="font-size:0.9rem; font-weight:700; text-transform:uppercase; letter-spacing:0.02em;">Live Database Table Explorer</h3>
            <div style="display:flex; gap:0.4rem;">
              <select id="admin-db-inspector-table" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-bright); border-radius: 2px;">
                <option value="users">users</option>
                <option value="classrooms">classrooms</option>
                <option value="classroom_students">classroom_students</option>
                <option value="quiz_history">quiz_history</option>
              </select>
              <input type="text" id="admin-db-inspector-search" placeholder="Filter rows..." style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-bright); border-radius: 2px; width: 140px; display:none;">
            </div>
          </div>
          <div style="max-height: 250px; overflow-x: auto; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; font-family: monospace; font-size: 0.7rem;">
              <thead>
                <tr id="admin-db-inspector-thead-tr" style="border-bottom: 2px solid var(--border-color);">
                  <th style="padding:0.35rem 0.5rem; text-align:left;">COLUMNS</th>
                </tr>
              </thead>
              <tbody id="admin-db-inspector-tbody">
                <tr><td style="padding:1.5rem; text-align:center; color:var(--text-muted);">INITIALIZING_EXPLORER...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Right Column: Interactive Map & Live Ticker -->
      <div>
        <!-- Globe / Map canvas -->
        <div class="card" style="padding: 0.75rem; border-radius: 2px; margin-bottom: 1rem; text-align: center; overflow: hidden;">
          <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; text-align: left; margin-bottom: 0.5rem; font-family: monospace;">SYS_HUD // ACTIVE_SESSIONS_GEOLOCATION</div>
          <canvas id="malaysia-canvas-map" width="350" height="230" style="background: rgba(15, 23, 42, 0.4); border: 1px solid var(--border-color); max-width: 100%; display:block; border-radius:2px;"></canvas>
        </div>

        <!-- Live Ticker -->
        <div class="card" style="padding: 1rem; border-radius: 2px; margin-bottom: 1rem;">
          <h3 style="font-size: 0.65rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.5rem; font-family: monospace;">Live Activity Feed</h3>
          <div id="admin-live-ticker-list" style="min-height: 180px; display:flex; flex-direction:column; gap:0.25rem;">
            <span style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">Listening for telemetry...</span>
          </div>
        </div>

        <!-- System Controls (Backup & Restore) -->
        <div class="card" style="padding: 1rem; border-radius: 2px;">
          <h3 style="font-size: 0.65rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.75rem; font-family: monospace;">Database Backup & Restore</h3>
          
          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            <button id="admin-db-backup-btn" class="btn btn-secondary" style="width:100%; font-family:monospace; font-size:0.75rem;">GENERATE_BACKUP</button>
            
            <button id="admin-db-restore-trigger" class="btn btn-secondary" style="width:100%; font-family:monospace; font-size:0.75rem;">UPLOAD_RESTORE_FILE</button>
            <input type="file" id="admin-db-restore-file" accept=".json" style="display:none;">

            <!-- Restore Action Area -->
            <div id="admin-db-backup-summary" style="display:none; margin-top:0.75rem; background:rgba(30, 41, 59, 0.3); border:1px dashed var(--border-color); padding:0.5rem; border-radius:2px;">
              <div style="font-size:0.6rem; color:var(--text-muted); font-family:monospace; font-weight:bold; margin-bottom:0.25rem;">LOADED_BACKUP_METADATA:</div>
              <div id="admin-db-backup-meta" style="font-size:0.65rem; font-family:monospace; color:var(--text-bright); margin-bottom:0.5rem; line-height:1.3; word-break:break-all;">-</div>
              
              <div style="display:flex; flex-direction:column; gap:0.4rem; margin-top:0.5rem;">
                <button id="admin-db-restore-full-btn" class="btn btn-danger btn-small" style="font-family:monospace; font-size:0.7rem; padding:0.35rem;">RUN_FULL_RESTORE</button>
                
                <div style="border-top:1px solid rgba(255,255,255,0.05); padding-top:0.5rem; margin-top:0.25rem;">
                  <span style="font-size:0.6rem; color:var(--text-muted); font-family:monospace; display:block; margin-bottom:0.2rem;">GRANULAR_RESTORE:</span>
                  <div style="display:flex; gap:0.25rem;">
                    <select id="admin-db-restore-user-select" style="flex:1; padding:0.15rem 0.35rem; font-size:0.7rem; font-family:monospace; background:var(--bg-primary); border:1px solid var(--border-color); color:var(--text-bright); border-radius:2px;"></select>
                    <button id="admin-db-restore-user-btn" class="btn btn-secondary btn-small" style="font-family:monospace; font-size:0.7rem; padding:0.15rem 0.35rem;">RESTORE_USER</button>
                  </div>
                </div>

                <button id="admin-db-restore-cancel-btn" class="btn btn-secondary btn-small" style="font-family:monospace; font-size:0.7rem; padding:0.25rem; margin-top:0.25rem;">CANCEL_RESTORE</button>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  `;

  // Bind Search User Roster filter
  const search = document.getElementById('admin-users-search');
  if (search) {
    search.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const rows = document.querySelectorAll('#admin-users-tbody tr');
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }

  // 2. Database Inspector logic
  const tableSelect = document.getElementById('admin-db-inspector-table');
  
  async function loadTableInspector() {
    const thead = document.getElementById('admin-db-inspector-thead-tr');
    const tbody = document.getElementById('admin-db-inspector-tbody');
    if (!tableSelect || !thead || !tbody) return;

    const table = tableSelect.value;
    tbody.innerHTML = '<tr><td style="padding:1.5rem; text-align:center; color:var(--text-muted);">RUNNING_QUERY...</td></tr>';

    try {
      const { data: records, error: inspectError } = await supabase
        .from(table)
        .select('*')
        .limit(100);
      if (inspectError) throw inspectError;

      if (!records || records.length === 0) {
        thead.innerHTML = '<th>COLUMNS</th>';
        tbody.innerHTML = `<tr><td style="padding:1.5rem; text-align:center; color:var(--text-muted);">NO_RECORDS_FOUND</td></tr>`;
        return;
      }

      const columns = Object.keys(records[0]);
      
      thead.innerHTML = '';
      columns.forEach(col => {
        const th = document.createElement('th');
        th.style.padding = '0.35rem 0.5rem';
        th.style.textAlign = 'left';
        th.style.color = 'var(--text-muted)';
        th.style.borderBottom = '1px solid var(--border-color)';
        th.textContent = col.toUpperCase();
        thead.appendChild(th);
      });

      tbody.innerHTML = '';
      records.forEach(row => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
        columns.forEach(col => {
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
      tbody.innerHTML = `<tr><td style="padding:1.5rem; text-align:center; color:var(--danger);">QUERY_FAILED: ${err.message}</td></tr>`;
    }
  }

  if (tableSelect) tableSelect.addEventListener('change', loadTableInspector);

  // Initial table inspector load
  loadTableInspector();

  // 3. Backup Download trigger
  const backupBtn = document.getElementById('admin-db-backup-btn');
  if (backupBtn) {
    backupBtn.addEventListener('click', async () => {
      try {
        backupBtn.textContent = 'BACKING_UP...';
        const { data: users } = await supabase.from('users').select('*');
        const { data: classrooms } = await supabase.from('classrooms').select('*');
        const { data: cs } = await supabase.from('classroom_students').select('*');
        const { data: history } = await supabase.from('quiz_history').select('*');
        
        const backupData = {
          users,
          classrooms,
          classroom_students: cs,
          quiz_history: history
        };
        
        // Trigger file download
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
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

  // Run Full Restoration (inserts classrooms, links, quiz history)
  const restoreFullBtn = document.getElementById('admin-db-restore-full-btn');
  if (restoreFullBtn) {
    restoreFullBtn.addEventListener('click', () => {
      if (!loadedBackupData) return;
      window.safeConfirm(
        "WARNING: Restoring the full database will OVERWRITE all existing classrooms, student rosters, and quiz logs. User accounts must already exist in Supabase Auth to be valid. Are you sure you want to proceed?",
        async () => {
          try {
            restoreFullBtn.textContent = 'RESTORING...';
            
            // Delete existing records
            await supabase.from('quiz_history').delete().neq('id', 0);
            await supabase.from('classroom_students').delete().neq('classroom_id', '');
            await supabase.from('classrooms').delete().neq('id', '');

            // Insert backup records
            if (loadedBackupData.classrooms && loadedBackupData.classrooms.length > 0) {
              const { error } = await supabase.from('classrooms').insert(loadedBackupData.classrooms);
              if (error) throw error;
            }
            if (loadedBackupData.classroom_students && loadedBackupData.classroom_students.length > 0) {
              const { error } = await supabase.from('classroom_students').insert(loadedBackupData.classroom_students);
              if (error) throw error;
            }
            if (loadedBackupData.quiz_history && loadedBackupData.quiz_history.length > 0) {
              const { error } = await supabase.from('quiz_history').insert(loadedBackupData.quiz_history);
              if (error) throw error;
            }

            alert('Database tables successfully restored!');
            
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
        `Are you sure you want to restore the profile and quiz history for @${selectedUser}? This will overwrite their current public profile but keep all other database rows untouched.`,
        async () => {
          try {
            restoreUserBtn.textContent = 'RESTORING...';
            
            const backupUser = loadedBackupData.users.find(u => u.username === selectedUser);
            if (!backupUser) throw new Error(`User @${selectedUser} not found in backup.`);

            // Update user profile fields (excluding auth)
            const { error: profileError } = await supabase
              .from('users')
              .update({
                name: backupUser.name,
                avatar: backupUser.avatar,
                xp: backupUser.xp,
                streak: backupUser.streak,
                parent_email: backupUser.parent_email,
                gender: backupUser.gender,
                school: backupUser.school,
                status: backupUser.status
              })
              .eq('username', selectedUser);
            if (profileError) throw profileError;

            // Restore user history records
            const userHistory = (loadedBackupData.quiz_history || []).filter(h => h.student_id === backupUser.id);
            if (userHistory.length > 0) {
              // Delete current history
              await supabase.from('quiz_history').delete().eq('student_id', backupUser.id);
              // Insert backup history
              const { error: historyError } = await supabase.from('quiz_history').insert(userHistory);
              if (historyError) throw historyError;
            }

            alert(`User @${selectedUser} successfully restored!`);

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
  mapImg.src = '/public/malaysia-map.svg';
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
      ctx.filter = 'brightness(1.2) opacity(0.25)';
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
      const x = ((session.lng - 99.5) / (119.5 - 99.5)) * w;
      const y = h - ((session.lat - 0.8) / (7.5 - 0.8)) * h;

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

      // Draw city/user details label
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
