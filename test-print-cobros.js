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

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data: allCobros } = await supabase.from('cobros').select('*');
  console.log("Cobros stored in database:");
  allCobros.forEach(c => {
    console.log(`ID: ${c.id}, Servicio: ${c.servicio_nombre}, Mes: ${c.mes}, Estado: ${c.estado}, Monto: ${c.monto}`);
  });
}

test();
