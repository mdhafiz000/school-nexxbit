const supabaseUrl = 'https://kxuntlznooksffpmuzyu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4dW50bHpub29rc2ZmcG11enl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MDAyODMsImV4cCI6MjA5ODM3NjI4M30.3cwd1RyYFtphF9jMki1UC_pIcogchAVecVGUeAmpDWw';

if (!window.supabase) {
  console.error("Supabase CDN failed to load. Please check your internet connection.");
}

export const supabase = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;
