import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...rest] = line.split('=');
  if (!k) return acc;
  acc[k.trim()] = rest.join('=').trim();
  return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspect() {
  console.log("Running DB inspection via rpc('sql')...");
  
  // 1. Check Row Counts in DB (bypass RLS by using count(*) inside SQL query, which runs under Definer permissions on the DB!)
  const q1 = "SELECT 'sedes' as tbl, count(*) as count FROM sedes UNION SELECT 'servicios', count(*) FROM servicios UNION SELECT 'profiles', count(*) FROM profiles;";
  const { data: countData, error: e1 } = await supabase.rpc('sql', { query: q1 });
  console.log("Row counts directly from Postgres:", countData || e1?.message);

  // 2. Check if RLS is enabled and what policies exist
  const q2 = `
    SELECT schemaname, tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' AND tablename IN ('sedes', 'servicios', 'rondines', 'reportes_supervision');
  `;
  const { data: rlsData, error: e2 } = await supabase.rpc('sql', { query: q2 });
  console.log("RLS Status:", rlsData || e2?.message);

  const q3 = `
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename IN ('sedes', 'servicios', 'rondines', 'reportes_supervision');
  `;
  const { data: policiesData, error: e3 } = await supabase.rpc('sql', { query: q3 });
  console.log("Policies in DB:", policiesData || e3?.message);
}

inspect();
