import React from 'react';
import { Destination, Tour, CurrencyConfig } from '../types';

interface DestinationDetailPageProps {
  destination: Destination;
  tours: Tour[];
  currency: CurrencyConfig;
  onViewTour: (tour: Tour) => void;
  onBookTour: (tour: Tour) => void;
  onViewAllExcursions: () => void;
}

function displayPrice(tour: Tour, currency: CurrencyConfig): string {
  const amount = tour.priceEur / (currency.rateToEur || 1);
  const formatted = new Intl.NumberFormat('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currency.symbol}${formatted}`;
}

export const DestinationDetailPage: React.FC<DestinationDetailPageProps> = ({
  destination,
  tours,
  currency,
  onViewTour,
  onBookTour,
  onViewAllExcursions,
}) => {
  const title = `Excursions in ${destination.name}`;
  const description = destination.description || destination.tagline;

  return (
    <main className="min-h-screen bg-[#FAF8F5] text-stone-900">
      <section className="relative overflow-hidden bg-[#102B35] text-white">
        {destination.image && (
          <img
            src={destination.image}
            alt={destination.name}
            className="absolute inset-0 h-full w-full object-cover opacity-25"
            loading="eager"
          />
        )}
        <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <nav aria-label="Breadcrumb" className="mb-5 text-sm text-white/75">
            <a href="/" className="hover:text-white">Home</a>
            <span className="mx-2">/</span>
            <a href="/excursions" className="hover:text-white">Excursions</a>
            <span className="mx-2">/</span>
            <span aria-current="page">{destination.name}</span>
          </nav>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#A9D8D8]">
            Egypt · Red Sea
          </p>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight sm:text-6xl">
            {title}
          </h1>
          {destination.tagline && (
            <p className="mt-4 max-w-2xl text-lg font-medium text-white/90">
              {destination.tagline}
            </p>
          )}
          {description && (
            <p className="mt-4 max-w-3xl text-base leading-8 text-white/80">
              {description}
            </p>
          )}
          <div className="mt-7 flex flex-wrap items-center gap-3 text-sm text-white/75">
            <span>{destination.tourCount} published {destination.tourCount === 1 ? 'excursion' : 'excursions'}</span>
            {destination.distanceFromAirport && (
              <>
                <span aria-hidden="true">•</span>
                <span>Airport information: {destination.distanceFromAirport}</span>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#0A6C74]">
              Published experiences
            </p>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              Available excursions in {destination.name}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
              Compare the currently published trips for this destination. Open each excursion to review its own price, duration, itinerary, pickup information and booking conditions.
            </p>
          </div>
          <button
            type="button"
            onClick={onViewAllExcursions}
            className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-[#0A6C74] hover:text-[#0A6C74]"
          >
            Browse all excursions
          </button>
        </div>

        {tours.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {tours.map((tour) => (
              <article
                key={tour.id}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                {tour.primaryImage && (
                  <a
                    href={`/excursions/${tour.slug}`}
                    onClick={(event) => { event.preventDefault(); onViewTour(tour); }}
                    className="block"
                    aria-label={`View ${tour.title}`}
                  >
                    <img
                      src={tour.primaryImage}
                      alt={tour.title}
                      className="h-52 w-full object-cover"
                      loading="lazy"
                    />
                  </a>
                )}
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#0A6C74]">
                    {tour.category || 'Excursion'}
                  </p>
                  <h3 className="mt-2 text-xl font-bold leading-snug">
                    <a
                      href={`/excursions/${tour.slug}`}
                      onClick={(event) => { event.preventDefault(); onViewTour(tour); }}
                      className="hover:text-[#0A6C74]"
                    >
                      {tour.title}
                    </a>
                  </h3>
                  {tour.shortDescription && (
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-stone-600">
                      {tour.shortDescription}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-stone-100 pt-4 text-sm">
                    {tour.durationLabel && <span className="text-stone-600">{tour.durationLabel}</span>}
                    <strong className="text-stone-900">From {displayPrice(tour, currency)}</strong>
                  </div>
                  <div className="mt-5 flex gap-3">
                    <a
                      href={`/excursions/${tour.slug}`}
                      onClick={(event) => { event.preventDefault(); onViewTour(tour); }}
                      className="flex-1 rounded-full bg-[#0A6C74] px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-[#08565C]"
                    >
                      View details
                    </a>
                    <button
                      type="button"
                      onClick={() => onBookTour(tour)}
                      className="rounded-full border border-stone-300 px-4 py-2.5 text-sm font-semibold transition hover:border-[#0A6C74] hover:text-[#0A6C74]"
                    >
                      Book
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
            <h3 className="text-lg font-semibold">No published excursions for this destination yet</h3>
            <p className="mt-2 text-sm text-stone-600">
              Browse the full catalogue for other currently available experiences.
            </p>
            <button
              type="button"
              onClick={onViewAllExcursions}
              className="mt-5 rounded-full bg-[#0A6C74] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#08565C]"
            >
              Browse all excursions
            </button>
          </div>
        )}
      </section>
    </main>
  );
};
