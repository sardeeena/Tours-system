import React from 'react';
import type { StaticPageContent } from '../services/siteSettingsService';

interface StaticContentPageProps {
  page: StaticPageContent;
}

export const StaticContentPage: React.FC<StaticContentPageProps> = ({ page }) => {
  const sections = Array.isArray(page.sections) ? page.sections : [];

  return (
    <main className="flex-1 bg-[#FAF8F5] dark:bg-[#0A1118]">
      <header className="bg-[#0A6C74] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.22em] font-semibold text-teal-100 mb-4">
            Traveler Information
          </p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight max-w-4xl">
            {page.heroHeadline || page.title}
          </h1>
          {page.heroSubtitle && (
            <p className="mt-5 text-sm sm:text-base leading-relaxed text-teal-50 max-w-3xl">
              {page.heroSubtitle}
            </p>
          )}
        </div>
      </header>

      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="mb-10 border-b border-stone-200 dark:border-stone-800 pb-6">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-white">
            {page.title}
          </h2>
          {page.lastUpdated && (
            <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
              Last updated: <time dateTime={page.lastUpdated}>{page.lastUpdated}</time>
            </p>
          )}
        </div>

        {sections.length > 0 ? (
          <div className="space-y-10">
            {sections.map((section, index) => (
              <section key={`${index}-${section.title}`}>
                <h3 className="font-display text-lg sm:text-xl font-semibold text-stone-900 dark:text-white mb-3">
                  {section.title}
                </h3>
                <p className="text-sm sm:text-base leading-8 text-stone-700 dark:text-stone-300 whitespace-pre-line">
                  {section.content}
                </p>
              </section>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-600 dark:text-stone-400">
            This page is being updated. Please contact our team if you need further information.
          </p>
        )}
      </article>
    </main>
  );
};
