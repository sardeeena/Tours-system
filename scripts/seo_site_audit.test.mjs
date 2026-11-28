import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  decodeHtml,
  evaluatePageSeoIssues,
  isAllowedByRobots,
  isSafeSameSiteUrl,
  normalizePageUrl,
  parseAttributes,
  parseHtmlPage,
  parseRobots,
  parseSitemapLocs,
} from './seo_site_audit.mjs';

test('decodes sitemap and HTML entities safely', () => {
  assert.equal(decodeHtml('A &amp; B &quot;quoted&quot;'), 'A & B "quoted"');
});

test('parses absolute sitemap locations and encoded ampersands', () => {
  const locs = parseSitemapLocs('<urlset><url><loc>https://example.com/tour?a=1&amp;b=2</loc></url></urlset>');
  assert.deepEqual(locs, ['https://example.com/tour?a=1&b=2']);
});

test('normalizes page URLs without query strings, fragments or trailing slashes', () => {
  assert.equal(
    normalizePageUrl('/destinations/sharm/?utm_source=test#top', 'https://example.com'),
    'https://example.com/destinations/sharm'
  );
});

test('only permits HTTP(S) sitemap targets on the canonical site host', () => {
  assert.equal(isSafeSameSiteUrl('https://example.com/sitemap.xml', 'example.com'), true);
  assert.equal(isSafeSameSiteUrl('https://www.example.com/sitemap.xml', 'example.com'), true);
  assert.equal(isSafeSameSiteUrl('https://attacker.example/sitemap.xml', 'example.com'), false);
  assert.equal(isSafeSameSiteUrl('http://127.0.0.1/private', 'example.com'), false);
  assert.equal(isSafeSameSiteUrl('file:///etc/passwd', 'example.com'), false);
  assert.equal(isSafeSameSiteUrl('not a URL', 'example.com'), false);
});

test('parses robots rules and honors the longest allow/disallow match', () => {
  const robots = parseRobots([
    'User-agent: OpenSEO-Audit',
    'Crawl-delay: 10',
    '',
    'User-agent: *',
    'Disallow: /admin',
    'Allow: /admin/public',
    'Disallow: /api/',
  ].join('\n'));
  assert.equal(robots.crawlDelayMs, 10_000);
  assert.equal(isAllowedByRobots('https://example.com/admin/users', robots.rules), false);
  assert.equal(isAllowedByRobots('https://example.com/admin/public/help', robots.rules), true);
  assert.equal(isAllowedByRobots('https://example.com/api/health', robots.rules), false);
  assert.equal(isAllowedByRobots('https://example.com/destinations', robots.rules), true);
});

test('parses canonical, metadata, heading, hreflang, JSON-LD and internal links', () => {
  const html = `<!doctype html>
    <html lang="en">
      <head>
        <title>Responsible Red Sea Snorkeling Guide</title>
        <meta name="description" content="A practical guide to safe and responsible Red Sea snorkeling for visitors and families.">
        <link rel="canonical" href="https://example.com/guides/reef">
        <link rel="alternate" hreflang="en" href="https://example.com/guides/reef">
        <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>
      </head>
      <body>
        <h1>Reef guide</h1>
        <img src="/reef.jpg" alt="Snorkeler above a reef">
        <img src="/boat.jpg">
        <a href="/destinations/sharm/">Sharm</a>
        <a href="https://external.example/path">External</a>
      </body>
    </html>`;
  const page = parseHtmlPage(html, 'https://example.com/guides/reef', 'example.com');
  assert.equal(page.title, 'Responsible Red Sea Snorkeling Guide');
  assert.match(page.description, /responsible Red Sea snorkeling/);
  assert.equal(page.canonical, 'https://example.com/guides/reef');
  assert.equal(page.language, 'en');
  assert.equal(page.h1Count, 1);
  assert.equal(page.jsonLdCount, 1);
  assert.deepEqual(page.jsonLdErrors, []);
  assert.equal(page.hreflangLinks.length, 1);
  assert.deepEqual(page.hreflangErrors, []);
  assert.equal(page.imagesWithoutAlt, 1);
  assert.deepEqual(page.internalLinks, ['https://example.com/destinations/sharm']);
});

test('parses HTML attributes independent of quote style and case', () => {
  assert.deepEqual(parseAttributes('<META NAME=description content=hello>'), {
    name: 'description',
    content: 'hello',
  });
});


test('production Lighthouse workflow checks out the repository before running the local SEO crawler', () => {
  const workflow = readFileSync(new URL('../.github/workflows/lighthouse-production.yml', import.meta.url), 'utf8');
  const checkoutIndex = workflow.indexOf('uses: actions/checkout@v7');
  const crawlerIndex = workflow.indexOf('node scripts/seo_site_audit.mjs');
  assert.ok(checkoutIndex >= 0, 'Lighthouse workflow must check out the repository');
  assert.ok(crawlerIndex > checkoutIndex, 'SEO crawler must run after repository checkout');
});


test('noindex transactional routes are not audited as indexable pages when absent from the sitemap', () => {
  const issues = [];
  const page = { robots: 'noindex,nofollow', title: '', description: '', canonical: 'https://example.com/', h1Count: 0, jsonLdErrors: [], hreflangErrors: [], imagesWithoutAlt: 0 };
  evaluatePageSeoIssues(page, 'https://example.com/booking', new Set(), issues, 'https://example.com/booking', 'https://example.com');
  assert.deepEqual(issues, []);
});

test('noindex routes included in the sitemap remain a critical SEO failure', () => {
  const issues = [];
  const url = 'https://example.com/booking';
  const page = { robots: 'noindex,nofollow', title: '', description: '', canonical: 'https://example.com/', h1Count: 0 };
  evaluatePageSeoIssues(page, url, new Set([url]), issues, url, 'https://example.com');
  assert.equal(issues.length, 1);
  assert.equal(issues[0].severity, 'critical');
  assert.match(issues[0].message, /present in sitemap but declares noindex/);
});
