import express from 'express';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import geoip from 'geoip-lite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'nexxbit_secret_key_12345';
const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;
let useFallbackDb = false;
const FALLBACK_DB_FILE = path.join(__dirname, 'db_fallback.json');

// Initialize Fallback DB with seed data if file doesn't exist
function initFallbackDb() {
  const hashedPass = bcrypt.hashSync('abcd1234', 10);
  const hashedAdminPass = bcrypt.hashSync('#UjangVeelai00#', 10);

  if (!fs.existsSync(FALLBACK_DB_FILE)) {
    const initialData = {
      users: {
        'eilhan': { username: 'eilhan', password_hash: hashedPass, role: 'student', name: 'Eilhan', avatar: '🧒', xp: 0, streak: 0, parent_email: 'hafiz@example.com', gender: 'male', friend_code: 'EIL123', friends: [], status: 'active', email: null },
        'ellysha': { username: 'ellysha', password_hash: hashedPass, role: 'student', name: 'Ellysha', avatar: '👧', xp: 0, streak: 0, parent_email: 'hafiz@example.com', gender: 'female', friend_code: 'ELL456', friends: [], status: 'active', email: null },
        'hafiz': { username: 'hafiz', password_hash: hashedPass, role: 'parent', name: 'Hafiz', avatar: '👨', parent_role: 'father', friend_code: 'HAF789', friends: [], status: 'active', email: 'hafiz@example.com' },
        'veelai': { username: 'veelai', password_hash: hashedPass, role: 'teacher', name: 'Veelai', avatar: '👩‍🏫', friend_code: 'VEE012', friends: [], status: 'active', email: 'veelai@example.com' },
        'admin': { username: 'admin', password_hash: hashedAdminPass, role: 'admin', name: 'Admin', avatar: '⚙️', friend_code: 'ADM999', friends: [], status: 'active', email: 'mohar.studio@gmail.com' }
      },
      classrooms: {},
      classroom_students: [],
      quiz_history: []
    };
    fs.writeFileSync(FALLBACK_DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  } else {
    // Migration: Update admin account credentials dynamically if outdated
    try {
      const content = fs.readFileSync(FALLBACK_DB_FILE, 'utf8');
      const data = JSON.parse(content);
      let updated = false;

      if (data.users) {
        if (!data.users['admin']) {
          data.users['admin'] = { username: 'admin', password_hash: hashedAdminPass, role: 'admin', name: 'Admin', avatar: '⚙️', friend_code: 'ADM999', friends: [], status: 'active', email: 'mohar.studio@gmail.com' };
          updated = true;
        } else {
          const admin = data.users['admin'];
          if (admin.email !== 'mohar.studio@gmail.com' || admin.password_hash !== hashedAdminPass) {
            console.log("Upgrading fallback database admin account credentials...");
            admin.email = 'mohar.studio@gmail.com';
            admin.password_hash = hashedAdminPass;
            updated = true;
          }
        }

        // Ensure all users have email property
        Object.values(data.users).forEach(u => {
          if (u.email === undefined) {
            u.email = u.role === 'admin' ? 'mohar.studio@gmail.com' : (u.role === 'parent' ? `${u.username}@example.com` : null);
            updated = true;
          }
        });
      }

      if (updated) {
        fs.writeFileSync(FALLBACK_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
      }
    } catch (e) {
      console.error("Failed to migrate fallback database:", e);
    }
  }
}

// Read Fallback JSON Data
function readFallbackData() {
  initFallbackDb();
  try {
    const content = fs.readFileSync(FALLBACK_DB_FILE, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error("Error reading fallback JSON database:", err);
    return { users: {}, classrooms: {}, classroom_students: [], quiz_history: [] };
  }
}

// Write Fallback JSON Data
function writeFallbackData(data) {
  try {
    fs.writeFileSync(FALLBACK_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Error writing to fallback JSON database:", err);
  }
}

// Setup DB pool or fallback mode
if (DATABASE_URL) {
  console.log("DATABASE_URL found. Running in PostgreSQL mode.");
  const { Pool } = pg;
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') ? false : {
      rejectUnauthorized: false
    }
  });

  // Run schema auto-migration
  async function initDb() {
    try {
      const client = await pool.connect();
      console.log("Connected to PostgreSQL successfully.");
      
      const schemaPath = path.join(__dirname, 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await client.query(schemaSql);
        
        // Auto-migration: ensure users table has status and email columns
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
        `);
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE
        `);
        
        console.log("Database schema verified/created successfully.");
      }

      // Seed if empty
      const userCountRes = await client.query("SELECT COUNT(*) FROM users");
      const hashedPass = await bcrypt.hash('abcd1234', 10);
      const hashedAdminPass = await bcrypt.hash('#UjangVeelai00#', 10);

      if (parseInt(userCountRes.rows[0].count) === 0) {
        console.log("Database is empty. Seeding default demo accounts...");
        const seedUsers = [
          { username: 'eilhan', password_hash: hashedPass, role: 'student', name: 'Eilhan', avatar: '🧒', xp: 0, streak: 0, parent_email: 'hafiz@example.com', gender: 'male', friend_code: 'EIL123', email: null },
          { username: 'ellysha', password_hash: hashedPass, role: 'student', name: 'Ellysha', avatar: '👧', xp: 0, streak: 0, parent_email: 'hafiz@example.com', gender: 'female', friend_code: 'ELL456', email: null },
          { username: 'hafiz', password_hash: hashedPass, role: 'parent', name: 'Hafiz', avatar: '👨', parent_role: 'father', friend_code: 'HAF789', email: 'hafiz@example.com' },
          { username: 'veelai', password_hash: hashedPass, role: 'teacher', name: 'Veelai', avatar: '👩‍🏫', friend_code: 'VEE012', email: 'veelai@example.com' },
          { username: 'admin', password_hash: hashedAdminPass, role: 'admin', name: 'Admin', avatar: '⚙️', friend_code: 'ADM999', email: 'mohar.studio@gmail.com' }
        ];

        for (const u of seedUsers) {
          await client.query(
            `INSERT INTO users (username, password_hash, role, name, avatar, xp, streak, parent_email, gender, parent_role, friend_code, email)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [u.username, u.password_hash, u.role, u.name, u.avatar, u.xp, u.streak, u.parent_email, u.gender, u.parent_role, u.friend_code, u.email]
          );
        }
      } else {
        // Migration: Ensure admin user has the latest email/password
        console.log("Ensuring admin user credentials are up to date...");
        await client.query(
          `INSERT INTO users (username, password_hash, role, name, avatar, friend_code, email, status)
           VALUES ('admin', $1, 'admin', 'Admin', '⚙️', 'ADM999', 'mohar.studio@gmail.com', 'active')
           ON CONFLICT (username) DO UPDATE 
           SET password_hash = $1, email = 'mohar.studio@gmail.com'`,
          [hashedAdminPass]
        );
      }
      client.release();
    } catch (err) {
      console.error("Database initialization failed:", err);
    }
  }
  initDb();
} else {
  console.log("DATABASE_URL not found. Running in Local Fallback Mode (using db_fallback.json)...");
  useFallbackDb = true;
  initFallbackDb();
}

// SQL Query Router / Simulator (for fallback offline mode)
async function executeQuery(sql, params = []) {
  if (!useFallbackDb) {
    return pool.query(sql, params);
  }

  // JSON DB Simulator
  const data = readFallbackData();
  const sqlNormalized = sql.replace(/\s+/g, ' ').trim();

  // 0. Diagnostic queries
  if (sqlNormalized === "SELECT 1") {
    return { rows: [{ '?column?': 1 }] };
  }
  if (sqlNormalized.startsWith("SELECT score FROM quiz_history")) {
    const rows = (data.quiz_history || []).map(qh => ({ score: qh.score }));
    return { rows };
  }

  // 1. SELECT COUNT(*) FROM users
  if (sqlNormalized.startsWith("SELECT COUNT(*) FROM users")) {
    return { rows: [{ count: Object.keys(data.users).length }] };
  }

  // 2. SELECT username FROM users WHERE username = $1
  if (sqlNormalized.startsWith("SELECT username FROM users WHERE username = $1")) {
    const usr = params[0].toLowerCase();
    const rows = data.users[usr] ? [{ username: usr }] : [];
    return { rows };
  }

  // 3. SELECT * FROM users WHERE username = $1 OR email = $1
  if (sqlNormalized.startsWith("SELECT * FROM users WHERE username = $1 OR email = $1")) {
    const key = params[0].toLowerCase();
    let user = data.users[key];
    if (!user) {
      user = Object.values(data.users).find(u => u.email && u.email.toLowerCase() === key);
    }
    const rows = user ? [user] : [];
    return { rows };
  }

  // 3b. SELECT * FROM users WHERE username = $1
  if (sqlNormalized.startsWith("SELECT * FROM users WHERE username = $1")) {
    const usr = params[0].toLowerCase();
    const rows = data.users[usr] ? [data.users[usr]] : [];
    return { rows };
  }

  // 4. INSERT INTO users ...
  if (sqlNormalized.startsWith("INSERT INTO users")) {
    const username = params[0].toLowerCase();
    let uObj = {};
    if (params.length >= 12) {
      const [uname, password_hash, role, name, avatar, xp, streak, parent_email, gender, parent_role, friend_code, email] = params;
      uObj = {
        username: uname.toLowerCase(), password_hash, role, name, avatar, xp: xp || 0, streak: streak || 0,
        parent_email: parent_email || null, gender: gender || null, parent_role: parent_role || null,
        friend_code, email: email || null, friends: [], status: 'active'
      };
    } else {
      const [uname, password_hash, role, name, avatar, parent_email, gender, school, parent_role, friend_code, email] = params;
      uObj = {
        username: uname.toLowerCase(), password_hash, role, name, avatar, xp: 0, streak: 0,
        parent_email: parent_email || null, gender: gender || null, school: school || null,
        parent_role: parent_role || null, friend_code, email: email || null, friends: [], status: 'active'
      };
    }
    data.users[username] = uObj;
    writeFallbackData(data);
    return { rows: [] };
  }

  // 5. UPDATE users SET xp = xp + $1, streak = streak + 1 WHERE username = $2
  if (sqlNormalized.startsWith("UPDATE users SET xp = xp + $1, streak = streak + 1 WHERE username = $2")) {
    const [xpVal, username] = params;
    const user = data.users[username.toLowerCase()];
    if (user) {
      user.xp = (user.xp || 0) + xpVal;
      user.streak = (user.streak || 0) + 1;
      writeFallbackData(data);
    }
    return { rows: [] };
  }

  // 6. UPDATE users SET friends = array_append(friends, $1) WHERE username = $2
  if (sqlNormalized.startsWith("UPDATE users SET friends = array_append(friends, $1) WHERE username = $2")) {
    const [friendUsername, myUsername] = params;
    const me = data.users[myUsername.toLowerCase()];
    if (me) {
      if (!me.friends) me.friends = [];
      me.friends.push(friendUsername.toLowerCase());
      writeFallbackData(data);
    }
    return { rows: [] };
  }

  // 7. SELECT friends FROM users WHERE username = $1
  if (sqlNormalized.startsWith("SELECT friends FROM users WHERE username = $1")) {
    const usr = data.users[params[0].toLowerCase()];
    return { rows: [{ friends: usr ? usr.friends || [] : [] }] };
  }

  // 8. SELECT username, name, avatar, xp, streak FROM users WHERE username = ANY($1)
  if (sqlNormalized.startsWith("SELECT username, name, avatar, xp, streak FROM users WHERE username = ANY($1)")) {
    const usernames = params[0] || [];
    const rows = usernames.map(u => data.users[u.toLowerCase()]).filter(Boolean).map(u => ({
      username: u.username, name: u.name, avatar: u.avatar, xp: u.xp, streak: u.streak
    }));
    return { rows };
  }

  // 9. SELECT * FROM classrooms WHERE teacher_username = $1
  if (sqlNormalized.startsWith("SELECT * FROM classrooms WHERE teacher_username = $1")) {
    const teacher = params[0].toLowerCase();
    const rows = Object.values(data.classrooms).filter(c => c.teacher_username === teacher);
    return { rows };
  }

  // 10. SELECT c.* FROM classrooms c JOIN classroom_students cs ON c.id = cs.classroom_id WHERE cs.student_username = $1
  if (sqlNormalized.startsWith("SELECT c.* FROM classrooms c JOIN classroom_students cs")) {
    const student = params[0].toLowerCase();
    const joinedIds = data.classroom_students.filter(cs => cs.student_username === student).map(cs => cs.classroom_id);
    const rows = joinedIds.map(id => data.classrooms[id]).filter(Boolean);
    return { rows };
  }

  // 11. SELECT COUNT(*) FROM classroom_students WHERE classroom_id = $1
  if (sqlNormalized.startsWith("SELECT COUNT(*) FROM classroom_students WHERE classroom_id = $1")) {
    const classId = params[0];
    const count = data.classroom_students.filter(cs => cs.classroom_id === classId).length;
    return { rows: [{ count }] };
  }

  // 12. SELECT u.name, u.xp, u.username FROM users u JOIN classroom_students cs ON u.username = cs.student_username WHERE cs.classroom_id = $1
  if (sqlNormalized.startsWith("SELECT u.name, u.xp, u.username FROM users u JOIN classroom_students cs")) {
    const classId = params[0];
    const studentUsernames = data.classroom_students.filter(cs => cs.classroom_id === classId).map(cs => cs.student_username);
    const rows = studentUsernames.map(u => data.users[u]).filter(Boolean).map(u => ({
      name: u.name, xp: u.xp, username: u.username
    }));
    return { rows };
  }

  // 13. INSERT INTO classrooms (id, name, code, teacher_username) VALUES ($1, $2, $3, $4)
  if (sqlNormalized.startsWith("INSERT INTO classrooms")) {
    const [id, name, code, teacher_username] = params;
    data.classrooms[id] = { id, name, code, teacher_username };
    writeFallbackData(data);
    return { rows: [] };
  }

  // 14. SELECT * FROM classrooms WHERE UPPER(code) = $1
  if (sqlNormalized.startsWith("SELECT * FROM classrooms WHERE UPPER(code) = $1")) {
    const code = params[0].toUpperCase();
    const rows = Object.values(data.classrooms).filter(c => c.code.toUpperCase() === code);
    return { rows };
  }

  // 15. SELECT * FROM classroom_students WHERE classroom_id = $1 AND student_username = $2
  if (sqlNormalized.startsWith("SELECT * FROM classroom_students WHERE classroom_id = $1 AND student_username = $2")) {
    const [classId, student] = params;
    const rows = data.classroom_students.filter(cs => cs.classroom_id === classId && cs.student_username === student.toLowerCase());
    return { rows };
  }

  // 16. INSERT INTO classroom_students (classroom_id, student_username) VALUES ($1, $2)
  if (sqlNormalized.startsWith("INSERT INTO classroom_students")) {
    const [classroom_id, student_username] = params;
    data.classroom_students.push({ classroom_id, student_username: student_username.toLowerCase() });
    writeFallbackData(data);
    return { rows: [] };
  }

  // 17. DELETE FROM classroom_students WHERE classroom_id = $1 AND student_username = $2
  if (sqlNormalized.startsWith("DELETE FROM classroom_students WHERE classroom_id = $1 AND student_username = $2")) {
    const [classId, student] = params;
    data.classroom_students = data.classroom_students.filter(cs => !(cs.classroom_id === classId && cs.student_username === student.toLowerCase()));
    writeFallbackData(data);
    return { rows: [] };
  }

  // 18. UPDATE classrooms SET name = $1 WHERE id = $2 AND teacher_username = $3
  if (sqlNormalized.startsWith("UPDATE classrooms SET name = $1 WHERE id = $2 AND teacher_username = $3")) {
    const [name, id, teacher] = params;
    const cls = data.classrooms[id];
    if (cls && cls.teacher_username === teacher.toLowerCase()) {
      cls.name = name;
      writeFallbackData(data);
    }
    return { rows: [] };
  }

  // 19. DELETE FROM classrooms WHERE id = $1 AND teacher_username = $2
  if (sqlNormalized.startsWith("DELETE FROM classrooms WHERE id = $1 AND teacher_username = $2")) {
    const [id, teacher] = params;
    if (data.classrooms[id] && data.classrooms[id].teacher_username === teacher.toLowerCase()) {
      delete data.classrooms[id];
      data.classroom_students = data.classroom_students.filter(cs => cs.classroom_id !== id);
      writeFallbackData(data);
    }
    return { rows: [] };
  }

  // 20. INSERT INTO quiz_history (student_username, subject, score, accuracy, time_spent, status) VALUES ($1, $2, $3, $4, $5, $6)
  if (sqlNormalized.startsWith("INSERT INTO quiz_history")) {
    const [student_username, subject, score, accuracy, time_spent, status] = params;
    data.quiz_history.unshift({
      id: Date.now(),
      student_username: student_username.toLowerCase(),
      date: new Date().toISOString(),
      subject, score, accuracy, time_spent, status
    });
    writeFallbackData(data);
    return { rows: [] };
  }

  // 21. SELECT date, subject, score, accuracy, time_spent as "timeSpent", status FROM quiz_history WHERE student_username = $1 ORDER BY date DESC
  if (sqlNormalized.startsWith("SELECT date, subject, score, accuracy, time_spent as \"timeSpent\", status FROM quiz_history WHERE student_username = $1")) {
    const student = params[0].toLowerCase();
    const rows = data.quiz_history.filter(h => h.student_username === student).map(h => ({
      date: h.date, subject: h.subject, score: h.score, accuracy: h.accuracy, timeSpent: h.time_spent, status: h.status
    }));
    return { rows };
  }

  // 22. SELECT username, name, avatar FROM users WHERE parent_email = $1 OR parent_email = $2
  if (sqlNormalized.startsWith("SELECT username, name, avatar FROM users WHERE parent_email = $1 OR parent_email = $2")) {
    const [p1, p2] = params;
    const rows = Object.values(data.users)
      .filter(u => u.parent_email === p1 || u.parent_email === p2)
      .map(u => ({ username: u.username, name: u.name, avatar: u.avatar }));
    return { rows };
  }

  // 23. UPDATE users SET parent_email = $1 WHERE username = $2
  if (sqlNormalized.startsWith("UPDATE users SET parent_email = $1 WHERE username = $2")) {
    const [parent, student] = params;
    const child = data.users[student.toLowerCase()];
    if (child) {
      child.parent_email = parent;
      writeFallbackData(data);
    }
    return { rows: [] };
  }

  // 24. UPDATE users SET parent_email = NULL WHERE username = $1
  if (sqlNormalized.startsWith("UPDATE users SET parent_email = NULL WHERE username = $1")) {
    const [student] = params;
    const child = data.users[student.toLowerCase()];
    if (child) {
      child.parent_email = null;
      writeFallbackData(data);
    }
    return { rows: [] };
  }

  // 25. UPDATE users SET ... (Profile settings update)
  if (sqlNormalized.startsWith("UPDATE users SET")) {
    // Dynamic query helper
    const username = params[params.length - 1].toLowerCase();
    const user = data.users[username];
    if (user) {
      if (sqlNormalized.includes("name =")) {
        user.name = params[0];
      }
      if (sqlNormalized.includes("avatar =")) {
        // Find index of avatar param
        const idx = sqlNormalized.includes("name =") ? 1 : 0;
        user.avatar = params[idx];
      }
      if (sqlNormalized.includes("password_hash =")) {
        const idx = params.length - 2;
        user.password_hash = params[idx];
      }
      writeFallbackData(data);
    }
    return { rows: [] };
  }

  // 26. SELECT role, COUNT(*) as count FROM users GROUP BY role
  if (sqlNormalized.startsWith("SELECT role, COUNT(*) as count FROM users GROUP BY role")) {
    const roles = {};
    Object.values(data.users).forEach(u => {
      roles[u.role] = (roles[u.role] || 0) + 1;
    });
    const rows = Object.entries(roles).map(([role, count]) => ({ role, count }));
    return { rows };
  }

  // 27. SELECT username, name, role, avatar, xp, streak, status FROM users ORDER BY name ASC
  if (sqlNormalized.startsWith("SELECT username, name, role, avatar, xp, streak, status FROM users")) {
    const rows = Object.values(data.users).map(u => ({
      username: u.username,
      name: u.name,
      role: u.role,
      avatar: u.avatar,
      xp: u.xp || 0,
      streak: u.streak || 0,
      status: u.status || 'active'
    })).sort((a, b) => a.name.localeCompare(b.name));
    return { rows };
  }

  // 28. UPDATE users SET password_hash = $1 WHERE username = $2
  if (sqlNormalized.startsWith("UPDATE users SET password_hash = $1 WHERE username = $2")) {
    const [hash, username] = params;
    const user = data.users[username.toLowerCase()];
    if (user) {
      user.password_hash = hash;
      writeFallbackData(data);
    }
    return { rows: [] };
  }

  // 29. UPDATE users SET role = $1, status = $2 WHERE username = $3
  if (sqlNormalized.startsWith("UPDATE users SET role = $1, status = $2 WHERE username = $3")) {
    const [role, status, username] = params;
    const user = data.users[username.toLowerCase()];
    if (user) {
      user.role = role;
      user.status = status;
      writeFallbackData(data);
    }
    return { rows: [] };
  }

  // 30. SELECT COUNT(*) as count FROM classrooms
  if (sqlNormalized.startsWith("SELECT COUNT(*) FROM classrooms") || sqlNormalized.startsWith("SELECT COUNT(*) as count FROM classrooms")) {
    return { rows: [{ count: Object.keys(data.classrooms).length }] };
  }

  // 31. SELECT COUNT(*) as count FROM quiz_history
  if (sqlNormalized.startsWith("SELECT COUNT(*) FROM quiz_history") || sqlNormalized.startsWith("SELECT COUNT(*) as count FROM quiz_history")) {
    return { rows: [{ count: data.quiz_history.length }] };
  }

  console.warn("UNHANDLED SIMULATED QUERY:", sqlNormalized);
  return { rows: [] };
}

// JWT authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// Helper to generate Friend Code
function generateFriendCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Malaysia restriction middleware
function restrictToMalaysia(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // For local development, allow localhost bypass
  if (ip === '127.0.0.1' || ip === '::1' || ip.includes('192.168.') || ip.includes('10.')) {
    return next();
  }
  
  const geo = geoip.lookup(ip);
  if (!geo || geo.country === 'MY') {
    return next();
  }
  
  return res.status(403).json({
    error: 'Nexxbit is currently only available for schools within Malaysia. 🇲🇾'
  });
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// Sign Up Route
app.post('/api/register', restrictToMalaysia, async (req, res) => {
  try {
    const { username, fullname, password, role, gender, parentEmail, parentRole, email } = req.body;
    
    if (!username || !fullname || !password || !role) {
      return res.status(400).json({ error: 'Required fields are missing' });
    }

    if ((role === 'parent' || role === 'teacher') && (!email || !email.trim())) {
      return res.status(400).json({ error: 'Email Address is compulsory for parents and teachers' });
    }

    const lowerUser = username.trim().toLowerCase();
    
    // Check if user exists
    const checkRes = await executeQuery("SELECT username FROM users WHERE username = $1", [lowerUser]);
    if (checkRes.rows.length > 0) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    // Check if email is already taken
    if (email && email.trim()) {
      const checkEmailRes = await executeQuery("SELECT username FROM users WHERE email = $1", [email.trim().toLowerCase()]);
      if (checkEmailRes.rows.length > 0) {
        return res.status(400).json({ error: 'Email address is already registered' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const friendCode = generateFriendCode();
    
    // Determine avatar
    let avatar = '🧒';
    if (role === 'student') {
      avatar = gender === 'female' ? '👧' : '👦';
    } else if (role === 'parent') {
      avatar = parentRole === 'mother' ? '👩' : '👨';
    } else if (role === 'teacher') {
      avatar = '👩‍🏫';
    }

    await executeQuery(
      `INSERT INTO users (username, password_hash, role, name, avatar, parent_email, gender, school, parent_role, friend_code, email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [lowerUser, passwordHash, role, fullname.trim(), avatar, parentEmail || null, gender || null, null, parentRole || null, friendCode, email ? email.trim().toLowerCase() : null]
    );

    res.status(201).json({ message: 'Registration successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login Route
app.post('/api/login', restrictToMalaysia, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const lowerUser = username.trim().toLowerCase();
    const userRes = await executeQuery("SELECT * FROM users WHERE username = $1 OR email = $1", [lowerUser]);
    
    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const user = userRes.rows[0];
    if (user.status === 'disabled') {
      return res.status(403).json({ error: 'This account has been disabled. Please contact an administrator.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    // Sign Token
    const token = jwt.sign(
      { username: user.username, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        username: user.username,
        role: user.role,
        name: user.name
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot Password Endpoint
app.post('/api/forgot-password', restrictToMalaysia, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const emailLower = email.trim().toLowerCase();
    const userRes = await executeQuery("SELECT * FROM users WHERE email = $1", [emailLower]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with this email address' });
    }

    const user = userRes.rows[0];
    const recoveryPassword = `RECOVER_${Math.floor(100000 + Math.random() * 900000)}`;
    const hashedPass = await bcrypt.hash(recoveryPassword, 10);

    await executeQuery("UPDATE users SET password_hash = $1 WHERE email = $2", [hashedPass, emailLower]);

    res.json({ 
      message: 'A temporary recovery password has been generated.', 
      recoveryPassword 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to recover password' });
  }
});

// Get profile & detailed info
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const userRes = await executeQuery("SELECT * FROM users WHERE username = $1", [req.user.username]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const user = userRes.rows[0];
    
    // Fetch user quiz history
    const historyRes = await executeQuery(
      "SELECT date, subject, score, accuracy, time_spent as \"timeSpent\", status FROM quiz_history WHERE student_username = $1 ORDER BY date DESC",
      [req.user.username]
    );

    // Fetch linked kids if parent
    let linkedKids = [];
    if (user.role === 'parent') {
      const kidsRes = await executeQuery(
        "SELECT username, name, avatar FROM users WHERE parent_email = $1 OR parent_email = $2",
        [user.username, `${user.username}@example.com`]
      );
      linkedKids = kidsRes.rows.map(k => k.username);
    }

    res.json({
      profile: {
        username: user.username,
        role: user.role,
        name: user.name,
        avatar: user.avatar,
        xp: user.xp,
        streak: user.streak,
        friendCode: user.friend_code,
        friends: user.friends || [],
        parentEmail: user.parent_email,
        school: user.school,
        gender: user.gender,
        parentRole: user.parent_role,
        linkedKids: linkedKids
      },
      history: historyRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fetch child data for Parent Dashboard
app.get('/api/parent/child/:username', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'parent') return res.status(403).json({ error: 'Forbidden' });
    
    const childUsername = req.params.username.toLowerCase();
    
    // Verify parent is linked to child
    const parentRes = await executeQuery("SELECT username FROM users WHERE username = $1", [req.user.username]);
    const parent = parentRes.rows[0];
    const childRes = await executeQuery("SELECT * FROM users WHERE username = $1 AND role = 'student'", [childUsername]);
    
    if (childRes.rows.length === 0) return res.status(404).json({ error: 'Child not found' });
    const child = childRes.rows[0];
    
    if (child.parent_email !== parent.username && child.parent_email !== `${parent.username}@example.com`) {
      return res.status(403).json({ error: 'Unauthorized access to this child profile' });
    }

    const historyRes = await executeQuery(
      "SELECT date, subject, score, accuracy, time_spent as \"timeSpent\", status FROM quiz_history WHERE student_username = $1 ORDER BY date DESC",
      [childUsername]
    );

    res.json({
      username: child.username,
      name: child.name,
      avatar: child.avatar,
      xp: child.xp,
      streak: child.streak,
      history: historyRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset Child Password by Parent
app.post('/api/parent/child/reset-password', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'parent') return res.status(403).json({ error: 'Forbidden' });
    
    const { childUsername, newPassword } = req.body;
    if (!childUsername || !newPassword) {
      return res.status(400).json({ error: 'Child username and new password are required' });
    }
    
    const childLower = childUsername.toLowerCase().trim();
    
    // Verify parent is linked to child
    const parentRes = await executeQuery("SELECT username FROM users WHERE username = $1", [req.user.username]);
    const parent = parentRes.rows[0];
    const childRes = await executeQuery("SELECT * FROM users WHERE username = $1 AND role = 'student'", [childLower]);
    
    if (childRes.rows.length === 0) return res.status(404).json({ error: 'Child not found' });
    const child = childRes.rows[0];
    
    if (child.parent_email !== parent.username && child.parent_email !== `${parent.username}@example.com`) {
      return res.status(403).json({ error: 'Unauthorized access to this child profile' });
    }

    const hashedPass = await bcrypt.hash(newPassword, 10);
    await executeQuery("UPDATE users SET password_hash = $1 WHERE username = $2", [hashedPass, childLower]);

    res.json({ message: `Successfully updated password for child account @${childLower}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Link Child to Parent
app.post('/api/parent/link', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'parent') return res.status(403).json({ error: 'Forbidden' });
    const { kidUsername, kidPassword } = req.body;
    
    const kidRes = await executeQuery("SELECT * FROM users WHERE username = $1 AND role = 'student'", [kidUsername.toLowerCase()]);
    if (kidRes.rows.length === 0) return res.status(404).json({ error: 'Child not found' });
    
    const kid = kidRes.rows[0];
    const passwordMatch = await bcrypt.compare(kidPassword, kid.password_hash);
    if (!passwordMatch) return res.status(400).json({ error: 'Verification failed' });
    
    // Update child's parent email relation
    await executeQuery("UPDATE users SET parent_email = $1 WHERE username = $2", [req.user.username, kid.username]);
    
    res.json({ message: 'Linked successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unlink Child
app.post('/api/parent/unlink', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'parent') return res.status(403).json({ error: 'Forbidden' });
    const { kidUsername } = req.body;
    
    await executeQuery("UPDATE users SET parent_email = NULL WHERE username = $1", [kidUsername.toLowerCase()]);
    res.json({ message: 'Unlinked successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Classrooms
app.get('/api/classrooms', authenticateToken, async (req, res) => {
  try {
    let query = "";
    let params = [];
    
    if (req.user.role === 'teacher') {
      query = "SELECT * FROM classrooms WHERE teacher_username = $1";
      params = [req.user.username];
    } else if (req.user.role === 'student') {
      query = `SELECT c.* FROM classrooms c
               JOIN classroom_students cs ON c.id = cs.classroom_id
               WHERE cs.student_username = $1`;
      params = [req.user.username];
    } else {
      return res.json([]);
    }

    const classroomsRes = await executeQuery(query, params);
    const classrooms = [];

    for (const row of classroomsRes.rows) {
      // Get student count
      const countRes = await executeQuery("SELECT COUNT(*) FROM classroom_students WHERE classroom_id = $1", [row.id]);
      const count = parseInt(countRes.rows[0].count);

      // Get students details
      const studentsRes = await executeQuery(
        `SELECT u.name, u.xp, u.username
         FROM users u
         JOIN classroom_students cs ON u.username = cs.student_username
         WHERE cs.classroom_id = $1`,
        [row.id]
      );

      classrooms.push({
        id: row.id,
        name: row.name,
        code: row.code,
        studentsCount: count,
        students: studentsRes.rows.map(s => ({
          name: s.name,
          username: s.username,
          score: 0,
          accuracy: 100
        }))
      });
    }

    res.json(classrooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create Classroom
app.post('/api/classrooms', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Only teachers can create classrooms' });
    
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Classroom name required' });

    const id = 'class-' + Date.now();
    const code = 'C-' + generateFriendCode();

    await executeQuery(
      "INSERT INTO classrooms (id, name, code, teacher_username) VALUES ($1, $2, $3, $4)",
      [id, name.trim(), code, req.user.username]
    );

    res.status(201).json({ id, name, code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join Classroom
app.post('/api/classrooms/join', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can join classrooms' });
    
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Classroom invite code required' });

    const codeUpper = code.trim().toUpperCase();
    const classRes = await executeQuery("SELECT * FROM classrooms WHERE UPPER(code) = $1", [codeUpper]);
    
    if (classRes.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid classroom invite code' });
    }

    const classroom = classRes.rows[0];

    // Check if already joined
    const checkRes = await executeQuery(
      "SELECT * FROM classroom_students WHERE classroom_id = $1 AND student_username = $2",
      [classroom.id, req.user.username]
    );
    if (checkRes.rows.length > 0) {
      return res.status(400).json({ error: 'You have already joined this classroom' });
    }

    await executeQuery(
      "INSERT INTO classroom_students (classroom_id, student_username) VALUES ($1, $2)",
      [classroom.id, req.user.username]
    );

    res.json({ message: 'Successfully joined classroom', name: classroom.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove Student from classroom
app.post('/api/classrooms/remove-student', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' });
    const { classroomId, studentUsername } = req.body;

    // Verify teacher owns the classroom
    const checkClass = await executeQuery("SELECT id FROM classrooms WHERE id = $1 AND teacher_username = $2", [classroomId, req.user.username]);
    if (checkClass.rows.length === 0) return res.status(403).json({ error: 'Unauthorized classroom modification' });

    await executeQuery(
      "DELETE FROM classroom_students WHERE classroom_id = $1 AND student_username = $2",
      [classroomId, studentUsername.toLowerCase()]
    );

    res.json({ message: 'Student removed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit Classroom Name
app.post('/api/classrooms/edit', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' });
    const { id, name } = req.body;

    await executeQuery(
      "UPDATE classrooms SET name = $1 WHERE id = $2 AND teacher_username = $3",
      [name.trim(), id, req.user.username]
    );
    res.json({ message: 'Classroom renamed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete Classroom
app.post('/api/classrooms/delete', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.body;

    await executeQuery(
      "DELETE FROM classrooms WHERE id = $1 AND teacher_username = $2",
      [id, req.user.username]
    );
    res.json({ message: 'Classroom deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit Quiz Results (Updates XP & inserts history entry)
app.post('/api/quiz/submit', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can submit quiz scores' });
    
    const { subject, score, accuracy, timeSpent, status, xpEarned } = req.body;

    // Insert history entry
    await executeQuery(
      `INSERT INTO quiz_history (student_username, subject, score, accuracy, time_spent, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.username, subject, score, accuracy, timeSpent, status]
    );

    // Update student XP & Streak
    await executeQuery(
      "UPDATE users SET xp = xp + $1, streak = streak + 1 WHERE username = $2",
      [parseInt(xpEarned) || 0, req.user.username]
    );

    res.json({ message: 'Quiz results recorded successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fetch Social Circle friends profiles
app.get('/api/circle/friends', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students have social circles' });

    const userRes = await executeQuery("SELECT friends FROM users WHERE username = $1", [req.user.username]);
    const friends = userRes.rows[0].friends || [];

    if (friends.length === 0) return res.json([]);

    const friendsRes = await executeQuery(
      `SELECT username, name, avatar, xp, streak
       FROM users
       WHERE username = ANY($1)`,
      [friends]
    );

    res.json(friendsRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add Friend to Social Circle
app.post('/api/circle/add', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can add friends' });
    
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Friend code required' });

    const codeUpper = code.trim().toUpperCase();
    
    // Find user with friend code
    const friendRes = await executeQuery("SELECT * FROM users WHERE UPPER(friend_code) = $1 AND role = 'student'", [codeUpper]);
    if (friendRes.rows.length === 0) {
      return res.status(404).json({ error: 'Friend code not found' });
    }

    const friend = friendRes.rows[0];

    if (friend.username === req.user.username) {
      return res.status(400).json({ error: 'You cannot add yourself' });
    }

    // Check if already friends
    const meRes = await executeQuery("SELECT friends FROM users WHERE username = $1", [req.user.username]);
    const myFriends = meRes.rows[0].friends || [];

    if (myFriends.includes(friend.username)) {
      return res.status(400).json({ error: 'Friend is already in your circle' });
    }

    // Add friend
    await executeQuery(
      "UPDATE users SET friends = array_append(friends, $1) WHERE username = $2",
      [friend.username, req.user.username]
    );

    res.json({ message: `Successfully added ${friend.name}`, name: friend.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update Account Profile Settings
app.post('/api/settings/update', authenticateToken, async (req, res) => {
  try {
    const { fullname, password, avatar } = req.body;
    
    let updateFields = [];
    let params = [];
    let index = 1;

    if (fullname) {
      updateFields.push(`name = $${index++}`);
      params.push(fullname.trim());
    }
    if (avatar) {
      updateFields.push(`avatar = $${index++}`);
      params.push(avatar);
    }
    if (password && password.length >= 8) {
      const hash = await bcrypt.hash(password, 10);
      updateFields.push(`password_hash = $${index++}`);
      params.push(hash);
    }

    if (updateFields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(req.user.username);
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE username = $${index} RETURNING *`;
    
    await executeQuery(query, params);
    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// -------------------------------------------------------------
// ADMIN ENDPOINTS
// -------------------------------------------------------------

// Admin authorization check middleware
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
}

// Get admin system statistics
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const startTime = Date.now();
    // Test query for DB health
    await executeQuery("SELECT 1");
    const dbLatency = Date.now() - startTime;

    const userCountRes = await executeQuery("SELECT role, COUNT(*) as count FROM users GROUP BY role");
    const classCountRes = await executeQuery("SELECT COUNT(*) as count FROM classrooms");
    const quizCountRes = await executeQuery("SELECT COUNT(*) as count FROM quiz_history");

    // Calculate total questions answered
    const quizScoresRes = await executeQuery("SELECT score FROM quiz_history");
    let totalQuestionsAnswered = 0;
    quizScoresRes.rows.forEach(row => {
      const parts = row.score.split('/');
      if (parts.length === 2) {
        totalQuestionsAnswered += parseInt(parts[1]) || 0;
      }
    });

    const stats = {
      students: 0,
      teachers: 0,
      parents: 0,
      admins: 0,
      classrooms: parseInt(classCountRes.rows[0]?.count) || 0,
      quizzesCompleted: parseInt(quizCountRes.rows[0]?.count) || 0,
      totalQuestionsAnswered,
      dbStatus: 'CONNECTED',
      dbLatency: `${dbLatency}ms`,
      dbType: useFallbackDb ? 'JSON_FALLBACK' : 'POSTGRESQL'
    };

    userCountRes.rows.forEach(r => {
      if (r.role === 'student') stats.students = parseInt(r.count);
      else if (r.role === 'teacher') stats.teachers = parseInt(r.count);
      else if (r.role === 'parent') stats.parents = parseInt(r.count);
      else if (r.role === 'admin') stats.admins = parseInt(r.count);
    });

    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List all registered users
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const usersRes = await executeQuery("SELECT username, name, role, avatar, xp, streak, status FROM users ORDER BY name ASC");
    res.json(usersRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user details
app.post('/api/admin/users/update', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { targetUsername, role, status, newPassword } = req.body;
    
    if (!targetUsername) return res.status(400).json({ error: 'Target username is required' });

    if (newPassword && newPassword.trim()) {
      const hashedPass = await bcrypt.hash(newPassword.trim(), 10);
      await executeQuery("UPDATE users SET password_hash = $1 WHERE username = $2", [hashedPass, targetUsername.toLowerCase()]);
    }

    if (role || status) {
      await executeQuery("UPDATE users SET role = $1, status = $2 WHERE username = $3", [role, status, targetUsername.toLowerCase()]);
    }

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Active user sessions with live simulation coordinate data for Malaysian cities
app.get('/api/admin/active-sessions', authenticateToken, requireAdmin, async (req, res) => {
  const malaysianCities = [
    { city: 'Kuala Lumpur', lat: 3.1390, lng: 101.6869 },
    { city: 'Penang', lat: 5.4141, lng: 100.3288 },
    { city: 'Johor Bahru', lat: 1.4854, lng: 103.7618 },
    { city: 'Kuching', lat: 1.5533, lng: 110.3592 },
    { city: 'Kota Kinabalu', lat: 5.9804, lng: 116.0735 },
    { city: 'Ipoh', lat: 4.5921, lng: 101.0901 },
    { city: 'Malacca', lat: 2.1896, lng: 102.2501 },
    { city: 'Kuantan', lat: 3.8077, lng: 103.3260 }
  ];

  const activities = [
    'doing Multiplication practice',
    'reviewing English vocabulary',
    'answering Division questions',
    'viewing reports',
    'checking leaderboards'
  ];

  // Primary list with real and mock students
  const mockSessions = [
    { username: 'eilhan', name: 'Eilhan', role: 'student', city: 'Kuala Lumpur', lat: 3.1390, lng: 101.6869, activity: 'doing Multiplication practice' },
    { username: 'ellysha', name: 'Ellysha', role: 'student', city: 'Penang', lat: 5.4141, lng: 100.3288, activity: 'doing English spelling' },
    { username: 'hafiz', name: 'Hafiz', role: 'parent', city: 'Kuching', lat: 1.5533, lng: 110.3592, activity: 'viewing child dashboard' },
    { username: 'veelai', name: 'Veelai', role: 'teacher', city: 'Johor Bahru', lat: 1.4854, lng: 103.7618, activity: 'reviewing classroom roster' }
  ];

  // Randomize a guest session dynamically to keep it active
  const randomCity = malaysianCities[Math.floor(Math.random() * malaysianCities.length)];
  const randomActivity = activities[Math.floor(Math.random() * activities.length)];
  mockSessions.push({
    username: 'guest_' + Math.floor(100 + Math.random() * 900),
    name: 'Guest Student',
    role: 'student',
    city: randomCity.city,
    lat: randomCity.lat,
    lng: randomCity.lng,
    activity: randomActivity
  });

  res.json(mockSessions);
});

// Whitelisted Table Inspector Query Endpoint
app.get('/api/admin/db/tables/:table', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const table = req.params.table;
    const q = req.query.q ? req.query.q.trim().toLowerCase() : '';
    const whitelist = ['users', 'classrooms', 'quiz_history', 'classroom_students'];

    if (!whitelist.includes(table)) {
      return res.status(400).json({ error: 'Invalid or unauthorized database table' });
    }

    const columnsMap = {
      users: ['username', 'name', 'role', 'status', 'xp', 'streak', 'school', 'parent_email'],
      classrooms: ['id', 'name', 'code', 'teacher_username', 'created_at'],
      quiz_history: ['id', 'student_username', 'date', 'subject', 'score', 'accuracy', 'time_spent', 'status'],
      classroom_students: ['classroom_id', 'student_username', 'joined_at']
    };

    let rows = [];

    if (useFallbackDb) {
      const data = readFallbackData();
      if (table === 'users') {
        rows = Object.values(data.users);
        if (q) {
          rows = rows.filter(u => u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));
        }
      } else if (table === 'classrooms') {
        rows = data.classrooms || [];
        if (q) {
          rows = rows.filter(c => c.name.toLowerCase().includes(q) || c.teacher_username.toLowerCase().includes(q));
        }
      } else if (table === 'quiz_history') {
        rows = data.quiz_history || [];
        if (q) {
          rows = rows.filter(qh => qh.student_username.toLowerCase().includes(q) || qh.subject.toLowerCase().includes(q));
        }
      } else if (table === 'classroom_students') {
        rows = data.classroom_students || [];
        if (q) {
          rows = rows.filter(cs => cs.student_username.toLowerCase().includes(q));
        }
      }
    } else {
      let sql = `SELECT * FROM ${table}`;
      let params = [];

      if (q) {
        if (table === 'users') {
          sql += " WHERE username ILIKE $1 OR name ILIKE $1";
          params = [`%${q}%`];
        } else if (table === 'classrooms') {
          sql += " WHERE name ILIKE $1 OR teacher_username ILIKE $1";
          params = [`%${q}%`];
        } else if (table === 'quiz_history') {
          sql += " WHERE student_username ILIKE $1 OR subject ILIKE $1";
          params = [`%${q}%`];
        } else if (table === 'classroom_students') {
          sql += " WHERE student_username ILIKE $1";
          params = [`%${q}%`];
        }
      }
      sql += " ORDER BY 1 DESC LIMIT 100";
      const dbRes = await executeQuery(sql, params);
      rows = dbRes.rows;
    }

    res.json({
      columns: columnsMap[table],
      rows: rows.map(row => {
        // Map postgres-style keys to match the column mappings cleanly
        const mapped = {};
        columnsMap[table].forEach(col => {
          // Check both original name and camelCase equivalents if returned by PG driver
          const camelCol = col.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
          mapped[col] = row[col] !== undefined ? row[col] : row[camelCol];
        });
        return mapped;
      })
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Database Full JSON Backup Endpoint
app.get('/api/admin/db/backup', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let backup = {};

    if (useFallbackDb) {
      const data = readFallbackData();
      backup = {
        users: Object.values(data.users),
        classrooms: data.classrooms || [],
        classroom_students: data.classroom_students || [],
        quiz_history: data.quiz_history || []
      };
    } else {
      const users = (await executeQuery("SELECT * FROM users")).rows;
      const classrooms = (await executeQuery("SELECT * FROM classrooms")).rows;
      const classroom_students = (await executeQuery("SELECT * FROM classroom_students")).rows;
      const quiz_history = (await executeQuery("SELECT * FROM quiz_history")).rows;

      backup = { users, classrooms, classroom_students, quiz_history };
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="nexxbit_backup_${Date.now()}.json"`);
    res.json(backup);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Backup generation failed' });
  }
});

// Database Restore Endpoint (Supports full restoration or granular single-user restoration)
app.post('/api/admin/db/restore', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { mode, backupData, targetUsername } = req.body;

    if (!backupData || !backupData.users) {
      return res.status(400).json({ error: 'Invalid backup dataset payload structure' });
    }

    if (mode === 'user') {
      if (!targetUsername) return res.status(400).json({ error: 'Target username is required' });
      
      const targetLower = targetUsername.toLowerCase().trim();
      const backupUser = backupData.users.find(u => u.username.toLowerCase() === targetLower);
      if (!backupUser) {
        return res.status(404).json({ error: `User '${targetUsername}' not found in the backup file` });
      }

      if (useFallbackDb) {
        const data = readFallbackData();
        data.users[targetLower] = backupUser;
        
        // Remove existing quiz records for user and restore from backup
        data.quiz_history = (data.quiz_history || []).filter(qh => qh.student_username.toLowerCase() !== targetLower);
        const restoredHistory = (backupData.quiz_history || []).filter(qh => qh.student_username.toLowerCase() === targetLower);
        data.quiz_history.push(...restoredHistory);
        
        writeFallbackData(data);
      } else {
        // Run as transaction in PostgreSQL
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query("DELETE FROM quiz_history WHERE student_username = $1", [targetLower]);
          await client.query("DELETE FROM classroom_students WHERE student_username = $1", [targetLower]);
          await client.query("DELETE FROM users WHERE username = $1", [targetLower]);

          const u = backupUser;
          await client.query(
            `INSERT INTO users (username, password_hash, role, name, avatar, xp, streak, parent_email, gender, school, parent_role, friend_code, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [u.username, u.password_hash, u.role, u.name, u.avatar, u.xp || 0, u.streak || 0, u.parent_email, u.gender, u.school, u.parent_role, u.friend_code, u.status || 'active']
          );

          const restoredHistory = (backupData.quiz_history || []).filter(qh => qh.student_username.toLowerCase() === targetLower);
          for (const q of restoredHistory) {
            await client.query(
              `INSERT INTO quiz_history (student_username, date, subject, score, accuracy, time_spent, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [q.student_username, q.date, q.subject, q.score, q.accuracy || 0, q.time_spent || 0, q.status || 'sync']
            );
          }
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      }

      return res.json({ message: `Restored user profile and history for @${targetLower} successfully` });
    } 
    
    if (mode === 'full') {
      if (useFallbackDb) {
        const newData = {
          users: {},
          classrooms: backupData.classrooms || [],
          classroom_students: backupData.classroom_students || [],
          quiz_history: backupData.quiz_history || [],
          pending_questions: [],
          saved_live_tests: [],
          completed_live_tests: []
        };
        backupData.users.forEach(u => {
          newData.users[u.username.toLowerCase()] = u;
        });
        writeFallbackData(newData);
      } else {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          // Wipes in cascade order
          await client.query("TRUNCATE classroom_students, quiz_history, classrooms, users CASCADE");

          // Restore Users
          for (const u of backupData.users) {
            await client.query(
              `INSERT INTO users (username, password_hash, role, name, avatar, xp, streak, parent_email, gender, school, parent_role, friend_code, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [u.username, u.password_hash, u.role, u.name, u.avatar, u.xp || 0, u.streak || 0, u.parent_email, u.gender, u.school, u.parent_role, u.friend_code, u.status || 'active']
            );
          }

          // Restore Classrooms
          if (backupData.classrooms) {
            for (const c of backupData.classrooms) {
              await client.query(
                `INSERT INTO classrooms (id, name, code, teacher_username, created_at)
                 VALUES ($1, $2, $3, $4, $5)`,
                [c.id, c.name, c.code, c.teacher_username, c.created_at || new Date()]
              );
            }
          }

          // Restore Classroom Students
          if (backupData.classroom_students) {
            for (const cs of backupData.classroom_students) {
              await client.query(
                `INSERT INTO classroom_students (classroom_id, student_username, joined_at)
                 VALUES ($1, $2, $3)`,
                [cs.classroom_id, cs.student_username, cs.joined_at || new Date()]
              );
            }
          }

          // Restore Quiz History
          if (backupData.quiz_history) {
            for (const q of backupData.quiz_history) {
              await client.query(
                `INSERT INTO quiz_history (student_username, date, subject, score, accuracy, time_spent, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [q.student_username, q.date || new Date(), q.subject, q.score, q.accuracy || 0, q.time_spent || 0, q.status || 'sync']
              );
            }
          }

          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      }

      return res.json({ message: 'Full database restoration executed successfully' });
    }

    res.status(400).json({ error: 'Invalid restore mode parameter specify' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database restore operation failed' });
  }
});

// -------------------------------------------------------------
// STATIC FILES & FRONTEND ROUTING
// -------------------------------------------------------------

// Serve static assets from root and src folders
app.use('/src', express.static(path.join(process.cwd(), 'src')));
app.use('/public', express.static(path.join(process.cwd(), 'public')));
app.use('/node_modules', express.static(path.join(process.cwd(), 'node_modules')));

// Explicit Root route
app.get('/', (req, res) => {
  try {
    const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
    res.send(html);
  } catch (err) {
    res.status(500).send("Read Error: " + err.message);
  }
});

// Serve Legal Static Pages
app.get('/legal/terms', (req, res) => {
  try {
    const p = path.join(__dirname, 'public', 'legal', 'terms.html');
    const html = fs.readFileSync(p, 'utf8');
    res.send(html);
  } catch (err) {
    res.status(500).send("Error reading terms: " + err.message);
  }
});

app.get('/legal/privacy', (req, res) => {
  try {
    const p = path.join(__dirname, 'public', 'legal', 'privacy.html');
    const html = fs.readFileSync(p, 'utf8');
    res.send(html);
  } catch (err) {
    res.status(500).send("Error reading privacy: " + err.message);
  }
});

// Serve index.html for all other non-API requests
app.get(/^(?!\/api|\/legal).*$/, (req, res) => {
  try {
    const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
    res.send(html);
  } catch (err) {
    res.status(500).send("Read Error: " + err.message);
  }
});

// Start listening
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
