import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...rest] = line.split('=');
  if (!k) return acc;
  acc[k.trim()] = rest.join('=').trim();
  return acc;
}, {});

const url = env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, anon);

const tables = ['empleados','servicios','cobros','documentos','egresos','roles','sedes'];

async function check() {
  for (const name of tables) {
    try {
      const { data, error } = await supabase.from(name).select('id').limit(1);
      console.log('TABLE', name, 'error=', error ? JSON.stringify(error) : 'OK', 'len=', data ? data.length : 0);
    } catch (e) {
      console.error('EXC', name, e.message || e);
    }
  }
}

check();
