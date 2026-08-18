import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function test() {
  console.log("Checking all profiles roles...");
  const { data, error } = await supabase.from('profiles').select('email, full_name, role');
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("All profiles:", data);
  }
}
test();
