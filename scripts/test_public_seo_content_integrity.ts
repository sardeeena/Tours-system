import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.tsx');
const pages = read('../src/data/staticPages.ts');
const hero = read('../src/components/home/Hero.tsx');
const tourService = read('../src/services/tourService.ts');
const server = read('../server.ts');
const robots = read('../public/robots.txt');
const blogPage = read('../src/pages/BlogPage.tsx');
const cookieConsent = read('../src/components/common/CookieConsent.tsx');

const about = pages.slice(pages.indexOf("id: 'about'"), pages.indexOf("id: 'contact'"));
assert.match(about, /seoIndexable: true/, 'About fallback remains indexable');
assert.match(about, /Local support in Hurghada/, 'About page contains useful company context');
assert.match(about, /Clear information before you reserve/, 'About page explains how customers compare and book trips');
const contact = pages.slice(pages.indexOf("id: 'contact'"), pages.indexOf("id: 'why-us'"));
assert.ok(contact.split(/\\s+/).length >= 120, 'Contact page provides substantive visitor support information');
assert.match(contact, /preferred language/, 'Contact page explains language support without promising every tour is available in every language');
assert.match(contact, /booking reference/, 'Contact page explains what existing customers should provide when asking for help');
const aboutIndexabilityMigration = read('../supabase/migrations/20261116130000_about_page_indexability.sql');
assert.ok(aboutIndexabilityMigration.includes('UPDATE public.seo_metadata') && aboutIndexabilityMigration.includes("page_slug = 'about'") && aboutIndexabilityMigration.includes('robots_index = TRUE'), 'Migration corrects the stale About-page noindex database override');

assert.match(app, /\['about', 'privacy', 'terms', 'cancellation-policy', 'cookie-policy'\]/, 'About ignores stale CMS noindex overrides in client metadata');
assert.match(server, /override\?\.robots_index === false && !\(pageKind === 'static' && seoIdentifier === 'about'\)/, 'About ignores stale CMS noindex overrides in server-rendered HTML');
assert.match(server, /override\?\.robots_follow === false && !\(pageKind === 'static' && seoIdentifier === 'about'\)/, 'About remains followable in server-rendered HTML');

assert.doesNotMatch(hero, /Water 26°C|Water 25°C|Visibility 28m|Visibility 35m|Dolphin Pods Active|Sea Turtles Active/, 'hero does not publish unsupported live sea or wildlife conditions');
assert.match(hero, /tripLabel: 'Island day trips'/, 'hero uses evergreen activity labels instead of current-condition claims');

assert.match(tourService, /if \(toursError\)[\s\S]*?throw new Error\(`Unable to calculate published excursion counts:/, 'destination count failures are surfaced instead of silently showing zero');

assert.match(robots, /^User-agent: \*$/m, 'robots.txt contains a valid wildcard user-agent');
assert.match(robots, /^Sitemap: https:\/\/awesomeadventure\.tours\/sitemap\.xml$/m, 'robots.txt advertises the canonical sitemap');

const destinationStart = server.indexOf("if (path.startsWith('/destinations/'))");
const destinationRenderer = server.slice(destinationStart, server.indexOf("\n  } else {", destinationStart));
assert.match(destinationRenderer, /if \(activeDestination\)/, 'Published destination pages render even when they have no published excursions');
assert.doesNotMatch(destinationRenderer, /if \(activeDestination && destinationTours\.length > 0\)/, 'Destination rendering does not incorrectly turn empty published destinations into 404s');
assert.match(destinationRenderer, /There are no published excursions for this destination yet/, 'Empty destination pages provide useful crawlable fallback content');
assert.match(destinationRenderer, /noindex = destinationTours\.length < 2 && \(destinationDescription\.length \+ destinationTagline\.length\) < 650/, 'Thin destination pages remain noindex');
const sitemapDestinationStart = server.indexOf("const [destinationResult, tourDestinationResult]");
const sitemapDestinationEnd = server.indexOf("if (publicSupabase)", sitemapDestinationStart + 20);
const sitemapDestinationBlock = server.slice(sitemapDestinationStart, sitemapDestinationEnd);
const llmsDestinationStart = server.indexOf("## Published destinations");
const llmsDestinationBlock = server.slice(llmsDestinationStart, server.indexOf("## Published travel journal articles", llmsDestinationStart));
assert.match(sitemapDestinationBlock, /if \(!name \|\| seoExclusions\.entityIds\.has\('destination:' \+ String\(destination\.id\)\) \|\| \(tourCount < 2 && descriptionLength < 650\)\) continue/, 'Sitemap excludes unnamed, thin and explicitly noindex destinations consistently');
assert.match(llmsDestinationBlock, /if \(!name \|\| seoExclusions\.entityIds\.has\('destination:' \+ String\(destination\.id\)\) \|\| \(tourCount < 2 && descriptionLength < 650\)\) continue/, 'llms.txt excludes the same destinations as the sitemap');
assert.match(server, /app\.get\('\/sitemap\.xml'/, 'Public XML sitemap endpoint remains registered');
assert.match(server, /app\.get\('\/llms\.txt'/, 'AI discovery llms.txt endpoint remains registered');

assert.match(cookieConsent, /const GTM_ID = 'GTM-5SSVKB24'/, 'Cookie consent loads the newly confirmed Google Tag Manager container');
assert.doesNotMatch(cookieConsent, /GTM-MZVP38WC/, 'Retired Google Tag Manager container is no longer referenced');
assert.match(cookieConsent, /choices\.analytics \|\| choices\.marketing/, 'Google Tag Manager remains blocked until optional consent is granted');
assert.match(cookieConsent, /gtag\?\.\('consent', 'update'/, 'Google Consent Mode is updated when visitors save their preferences');
assert.match(blogPage, /getPublishedBlogPosts\(60\)/, 'Blog catalogue can display all 50 planned published articles');

console.log('Public SEO, blog catalogue and consent-aware analytics integrity checks passed.');
