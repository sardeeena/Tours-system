import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.tsx');
const pages = read('../src/data/staticPages.ts');
const hero = read('../src/components/home/Hero.tsx');
const tourService = read('../src/services/tourService.ts');
const server = read('../server.ts');
const robots = read('../public/robots.txt');

const about = pages.slice(pages.indexOf("id: 'about'"), pages.indexOf("id: 'contact'"));
assert.match(about, /seoIndexable: true/, 'About fallback remains indexable');
assert.match(about, /Local support in Hurghada/, 'About page contains useful company context');
assert.match(about, /Clear information before you reserve/, 'About page explains how customers compare and book trips');

assert.match(app, /\['about', 'privacy', 'terms', 'cancellation-policy', 'cookie-policy'\]/, 'About ignores stale CMS noindex overrides in client metadata');
assert.match(server, /override\?\.robots_index === false && !\(pageKind === 'static' && seoIdentifier === 'about'\)/, 'About ignores stale CMS noindex overrides in server-rendered HTML');
assert.match(server, /override\?\.robots_follow === false && !\(pageKind === 'static' && seoIdentifier === 'about'\)/, 'About remains followable in server-rendered HTML');

assert.doesNotMatch(hero, /Water 26°C|Water 25°C|Visibility 28m|Visibility 35m|Dolphin Pods Active|Sea Turtles Active/, 'hero does not publish unsupported live sea or wildlife conditions');
assert.match(hero, /tripLabel: 'Island day trips'/, 'hero uses evergreen activity labels instead of current-condition claims');

assert.match(tourService, /if \(toursError\)[\s\S]*?throw new Error\('Unable to calculate published excursion counts:/, 'destination count failures are surfaced instead of silently showing zero');

assert.match(robots, /^User-agent: \*$/m, 'robots.txt contains a valid wildcard user-agent');
assert.match(robots, /^Sitemap: https:\/\/awesomeadventure\.tours\/sitemap\.xml$/m, 'robots.txt advertises the canonical sitemap');

console.log('Public SEO and content integrity checks passed.');