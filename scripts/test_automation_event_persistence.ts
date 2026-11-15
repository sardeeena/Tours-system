import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/services/communicationService.ts', 'utf8');
const publishStart = source.indexOf('export async function publishAutomationEvent(');
const publishEnd = source.indexOf('\nexport async function listAutomationEvents(', publishStart);
assert.ok(publishStart >= 0 && publishEnd > publishStart, 'automation event publisher is present');
const publisher = source.slice(publishStart, publishEnd);

assert.match(publisher, /\.insert\(\{[\s\S]*?\}\)\s*\.select\('id'\)\s*\.single\(\)/, 'publisher retrieves the database-generated event UUID');
assert.match(publisher, /if \(error \|\| !data\?\.id\)[\s\S]*?throw new Error/, 'publisher fails visibly if the event cannot be persisted');
assert.match(publisher, /event\.id = data\.id/, 'publisher replaces the temporary event ID with the persisted UUID');
assert.match(publisher, /markAutomationEventProcessed\(event\.id/, 'publisher marks the exact persisted event row processed');

const markStart = source.indexOf('export async function markAutomationEventProcessed(');
const markEnd = source.indexOf('\n// ------------------------------------------------------------------------------', markStart);
assert.ok(markStart >= 0 && markEnd > markStart, 'automation processed marker is present');
const marker = source.slice(markStart, markEnd);
assert.match(marker, /\.eq\('id', eventId\)[\s\S]*?\.select\('id'\)/, 'processed marker verifies the database row update');
assert.match(marker, /if \(error\)[\s\S]*?throw new Error/, 'processed marker surfaces database update failures');
assert.match(marker, /if \(!data\?\.id\)[\s\S]*?throw new Error/, 'processed marker rejects unmatched event IDs');

console.log('Automation event persistence and acknowledgement regression checks passed.');
