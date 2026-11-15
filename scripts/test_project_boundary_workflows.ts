import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workflowsDirectory = '.github/workflows';
const workflowFiles = fs.readdirSync(workflowsDirectory)
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'));
const workflowContents = workflowFiles.map((name) => ({
  name,
  content: fs.readFileSync(path.join(workflowsDirectory, name), 'utf8'),
}));

const retiredMigrationWorkflow = '.github/workflows/migrate-supabase-database.yml';
assert.equal(
  fs.existsSync(retiredMigrationWorkflow),
  false,
  'the obsolete cross-project KemetSpirit-to-AwesomeAdventure data restore workflow must not exist',
);

for (const workflow of workflowContents) {
  assert.doesNotMatch(
    workflow.content,
    /mktrtoctcjyokclpdeui|SUPABASE_SOURCE_DB_URL|MIGRATE_TO_AWESOMEADVENTURE|KemetSpirit/i,
    `workflow ${workflow.name} must not contain retired cross-project migration references`,
  );
}

const supabaseConfig = fs.readFileSync('supabase/config.toml', 'utf8');
assert.match(
  supabaseConfig,
  /^project_id\s*=\s*"uvtbtpxtrrmaublrztgv"\s*$/m,
  'the repository must remain pinned to the Awesome Adventure Tours Supabase project',
);

console.log('Project boundary and retired migration workflow checks passed.');
