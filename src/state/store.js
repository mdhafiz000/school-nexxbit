import { SUBJECT_REGISTRY } from '../config/subjects.js';

export function generateFriendCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const DEFAULT_STATE = {
  theme: 'dark',
  currentRole: 'student',
  currentUser: null,
  users: {},
  student: {
    name: '',
    xp: 0,
    streak: 0,
    lastQuizDate: '',
    subject: 'math',
    difficulty: 'medium',
    operators: ['add', 'subtract'],
    englishTopics: ['spelling'],
    coopQuests: []
  },
  teacherConfig: {
    subject: 'math',
    difficulty: 'medium',
    operators: ['add', 'subtract'],
    englishTopics: ['spelling'],
    questionCount: 10,
    timerEnabled: true
  },
  pendingQuestions: [],
  teacherLeaderboard: [],
  classrooms: [],
  assignments: [],
  savedLiveTests: [],
  completedLiveTests: [],
  trustedLogins: JSON.parse(localStorage.getItem('nexxbit_trusted_logins')) || []
};

// Initialize State
export let state = { ...DEFAULT_STATE };
state.theme = localStorage.getItem('nexxbit_theme') || 'dark';

const subscribers = [];

export function subscribe(callback) {
  subscribers.push(callback);
  callback(state);
  return () => {
    const index = subscribers.indexOf(callback);
    if (index > -1) subscribers.splice(index, 1);
  };
}

export function notify() {
  subscribers.forEach(cb => cb(state));
}

export function updateState(mutator) {
  mutator(state);
  localStorage.setItem('nexxbit_theme', state.theme);
  notify();
}

// -------------------------------------------------------------
// SECURE API CLIENT HELPERS
// -------------------------------------------------------------
export function getToken() {
  return sessionStorage.getItem('nexxbit_jwt_token');
}

export function setToken(token) {
  if (token) {
    sessionStorage.setItem('nexxbit_jwt_token', token);
  } else {
    sessionStorage.removeItem('nexxbit_jwt_token');
  }
}

export async function apiRequest(url, method = 'GET', body = null) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP error! status: ${res.status}`);
  }
  return res.json();
}

// Global function to sync everything from the server
export async function syncSession() {
  const token = getToken();
  if (!token) return null;

  try {
    const data = await apiRequest('/api/me');
    const { profile, history } = data;
    
    // Sync into frontend state object
    updateState(draft => {
      draft.currentUser = {
        username: profile.username,
        role: profile.role,
        name: profile.name
      };
      draft.currentRole = profile.role;
      
      draft.users[profile.username] = {
        username: profile.username,
        role: profile.role,
        name: profile.name,
        avatar: profile.avatar,
        xp: profile.xp,
        streak: profile.streak,
        parentEmail: profile.parentEmail,
        friendCode: profile.friendCode,
        friends: profile.friends || [],
        school: profile.school,
        gender: profile.gender,
        parentRole: profile.parentRole,
        linkedKids: profile.linkedKids || [],
        history: history || []
      };

      if (profile.role === 'student') {
        draft.student.name = profile.name;
        draft.student.xp = profile.xp;
        draft.student.streak = profile.streak;
      }
    });

    // Fetch Classrooms
    const classrooms = await apiRequest('/api/classrooms');
    updateState(draft => {
      draft.classrooms = classrooms;
    });

    return state.currentUser;
  } catch (err) {
    console.error("Session sync failed:", err);
    setToken(null);
    updateState(draft => {
      draft.currentUser = null;
    });
    return null;
  }
}
