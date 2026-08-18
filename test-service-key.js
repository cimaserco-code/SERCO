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

const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.log("No service role key found in .env.local");
  process.exit(0);
}

const supabase = createClient(env.VITE_SUPABASE_URL, serviceKey);

async function test() {
  console.log("Checking tables with Service Role Key (bypassing RLS)...");
  
  const { data: servicios, error: e1 } = await supabase.from('servicios').select('*');
  console.log("Servicios count (bypass RLS):", servicios ? servicios.length : 0, "Error:", e1?.message);
  if (servicios && servicios.length > 0) {
    console.log("Sample servicio:", servicios[0].nombre);
  }

  const { data: sedes, error: e2 } = await supabase.from('sedes').select('*');
  console.log("Sedes count (bypass RLS):", sedes ? sedes.length : 0, "Error:", e2?.message);
  if (sedes && sedes.length > 0) {
    console.log("Sample Sede:", sedes[0].nombre);
  }
}

test();
