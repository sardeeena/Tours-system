import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const sitemapStart = server.indexOf("app.get('/sitemap.xml'");
const llmsStart = server.indexOf("app.get('/llms.txt'");
const schemaStart = server.indexOf("const organization: Record<string, any>");
const schemaEnd = server.indexOf("const schema = JSON.stringify", schemaStart);
assert.ok(sitemapStart >= 0 && llmsStart > sitemapStart && schemaStart > llmsStart, 'Sitemap, llms.txt and JSON-LD generation are registered in order');

const sitemap = server.slice(sitemapStart, llmsStart);
const llms = server.slice(llmsStart, schemaStart);
const schema = server.slice(schemaStart, schemaEnd);

assert.match(server, /from\('seo_metadata'\)[\s\S]*?eq\('robots_index', false\)/, 'SEO index exclusions are loaded from the authoritative metadata table');
assert.match(sitemap, /loadAwesomeAdventureToursSeoIndexExclusions\(\)/, 'Sitemap applies SEO index exclusions');
assert.match(sitemap, /seoExclusions\.entityIds\.has\('tour:'/,'Sitemap excludes noindex tours');
assert.match(sitemap, /seoExclusions\.entityIds\.has\('destination:'/,'Sitemap excludes noindex destinations');
assert.match(sitemap, /seoExclusions\.pageSlugs\.has\(slug\)/,'Sitemap excludes noindex CMS and blog pages');
assert.match(llms, /loadAwesomeAdventureToursSeoIndexExclusions\(\)/, 'llms.txt uses the same SEO index exclusions');
assert.match(llms, /seoExclusions\.entityIds\.has\('tour:'/,'llms.txt excludes noindex tours');
assert.match(llms, /seoExclusions\.entityIds\.has\('destination:'/,'llms.txt excludes noindex destinations');
assert.match(llms, /seoExclusions\.pageSlugs\.has\(slug\)/,'llms.txt excludes noindex blog pages');

assert.match(schema, /areaServed: \[/, 'Business entity declares its verified service area');
assert.match(schema, /Hurghada New Marina, Berth B-14/, 'Business schema retains the verified public office address');
assert.match(schema, /\+201515212741/, 'Business schema retains the verified public telephone number');
assert.match(schema, /knowsAbout:/, 'Business entity declares its visible service expertise');
assert.match(schema, /'@type': 'BreadcrumbList'/, 'Public pages expose breadcrumb structured data');
assert.match(schema, /mainEntityId/, 'Page entities link to their primary tour, destination or article entity');
assert.match(schema, /'@type': 'WebPage'/, 'Every indexable public route receives a WebPage node');
assert.doesNotMatch(schema, /aggregateRating|reviewRating|openingHoursSpecification|priceRange|geo:/, 'Schema does not invent reviews, hours, prices or geographic coordinates');

const markdownHandlerStart = server.indexOf('const acceptsMarkdown');
const markdownHandlerEnd = server.indexOf("app.get('*'", markdownHandlerStart);
const markdownHandler = server.slice(markdownHandlerStart, markdownHandlerEnd);
assert.ok(markdownHandler.includes("lines.join('\\n')"), 'Homepage text/markdown response separates lines with real newline characters');
assert.ok(!markdownHandler.includes("lines.join('\\\\n')"), 'Homepage text/markdown response does not emit literal backslash-n sequences');

console.log('SEO/GEO sitemap, indexation and structured-data integrity checks passed.');
