import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/services/crmService.ts', import.meta.url), 'utf8');

function section(start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing function: ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Missing boundary after: ${start}`);
  return source.slice(startIndex, endIndex);
}

const listTasks = section('export async function listTasks', 'function filterTasksClient');
assert.match(listTasks, /if \(!isSupabaseConfigured\(\)\)[\s\S]*?if \(!import\.meta\.env\.DEV\)/);
assert.match(listTasks, /if \(error\) throw new Error\(formatSupabaseError\(error\)\)/);
assert.doesNotMatch(listTasks, /catch\s*\{/);

const createTask = section('export async function createTask', 'export async function updateTask');
assert.match(createTask, /assigned_staff_id: newTask\.assignedStaffId/);
assert.match(createTask, /if \(error\) throw new Error\(formatSupabaseError\(error\)\)/);
assert.match(createTask, /if \(!data\) throw new Error/);
assert.ok(createTask.indexOf(".from('crm_tasks')") < createTask.indexOf('setLocal(LOCAL_TASKS_KEY'));
assert.doesNotMatch(createTask, /catch\s*\{/);

const updateTask = section('export async function updateTask', 'export async function updateTaskStatus');
assert.match(updateTask, /assigned_staff_id: updates\.assignedStaffId/);
assert.match(updateTask, /\.select\('id'\)[\s\S]*?\.maybeSingle\(\)/);
assert.match(updateTask, /if \(error\) throw new Error\(formatSupabaseError\(error\)\)/);
assert.match(updateTask, /if \(!data\) throw new Error/);
assert.ok(updateTask.indexOf(".from('crm_tasks')") < updateTask.indexOf('setLocal(LOCAL_TASKS_KEY'));
assert.doesNotMatch(updateTask, /catch\s*\{/);

const updateTaskStatus = section('export async function updateTaskStatus', 'export async function deleteTask');
assert.match(updateTaskStatus, /'task_status_changed'/);

const deleteTask = section('export async function deleteTask', 'export async function getFollowUpsDue');
assert.match(deleteTask, /\.delete\(\)[\s\S]*?\.select\('id'\)[\s\S]*?\.maybeSingle\(\)/);
assert.match(deleteTask, /if \(error\) throw new Error\(formatSupabaseError\(error\)\)/);
assert.match(deleteTask, /if \(!data\) throw new Error/);
assert.ok(deleteTask.indexOf(".from('crm_tasks')") < deleteTask.indexOf('setLocal(LOCAL_TASKS_KEY'));
assert.doesNotMatch(deleteTask, /catch\s*\{/);

console.log('CRM task persistence integrity checks passed.');
