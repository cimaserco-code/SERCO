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
  console.log("Querying information_schema and pg_policies...");
  
  // Querying pg_policies
  const { data: policies, error: e1 } = await supabase.from('profiles').select().limit(1); // just a dummy to check if we can query raw SQL using an RPC if any exists.
  
  // Wait, let's run an RPC if they have one, or just query pg_policies using public view if there is one.
  // Actually, we can use a query that selects policies from a system view pg_policies. Let's see if we can do that:
  const { data: pols, error: ep } = await supabase.rpc('execute_sql', { sql_query: 'select * from pg_policies' });
  if (ep) {
    console.log("No RPC execute_sql found, trying direct REST queries on views if exposed...");
  } else {
    console.log("Policies:", pols);
  }

  // Let's check RLS status for our tables:
  const query = `
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public';
  `;
  const { data: tables, error: et } = await supabase.rpc('execute_sql', { sql_query: query });
  if (tables) {
    console.log("Tables RLS status:", tables);
  }
}
test();
