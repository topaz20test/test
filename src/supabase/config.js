import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://iyoxdgqrxaqpnpzhkfuv.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5b3hkZ3FyeGFxcG5wemhrZnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0OTg3NzIsImV4cCI6MjA4MzA3NDc3Mn0.wjLzcZAD0JhN9La1NB0mnL8SRdSJjMK6YlIYf4PAB20';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test connection function
export const testConnection = async () => {
  try {
    const { data, error } = await supabase.from('competitions').select('count');
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      return { success: false, error: error.message };
    }
    console.log('✅ Supabase connected successfully');
    return { success: true, data };
  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message || error);
    return { success: false, error: error.message || 'Connection failed' };
  }
};

