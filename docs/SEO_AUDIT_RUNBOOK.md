# Production SEO audit runbook

The production audit runs from GitHub Actions after the release marker in `public/robots.txt` is visible, and every Monday at 04:17 UTC.

## What it checks

The Node-based crawler starts from every sitemap declared in `robots.txt`, follows sitemap indexes, and discovers additional same-site HTML links from crawled pages. It is capped at 110 pages to cover the current sitemap and the additional public URLs observed in the earlier OpenSEO crawl.

For each crawlable page it records:
- HTTP status and same-site redirect hops
- HTML title and meta description
- canonical URL and robots/noindex directives, including `X-Robots-Tag`
- language and hreflang values/targets
- H1 count
- JSON-LD presence and JSON parse errors
- internal links and sitemap pages that appear orphaned
- images missing an `alt` attribute
- duplicate titles, descriptions and canonical targets

The report is saved as `lighthouse-reports/seo-audit-report.json` and `lighthouse-reports/seo-audit-report.md`. Lighthouse mobile/desktop reports for the homepage, terms page and a representative excursion are uploaded in the same artifact.

## Crawl safety

- The crawler identifies itself as `AwesomeAdventureSiteAudit/1.0`.
- It honors robots.txt allow/disallow rules and applies at least a ten-second delay between page requests.
- It follows same-site redirects only, with a maximum of five hops.
- A 403 or 429 stops the crawl immediately. It does not retry around edge protection, impersonate a browser, use cookies, or bypass access controls.
- A blocked crawl produces a partial report and skips Lighthouse; it is not reported as a performance score.
- Critical HTTP, canonical, title and indexability issues fail the audit so they are visible in CI.

## Release marker

When a server/SEO release needs an immediate post-deployment audit, update the comment marker in `public/robots.txt` and the matching expected marker in `.github/workflows/lighthouse-production.yml`. The workflow waits for the production copy of that marker before crawling. The weekly scheduled audit checks the currently deployed production site.

## Interpretation

This crawler audits the URLs exposed through the site's sitemap and internal links; it does not prove that Google has indexed them. Use Google Search Console for indexing and real-user Core Web Vitals. Lighthouse results are lab measurements and should be compared across equivalent runs and devices. A blocked crawl is an access result, not an SEO failure score.
