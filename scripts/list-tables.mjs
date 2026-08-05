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

async function list() {
  const { data, error } = await supabase.rpc('sql', {
    query: "SELECT schemaname, tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename;"
  });
  console.log({ data, error });
}

list();
