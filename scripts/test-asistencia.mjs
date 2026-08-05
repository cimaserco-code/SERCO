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

if (!url || !anon) {
  console.error('Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(url, anon);

async function test() {
  const payload = {
    empleado_id: '00000000-0000-0000-0000-000000000000',
    fecha: '2026-07-30',
    estado: 'asistió'
  };
  try {
    const { data, error } = await supabase.from('asistencias').insert(payload).select().single();
    if (error) {
      console.error('Supabase error full:', JSON.stringify(error, null, 2));
      process.exit(2);
    }
    console.log('Inserted:', data);
  } catch (e) {
    console.error('Exception:', e);
    process.exit(3);
  }
}

test();
