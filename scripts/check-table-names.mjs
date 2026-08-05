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

const candidates = [
  'asistencias',
  'asistencia',
  'asistencia_diaria',
  'attendance',
  'attendance_records',
  'empleado_asistencias',
  'asistencia_empleado',
  'asistencia_registros',
  'registro_asistencia'
];

async function check() {
  for (const name of candidates) {
    try {
      const { data, error } = await supabase.from(name).select('id').limit(1);
      console.log('TABLE', name, 'error=', error ? JSON.stringify(error) : 'OK', 'data=', data ? data.length : 0);
    } catch (e) {
      console.error('EXCEPTION', name, e.message || e);
    }
  }
}

check();
