import { SUBJECT_REGISTRY } from '../config/subjects.js';
import { supabase } from '../config/supabase.js';

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
// SECURE SUPABASE API CLIENT
// -------------------------------------------------------------

export function getToken() {
  // Retained for compatibility (Supabase manages session natively in LocalStorage)
  return localStorage.getItem('sb-kxuntlznooksffpmuzyu-auth-token');
}

export function setToken(token) {
  // Retained for compatibility
}

// Global function to sync everything from Supabase
export async function syncSession() {
  if (!supabase) return null;

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      updateState(draft => {
        draft.currentUser = null;
      });
      return null;
    }

    const user = session.user;
    
    // 1. Fetch profile from public.users table matching user.id
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch failed:", profileError);
      return null;
    }

    // 2. Fetch history from public.quiz_history
    const { data: history } = await supabase
      .from('quiz_history')
      .select('*')
      .eq('student_id', user.id)
      .order('date', { ascending: false });

    // 3. Fetch linked kids (for parents)
    let linkedKids = [];
    if (profile.role === 'parent') {
      const { data: kids } = await supabase
        .from('users')
        .select('*')
        .eq('parent_email', profile.email);
      linkedKids = kids || [];
    }

    // Sync into frontend state object
    updateState(draft => {
      draft.currentUser = {
        id: profile.id,
        username: profile.username,
        role: profile.role,
        name: profile.name,
        email: profile.email
      };
      draft.currentRole = profile.role;
      
      draft.users[profile.username] = {
        id: profile.id,
        username: profile.username,
        role: profile.role,
        name: profile.name,
        avatar: profile.avatar,
        xp: profile.xp,
        streak: profile.streak,
        parentEmail: profile.parent_email,
        friendCode: profile.friend_code,
        friends: profile.friends || [],
        school: profile.school,
        gender: profile.gender,
        parentRole: profile.parent_role,
        linkedKids: linkedKids.map(k => k.username) || [],
        history: history ? history.map(h => ({
          id: h.id,
          username: profile.username,
          date: h.date,
          subject: h.subject,
          score: h.score,
          accuracy: h.accuracy,
          time_spent: h.time_spent,
          status: h.status
        })) : []
      };

      // Populate kids profile entries in users mapping
      if (profile.role === 'parent') {
        linkedKids.forEach(kid => {
          draft.users[kid.username] = {
            id: kid.id,
            username: kid.username,
            role: kid.role,
            name: kid.name,
            avatar: kid.avatar,
            xp: kid.xp,
            streak: kid.streak,
            friendCode: kid.friend_code,
            friends: kid.friends || [],
            school: kid.school,
            gender: kid.gender,
            history: [] // Fetched dynamically on parent view
          };
        });
      }

      if (profile.role === 'student') {
        draft.student.name = profile.name;
        draft.student.xp = profile.xp;
        draft.student.streak = profile.streak;
      }
    });

    // 4. Fetch Classrooms
    let classrooms = [];
    if (profile.role === 'student') {
      const { data: joins } = await supabase
        .from('classroom_students')
        .select('classrooms (*, users:teacher_id (name))')
        .eq('student_id', user.id);
      
      classrooms = joins ? joins.map(j => {
        const c = j.classrooms;
        return {
          id: c.id,
          name: c.name,
          code: c.code,
          teacherName: c.users ? c.users.name : 'Unknown Teacher'
        };
      }) : [];
    } else if (profile.role === 'teacher') {
      const { data: classes } = await supabase
        .from('classrooms')
        .select('*, classroom_students (student_id, users:student_id (username, name, xp))')
        .eq('teacher_id', user.id);
      
      classrooms = classes ? classes.map(c => {
        const students = c.classroom_students ? c.classroom_students.map(cs => ({
          username: cs.users.username,
          name: cs.users.name,
          xp: cs.users.xp
        })) : [];
        return {
          id: c.id,
          name: c.name,
          code: c.code,
          students: students,
          studentCount: students.length
        };
      }) : [];
    }

    updateState(draft => {
      draft.classrooms = classrooms;
    });

    return state.currentUser;
  } catch (err) {
    console.error("Session sync failed:", err);
    updateState(draft => {
      draft.currentUser = null;
    });
    return null;
  }
}
