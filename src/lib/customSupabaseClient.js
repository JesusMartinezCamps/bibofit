import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eglsbtetefqfwidpjtyf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnbHNidGV0ZWZxZndpZHBqdHlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2NzYxMDUsImV4cCI6MjA2NjI1MjEwNX0.5L1KZ3RMGVb4nRF3A0Wm0335O063e2X7uNSwum9U3AM';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
