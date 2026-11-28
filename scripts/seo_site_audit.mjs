import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AUDIT_USER_AGENT = 'AwesomeAdventureSiteAudit/1.0 (+https://awesomeadventure.tours/)';
export const DEFAULT_MAX_PAGES = 110;

export function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
}

function stripMarkup(value = '') {
  return decodeHtml(String(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

export function parseAttributes(tag = '') {
  const attributes = {};
  const expression = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = expression.exec(tag)) !== null) {
    attributes[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function matchingTagTexts(html, tagName) {
  const expression = new RegExp('<' + tagName + '\\b[^>]*>([\\s\\S]*?)<\\/' + tagName + '\\s*>', 'gi');
  return [...String(html).matchAll(expression)].map((match) => stripMarkup(match[1]));
}

function findMeta(html, key, value) {
  const tags = String(html).match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const attrs = parseAttributes(tag);
    const actual = attrs[key]?.toLowerCase();
    if (actual === value.toLowerCase()) return attrs.content || '';
  }
  return '';
}

export function normalizePageUrl(value, baseUrl) {
  try {
    const url = new URL(value, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    url.search = '';
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return null;
  }
}

export function parseSitemapLocs(xml = '') {
  return [...String(xml).matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)]
    .map((match) => decodeHtml(match[1].trim()))
    .filter(Boolean);
}

export function parseRobots(text = '', userAgent = 'AwesomeAdventureSiteAudit') {
  const groups = [];
  let current = null;
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === 'user-agent') {
      if (!current || current.hasRules) {
        current = { agents: [], rules: [], crawlDelaySeconds: null, hasRules: false };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') {
      current.rules.push({ type: key, path: value });
      current.hasRules = true;
    } else if (key === 'crawl-delay' && Number.isFinite(Number(value))) {
      current.crawlDelaySeconds = Math.max(current.crawlDelaySeconds || 0, Number(value));
      current.hasRules = true;
    }
  }

  const normalizedAgent = userAgent.toLowerCase();
  const matching = groups.filter((group) => group.agents.some((agent) =>
    agent === '*' || normalizedAgent.includes(agent)
  ));
  const specificLength = Math.max(0, ...matching.flatMap((group) =>
    group.agents.filter((agent) => agent !== '*').map((agent) => agent.length)
  ));
  const selected = matching.filter((group) =>
    group.agents.some((agent) => agent === '*' || agent.length === specificLength)
  );
  const rules = selected.flatMap((group) => group.rules);
  // Respect the largest published crawl delay, even when it is scoped to another audit bot.
  const publishedDelay = Math.max(0, ...groups.map((group) => group.crawlDelaySeconds || 0));
  return { rules, crawlDelayMs: Math.max(10_000, publishedDelay * 1000) };
}

export function isAllowedByRobots(urlValue, rules = []) {
  let pathname;
  try { pathname = new URL(urlValue).pathname; } catch { return false; }
  const matching = rules
    .filter((rule) => rule.path && pathname.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length);
  if (matching.length === 0) return true;
  const bestLength = matching[0].path.length;
  const best = matching.filter((rule) => rule.path.length === bestLength);
  return best.some((rule) => rule.type === 'allow');
}

export function parseHtmlPage(html, pageUrl, baseHost) {
  const title = matchingTagTexts(html, 'title')[0] || '';
  const descriptions = findMeta(html, 'name', 'description');
  const robots = findMeta(html, 'name', 'robots').toLowerCase();
  const langMatch = String(html).match(/<html\b[^>]*>/i);
  const language = langMatch ? (parseAttributes(langMatch[0]).lang || '') : '';
  const canonicalTag = (String(html).match(/<link\b[^>]*>/gi) || []).find((tag) =>
    (parseAttributes(tag).rel || '').toLowerCase().split(/\s+/).includes('canonical')
  );
  const canonicalHref = canonicalTag ? parseAttributes(canonicalTag).href || '' : '';
  const canonical = canonicalHref ? normalizePageUrl(canonicalHref, pageUrl) : '';
  const h1 = matchingTagTexts(html, 'h1');
  const jsonLdTags = (String(html).match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || []);
  const jsonLdErrors = [];
  for (const tag of jsonLdTags) {
    const body = tag.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    try {
      const parsed = JSON.parse(body);
      if (!parsed || (typeof parsed !== 'object')) jsonLdErrors.push('JSON-LD root is not an object or array');
    } catch {
      jsonLdErrors.push('Invalid JSON-LD block');
    }
  }

  const internalLinks = new Set();
  for (const tag of String(html).match(/<a\b[^>]*>/gi) || []) {
    const href = parseAttributes(tag).href;
    if (!href || /^(?:mailto:|tel:|javascript:|data:)/i.test(href) || href.startsWith('#')) continue;
    const normalized = normalizePageUrl(href, pageUrl);
    if (!normalized) continue;
    try {
      const host = new URL(normalized).hostname.toLowerCase();
      if (host === baseHost || host === 'www.' + baseHost || host === baseHost.replace(/^www\./, '')) {
        internalLinks.add(normalized);
      }
    } catch { /* Invalid hrefs are ignored. */ }
  }

  return {
    title,
    description: descriptions,
    canonical,
    robots,
    language,
    h1Count: h1.length,
    h1: h1[0] || '',
    jsonLdCount: jsonLdTags.length,
    jsonLdErrors,
    hreflangLinks,
    hreflangErrors,
    imagesWithoutAlt,
    internalLinks: [...internalLinks],
    ogTitle: findMeta(html, 'property', 'og:title'),
    ogDescription: findMeta(html, 'property', 'og:description'),
    pageUrl,
  };
}

function sameSiteHost(hostname, baseHost) {
  const host = hostname.toLowerCase();
  const base = baseHost.toLowerCase().replace(/^www\./, '');
  return host === base || host === 'www.' + base;
}

async function fetchWithRedirect(url, baseHost, robotsRules = []) {
  let current = url;
  const redirects = [];
  for (let attempt = 0; attempt <= 5; attempt += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      headers: {
        'User-Agent': AUDIT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml,text/xml,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => {});
      if (!location) return { response, finalUrl: current, redirects, externalRedirect: null };
      const next = new URL(location, current);
      if (!sameSiteHost(next.hostname, baseHost)) {
        return { response, finalUrl: current, redirects, externalRedirect: next.toString() };
      }
      if (robotsRules.length && !isAllowedByRobots(next.toString(), robotsRules)) {
        return { response, finalUrl: current, redirects, disallowedRedirect: next.toString() };
      }
      redirects.push({ status: response.status, from: current, to: next.toString() });
      current = next.toString();
      continue;
    }
    return { response, finalUrl: current, redirects, externalRedirect: null };
  }
  return { response: null, finalUrl: current, redirects, externalRedirect: null, redirectLoop: true };
}

function addIssue(issues, severity, url, message) {
  issues.push({ severity, url, message });
}

function makeMarkdownReport(report) {
  const lines = [
    '# Awesome Adventure production SEO crawl',
    '',
    `- Run status: **${report.status}**`,
    `- Sitemap URLs discovered: ${report.sitemapUrlCount}`,
    `- Pages crawled: ${report.pagesCrawled}`,
    `- Additional internal pages discovered: ${report.discoveredUrlCount}`,
    `- Blocked by production edge: ${report.blocked ? 'yes' : 'no'}`,
    `- Critical issues: ${report.criticalCount}`,
    `- Warnings: ${report.warningCount}`,
    '',
    '## Issues',
    '',
  ];
  if (report.issues.length === 0) lines.push('No issues were detected in the pages that could be crawled.');
  else {
    for (const issue of report.issues) lines.push(`- **${issue.severity.toUpperCase()}** ${issue.url}: ${issue.message}`);
  }
  lines.push('', '## Page inventory', '', '| URL | HTTP | Redirects | Title | Canonical | H1s | JSON-LD | Hreflang |', '|---|---:|---:|---|---|---:|---:|');
  for (const page of report.pages) {
    lines.push(`| ${page.url} | ${page.status ?? 'blocked'} | ${page.redirectCount} | ${(page.title || '').replace(/\|/g, '\\|').slice(0, 70)} | ${page.canonical || 'missing'} | ${page.h1Count ?? 'n/a'} | ${page.jsonLdCount ?? 'n/a'} | ${page.hreflangLinks?.length ?? 'n/a'} |`);
  }
  lines.push('', 'A 403/429 response stops the crawl. The audit does not spoof browsers, bypass access controls, or retry around edge protection.', '');
  return lines.join('\n');
}

export async function runSiteAudit(options = {}) {
  const baseUrl = new URL(options.baseUrl || process.env.SEO_AUDIT_BASE_URL || 'https://awesomeadventure.tours');
  const baseHost = baseUrl.hostname.toLowerCase().replace(/^www\./, '');
  const maxPages = Number(options.maxPages || process.env.SEO_AUDIT_MAX_PAGES || DEFAULT_MAX_PAGES);
  const outputDir = options.outputDir || process.env.SEO_AUDIT_OUTPUT_DIR || 'lighthouse-reports';
  const issues = [];
  const pages = [];
  let blocked = false;
  let blockedStatus = null;
  let crawlDelayMs = 10_000;
  let robotsRules = [];
  let sitemapUrls = [];
  const discoveredUrls = new Set();

  const robotsResult = await fetchWithRedirect(new URL('/robots.txt', baseUrl).toString(), baseHost);
  if (!robotsResult.response || robotsResult.response.status !== 200) {
    const status = robotsResult.response?.status ?? null;
    if (status === 403 || status === 429) {
      blocked = true;
      blockedStatus = status;
      addIssue(issues, 'warning', '/robots.txt', `Production edge returned HTTP ${status}; crawl stopped without retrying or bypassing protection.`);
    } else {
      addIssue(issues, 'critical', '/robots.txt', `Unable to retrieve robots.txt (HTTP ${status ?? 'network error'}).`);
    }
  } else {
    const robotsText = await robotsResult.response.text();
    const robots = parseRobots(robotsText);
    robotsRules = robots.rules;
    crawlDelayMs = robots.crawlDelayMs;
    const sitemapCandidates = [...robotsText.matchAll(/^\s*Sitemap:\s*(\S+)\s*$/gim)].map((match) => match[1]);
    const pendingSitemaps = sitemapCandidates.length
      ? [...sitemapCandidates]
      : [new URL('/sitemap.xml', baseUrl).toString()];
    const seenSitemaps = new Set();
    while (pendingSitemaps.length && seenSitemaps.size < 10) {
      const currentSitemap = pendingSitemaps.shift();
      if (!currentSitemap || seenSitemaps.has(currentSitemap)) continue;
      seenSitemaps.add(currentSitemap);
      if (!isAllowedByRobots(currentSitemap, robotsRules)) {
        addIssue(issues, 'critical', currentSitemap, 'Sitemap location is disallowed by robots.txt.');
        continue;
      }
      const result = await fetchWithRedirect(currentSitemap, baseHost, robotsRules);
      if (!result.response || result.response.status !== 200) {
        const status = result.response?.status ?? null;
        if (status === 403 || status === 429) {
          blocked = true;
          blockedStatus = status;
          addIssue(issues, 'warning', currentSitemap, `Production edge returned HTTP ${status}; crawl stopped without retrying or bypassing protection.`);
          break;
        }
        addIssue(issues, 'critical', currentSitemap, `Sitemap request failed (HTTP ${status ?? 'network error'}).`);
        continue;
      }
      const xml = await result.response.text();
      const locs = parseSitemapLocs(xml);
      if (/\<sitemapindex\b/i.test(xml)) pendingSitemaps.push(...locs);
      else sitemapUrls.push(...locs);
    }

    const normalizedSitemap = [];
    for (const rawUrl of sitemapUrls) {
      const normalized = normalizePageUrl(rawUrl, baseUrl);
      if (!normalized) {
        addIssue(issues, 'critical', rawUrl, 'Invalid or non-HTTP sitemap URL.');
        continue;
      }
      if (!sameSiteHost(new URL(normalized).hostname, baseHost)) {
        addIssue(issues, 'critical', rawUrl, 'Sitemap contains a URL outside the canonical site host.');
        continue;
      }
      const parsedRawUrl = new URL(rawUrl, baseUrl);
      if (parsedRawUrl.search || parsedRawUrl.hash) {
        addIssue(issues, 'warning', rawUrl, 'Sitemap URL contains a query string or fragment.');
      }
      if (!isAllowedByRobots(normalized, robots.rules)) {
        addIssue(issues, 'critical', rawUrl, 'Sitemap includes a URL disallowed by robots.txt.');
        continue;
      }
      normalizedSitemap.push(normalized);
    }
    sitemapUrls = [...new Set(normalizedSitemap)];
  }

  if (sitemapUrls.length === 0 && !blocked) addIssue(issues, 'critical', '/sitemap.xml', 'No crawlable URLs were found in the sitemap.');
  const sitemapSet = new Set(sitemapUrls);
  const linkedTargets = new Set();
  const queue = blocked ? [] : [...sitemapUrls];
  const seen = new Set();
  const excludedPrefixes = ['/admin', '/api', '/my-booking', '/booking/confirmation', '/staff', '/login', '/register', '/auth'];

  while (queue.length && pages.length < maxPages) {
    const url = queue.shift();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    if (excludedPrefixes.some((prefix) => new URL(url).pathname.startsWith(prefix))) continue;
    if (pages.length > 0) await new Promise((resolve) => setTimeout(resolve, crawlDelayMs));

    let result;
    try {
      result = await fetchWithRedirect(url, baseHost, robotsRules);
    } catch (error) {
      addIssue(issues, 'critical', url, `Network request failed: ${error instanceof Error ? error.message : 'unknown error'}.`);
      pages.push({ url, status: null, redirectCount: 0, title: '', canonical: '', h1Count: null, jsonLdCount: null });
      continue;
    }

    if (!result.response) {
      addIssue(issues, 'critical', url, 'Too many redirects or no HTTP response.');
      pages.push({ url, status: null, redirectCount: result.redirects.length, title: '', canonical: '', h1Count: null, jsonLdCount: null });
      continue;
    }

    const status = result.response.status;
    if (status === 403 || status === 429) {
      blocked = true;
      blockedStatus = status;
      addIssue(issues, 'warning', url, `Production edge returned HTTP ${status}; crawl stopped without retrying or bypassing protection.`);
      pages.push({ url, status, redirectCount: result.redirects.length, title: '', canonical: '', h1Count: null, jsonLdCount: null });
      break;
    }

    const contentType = result.response.headers.get('content-type') || '';
    const page = {
      url,
      finalUrl: result.finalUrl,
      status,
      redirectCount: result.redirects.length,
      contentType,
      title: '',
      description: '',
      canonical: '',
      robots: '',
      language: '',
      h1Count: null,
      h1: '',
      jsonLdCount: null,
      internalLinks: [],
    };

    if (result.externalRedirect) {
      addIssue(issues, 'warning', url, `Redirects outside the site to ${result.externalRedirect}.`);
      await result.response.body?.cancel().catch(() => {});
      pages.push(page);
      continue;
    }
    if (result.disallowedRedirect) {
      addIssue(issues, 'warning', url, `Redirect target is disallowed by robots.txt: ${result.disallowedRedirect}.`);
      await result.response.body?.cancel().catch(() => {});
      pages.push(page);
      continue;
    }
    if (status < 200 || status >= 300) {
      addIssue(issues, 'critical', url, `HTTP ${status} returned for a public crawl URL.`);
      await result.response.body?.cancel().catch(() => {});
      pages.push(page);
      continue;
    }
    if (result.redirects.length > 1) addIssue(issues, 'warning', url, `Redirect chain contains ${result.redirects.length} hops.`);
    if (result.redirects.length > 0 && sitemapSet.has(url)) addIssue(issues, 'warning', url, 'Sitemap URL redirects instead of resolving directly.');
    if (!contentType.toLowerCase().includes('text/html')) {
      addIssue(issues, 'warning', url, `Expected HTML but received ${contentType || 'an unknown content type'}.`);
      await result.response.body?.cancel().catch(() => {});
      pages.push(page);
      continue;
    }

    const html = await result.response.text();
    const parsed = parseHtmlPage(html, result.finalUrl, baseHost);
    Object.assign(page, parsed);
    const xRobotsTag = result.response.headers.get('x-robots-tag') || '';
    if (xRobotsTag) page.robots = [page.robots, xRobotsTag].filter(Boolean).join(', ').toLowerCase();
    if (!page.title) addIssue(issues, 'critical', url, 'Missing HTML title.');
    else if (page.title.length < 25 || page.title.length > 65) addIssue(issues, 'warning', url, `Title length is ${page.title.length} characters.`);
    if (!page.description) addIssue(issues, 'warning', url, 'Missing meta description.');
    else if (page.description.length < 70 || page.description.length > 160) addIssue(issues, 'warning', url, `Meta description length is ${page.description.length} characters.`);
    if (!page.canonical) addIssue(issues, 'critical', url, 'Missing canonical link.');
    else if (page.canonical !== normalizePageUrl(result.finalUrl, baseUrl)) addIssue(issues, 'critical', url, `Canonical does not match final URL (${page.canonical}).`);
    if (/\bnoindex\b/i.test(page.robots) && sitemapSet.has(url)) addIssue(issues, 'critical', url, 'URL is present in sitemap but declares noindex.');
    if (page.h1Count !== 1) addIssue(issues, 'warning', url, `Expected one H1 but found ${page.h1Count}.`);
    if (page.jsonLdErrors?.length) addIssue(issues, 'warning', url, page.jsonLdErrors.join('; '));
    if (page.hreflangErrors?.length) addIssue(issues, 'warning', url, page.hreflangErrors.join('; '));
    if (page.imagesWithoutAlt > 0) addIssue(issues, 'warning', url, `${page.imagesWithoutAlt} image(s) are missing an alt attribute.`);
    for (const link of page.internalLinks) {
      linkedTargets.add(link);
      if (!seen.has(link) && !queue.includes(link) && !sitemapSet.has(link) &&
          !excludedPrefixes.some((prefix) => new URL(link).pathname.startsWith(prefix)) &&
          isAllowedByRobots(link, robotsRules)) {
        discoveredUrls.add(link);
        queue.push(link);
      }
    }
    pages.push(page);
    if (pages.length >= maxPages && queue.length) addIssue(issues, 'warning', url, `Crawl stopped at the configured ${maxPages}-page limit.`);
  }

  const titleGroups = new Map();
  const descriptionGroups = new Map();
  const canonicalGroups = new Map();
  for (const page of pages) {
    if (page.title) titleGroups.set(page.title, [...(titleGroups.get(page.title) || []), page.url]);
    if (page.description) descriptionGroups.set(page.description, [...(descriptionGroups.get(page.description) || []), page.url]);
    if (page.canonical) canonicalGroups.set(page.canonical, [...(canonicalGroups.get(page.canonical) || []), page.url]);
  }
  for (const [title, urls] of titleGroups) if (urls.length > 1) addIssue(issues, 'warning', urls[0], `Duplicate title appears on ${urls.length} pages: ${title.slice(0, 90)}.`);
  for (const [description, urls] of descriptionGroups) if (urls.length > 1) addIssue(issues, 'warning', urls[0], `Duplicate meta description appears on ${urls.length} pages: ${description.slice(0, 90)}.`);
  for (const [canonical, urls] of canonicalGroups) if (urls.length > 1) addIssue(issues, 'warning', urls[0], `Multiple pages share canonical ${canonical}.`);

  const orphanSitemapUrls = sitemapUrls.filter((url) => url !== new URL('/', baseUrl).toString() && !linkedTargets.has(url));
  for (const url of orphanSitemapUrls) addIssue(issues, 'warning', url, 'Sitemap URL was not linked from another crawled page.');

  const criticalCount = issues.filter((issue) => issue.severity === 'critical').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: baseUrl.toString(),
    userAgent: AUDIT_USER_AGENT,
    crawlDelayMs,
    maxPages,
    status: blocked ? 'blocked-partial' : criticalCount ? 'issues-found' : 'complete',
    blocked,
    blockedStatus,
    sitemapUrlCount: sitemapUrls.length,
    pagesCrawled: pages.length,
    discoveredUrlCount: discoveredUrls.size,
    orphanSitemapUrlCount: orphanSitemapUrls.length,
    criticalCount,
    warningCount,
    issues,
    pages,
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'seo-audit-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outputDir, 'seo-audit-report.md'), makeMarkdownReport(report));
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `blocked=${blocked ? 'true' : 'false'}\n`);
  }
  console.log(makeMarkdownReport(report));
  if (criticalCount > 0) process.exitCode = 1;
  return report;
}

const scriptPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (scriptPath && fileURLToPath(import.meta.url) === scriptPath) {
  runSiteAudit().catch((error) => {
    console.error('Production SEO crawl failed:', error);
    process.exitCode = 1;
  });
}
