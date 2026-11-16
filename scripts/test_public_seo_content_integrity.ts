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
const appConfig = read('../src/config/appConfig.ts');

const about = pages.slice(pages.indexOf("id: 'about'"), pages.indexOf("id: 'contact'"));
assert.match(about, /seoIndexable: true/, 'About fallback remains indexable');
assert.match(about, /Local support in Hurghada/, 'About page contains useful company context');
assert.match(about, /Clear information before you reserve/, 'About page explains how customers compare and book trips');
assert.ok(appConfig.includes('2nd floor, Bostan Cafe, Madres, Hurghada') && !appConfig.includes('Berth B-14'), 'Booking support uses the current Hurghada office location');
const contact = pages.slice(pages.indexOf("id: 'contact'"), pages.indexOf("id: 'why-us'"));
assert.ok(contact.length >= 1000, 'Contact page provides substantive visitor support information');
assert.match(contact, /preferred language/, 'Contact page explains language support without promising every tour is available in every language');
assert.match(contact, /booking reference/, 'Contact page explains what existing customers should provide when asking for help');
const aboutIndexabilityMigration = read('../supabase/migrations/20261116130000_about_page_indexability.sql');
assert.ok(aboutIndexabilityMigration.includes('UPDATE public.seo_metadata') && aboutIndexabilityMigration.includes("page_slug = 'about'") && aboutIndexabilityMigration.includes('robots_index = TRUE'), 'Migration corrects the stale About-page noindex database override');
assert.ok(aboutIndexabilityMigration.includes('meta_description ='), 'Migration replaces the stale generic About-page description');
const tourDetailStart = app.indexOf('// Dynamic Tour for TourDetailPage');
const tourDetailEnd = app.indexOf('// Synchronize document title', tourDetailStart);
const tourDetailEffect = app.slice(tourDetailStart, tourDetailEnd);
assert.ok(tourDetailEffect.includes('let isCurrent = true;'), 'Tour detail lookup tracks the active route');
assert.ok(tourDetailEffect.includes('current?.slug === tourDetailSlug ? current : null'), 'Changing tour routes clears content belonging to a different slug');
assert.ok(tourDetailEffect.includes('if (!isCurrent) return;'), 'Late responses from an inactive tour route are ignored');
assert.ok(tourDetailEffect.includes('fullTour?.slug === tourDetailSlug'), 'Fetched tour data must match the requested route slug');
assert.ok(app.includes('if (currentTourDetail && currentTourDetail.slug === tourDetailSlug)'), 'The page never renders a previous tour under a new URL');
const tourDataMigration = read('../supabase/migrations/20261116140000_tour_catalogue_data_integrity.sql');
assert.ok(tourDataMigration.includes("array_replace(languages, 'Italy', 'Italian')"), 'Migration corrects the Italian tour-language label');
assert.ok(tourDataMigration.includes("pickup_info = 'Complimentary lobby pickup and return across Sharm El Sheikh included.'"), 'Migration corrects the Sharm city-tour pickup region');
assert.ok(tourDataMigration.includes("duration = 'Half Day (approx. 3 hours)'"), 'Migration normalizes three-hour half-day labels');
assert.ok(tourDataMigration.includes("duration = 'Half Day (approx. 5 hours)'"), 'Migration normalizes the five-hour half-day label');


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
const tourRendererStart = server.indexOf("} else if (path.startsWith('/excursions/'))");
const tourRendererEnd = server.indexOf("} else if (path === '/blog')", tourRendererStart);
const tourRenderer = server.slice(tourRendererStart, tourRendererEnd);
assert.ok(tourRenderer.includes('tour_images(image_url,alt_text,is_primary,sort_order)') && tourRenderer.includes('tour_itinerary(time,title,description,sort_order)'), 'Tour HTML loads SEO-visible related content in one joined query');
assert.ok(!tourRenderer.includes('Promise.all([') && !tourRenderer.includes('relationQueries'), 'Tour HTML avoids repeated relation round trips');


assert.match(cookieConsent, /const GTM_ID = 'GTM-5SSVKB24'/, 'Cookie consent loads the newly confirmed Google Tag Manager container');
assert.doesNotMatch(cookieConsent, /GTM-MZVP38WC/, 'Retired Google Tag Manager container is no longer referenced');
assert.match(cookieConsent, /choices\.analytics \|\| choices\.marketing/, 'Google Tag Manager remains blocked until optional consent is granted');
assert.match(cookieConsent, /gtag\?\.\('consent', 'update'/, 'Google Consent Mode is updated when visitors save their preferences');
assert.match(blogPage, /getPublishedBlogPosts\(60\)/, 'Blog catalogue can display all 50 planned published articles');
const blogSeoStart = app.indexOf("if (currentPath.startsWith('/blog/'))");
const blogSeoEnd = app.indexOf("if (['/login'", blogSeoStart);
const blogSeoRoute = app.slice(blogSeoStart, blogSeoEnd);
assert.ok(!blogSeoRoute.includes('seoService.apply'), 'App does not overwrite article-specific server SEO with a generic blog title');
assert.ok(blogPage.includes('article.seo_title') && blogPage.includes('article.seo_description'), 'Blog articles apply their own stored SEO title and description');


console.log('Public SEO, blog catalogue and consent-aware analytics integrity checks passed.');
