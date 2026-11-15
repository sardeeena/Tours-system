import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

const cardStart = server.indexOf("app.get('/.well-known/mcp/server-card.json'");
const mcpStart = server.indexOf("app.post('/mcp'");
const mcpEnd = server.indexOf("app.all('/mcp'", mcpStart);
assert.ok(cardStart >= 0 && mcpStart > cardStart && mcpEnd > mcpStart, 'MCP server card and Streamable HTTP POST endpoint are registered');

const card = server.slice(cardStart, mcpStart);
const endpoint = server.slice(mcpStart, mcpEnd);

assert.match(card, /protocolVersion: '2025-06-18'/, 'MCP server card declares the supported protocol version');
assert.match(card, /transport: \{ type: 'streamable-http', endpoint: '\/mcp' \}/, 'MCP server card advertises the correct Streamable HTTP endpoint');
assert.match(card, /authentication: \{ required: false, schemes: \[\] \}/, 'Public read-only MCP endpoint does not claim authentication is required');
assert.match(card, /tools: AWESOME_ADVENTURE_TOURS_MCP_TOOLS/, 'MCP server card publishes the actual tool definitions');

assert.match(endpoint, /request\.jsonrpc !== '2\.0'/, 'MCP endpoint validates JSON-RPC 2.0 requests');
assert.match(endpoint, /request\.method === 'initialize'/, 'MCP initialize handshake is implemented');
assert.match(endpoint, /'2025-06-18', '2025-03-26'/, 'MCP supports the advertised protocol version and prior supported version');
assert.match(endpoint, /request\.method === 'notifications\/initialized'/, 'MCP initialized notification is handled');
assert.match(endpoint, /request\.method === 'ping'/, 'MCP ping is implemented');
assert.match(endpoint, /request\.method === 'tools\/list'/, 'MCP tools/list is implemented');
assert.match(endpoint, /request\.method !== 'tools\/call'/, 'MCP routes tools/call requests and rejects unsupported methods');
assert.match(endpoint, /rateLimit\(60, 60_000\)/, 'MCP endpoint has an explicit rate limit');

const toolDefinitionsStart = server.indexOf('const AWESOME_ADVENTURE_TOURS_MCP_TOOLS');
const toolDefinitionsEnd = server.indexOf("app.get('/.well-known/mcp/server-card.json'", toolDefinitionsStart);
const tools = server.slice(toolDefinitionsStart, toolDefinitionsEnd);
assert.match(tools, /name: 'search_published_excursions'/, 'Read-only published-excursion search tool is advertised');
assert.match(tools, /name: 'get_published_excursion'/, 'Read-only published-excursion detail tool is advertised');
assert.doesNotMatch(tools, /booking|payment|refund|customer|admin|delete|update|create/i, 'MCP tool definitions expose no booking, payment, customer or administrative actions');

assert.match(endpoint, /\.eq\('status', 'published'\)/, 'MCP data access is restricted to published excursions');
assert.match(endpoint, /\.eq\('slug', slug\)\.eq\('status', 'published'\)/, 'MCP detail lookup also enforces published status');
assert.match(endpoint, /if \(!\/\^\[a-z0-9\]/, 'MCP detail lookup validates excursion slugs');
assert.match(endpoint, /Unknown tool\. Use tools\/list to discover available tools\./, 'Unknown MCP tools fail closed');

console.log('MCP server-card, JSON-RPC, transport, rate-limit and read-only catalogue boundary checks passed.');
