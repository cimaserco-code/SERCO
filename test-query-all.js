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
  console.log("Checking tables...");
  
  const { data: rondines, error: e1 } = await supabase.from('rondines').select('*');
  console.log("Rondines count:", rondines ? rondines.length : 0, "Error:", e1?.message);

  const { data: reportes, error: e2 } = await supabase.from('reportes_supervision').select('*');
  console.log("Reportes count:", reportes ? reportes.length : 0, "Error:", e2?.message);

  const { data: servicios, error: e3 } = await supabase.from('servicios').select('*');
  console.log("Servicios count:", servicios ? servicios.length : 0, "Error:", e3?.message);
  if (servicios && servicios.length > 0) {
    console.log("Sample servicio:", servicios[0]);
  }

  const { data: profiles, error: e4 } = await supabase.from('profiles').select('*');
  console.log("Profiles count:", profiles ? profiles.length : 0, "Error:", e4?.message);
  if (profiles && profiles.length > 0) {
    console.log("Sample profile:", profiles[0]);
  }

  const { data: sedes, error: e5 } = await supabase.from('sedes').select('*');
  console.log("Sedes count:", sedes ? sedes.length : 0, "Error:", e5?.message);
}

test();
