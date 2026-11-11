import fs from 'fs';
import path from 'path';
import { newDb } from 'pg-mem';

async function testMigrations() {
  console.log('================================================================');
  console.log('Testing Migrations Sequence Execution in Memory');
  console.log('================================================================\n');

  const mem = newDb();

  // Register common extensions / schema mocks
  mem.public.registerFunction({
    name: 'gen_random_uuid',
    implementation: () => '11111111-2222-3333-4444-555555555555',
  });

  const pg = mem.adapters.createPg();
  const client = new pg.Client();
  await client.connect();

  // Create auth schema and auth.users table mock
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE,
      raw_user_meta_data JSONB,
      raw_app_meta_data JSONB,
      email_confirmed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const migrationsDir = path.resolve('supabase/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  console.log(`Found ${files.length} migration files.\n`);

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    console.log(`Executing migration: ${file}...`);
    try {
      await client.query(sql);
      console.log(`  ✓ Successfully executed ${file}`);
    } catch (err: any) {
      console.error(`  ✗ Error in ${file}: ${err.message}`);
    }
  }

  await client.end();
  console.log('\nMigration execution test complete.');
}

testMigrations().catch(console.error);
