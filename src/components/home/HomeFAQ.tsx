import React from 'react';
import { HOMEPAGE_FAQS } from '../../services/seoConfig';

export function HomeFAQ() {
  return (
    <section
      id="faq"
      lang="en"
      aria-labelledby="home-faq-title"
      className="bg-slate-50 px-4 py-14 dark:bg-slate-950 sm:py-18"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-400">
            Booking help
          </p>
          <h2 id="home-faq-title" className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Practical answers about pickup, payment, cancellation terms and what each excursion includes.
          </p>
        </div>

        <div className="grid gap-3">
          {HOMEPAGE_FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm open:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:open:border-teal-700"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-semibold text-slate-900 marker:hidden dark:text-slate-100">
                <span>{faq.question}</span>
                <span aria-hidden="true" className="shrink-0 text-teal-700 transition-transform group-open:rotate-45 dark:text-teal-400">+</span>
              </summary>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
