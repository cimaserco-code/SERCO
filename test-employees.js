import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Parse .env.local manually
const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("Checking empleados table columns...");
  const { data, error } = await supabase.from('empleados').select('*').limit(1);
  if (error) {
    console.error("Error fetching employees:", error);
  } else {
    console.log("Employees success count:", data?.length);
    if (data && data.length > 0) {
      console.log("Columns:", Object.keys(data[0]));
    }
  }
}

test();
