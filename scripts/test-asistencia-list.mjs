import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => { const [k, ...rest] = line.split('='); if (!k) return acc; acc[k.trim()] = rest.join('=').trim(); return acc; }, {});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('asistencias').select('*').limit(1);
  console.log({data, error});
}
run();
