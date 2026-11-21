import assert from 'node:assert/strict';
import { getTourAdultRateEur, getTourChildRateEur } from '../src/services/pricingService';

const privateTour = {
  tourType: 'Private' as const,
  priceEur: 24,
  childPriceEur: 10,
  privatePriceEur: 250,
};
assert.equal(getTourAdultRateEur(privateTour), 250, 'private adult display must use the private per-person rate');
assert.equal(getTourChildRateEur(privateTour), 250, 'private child display must use the same private per-person rate');

const sharedTour = {
  tourType: 'Shared' as const,
  priceEur: 24,
  childPriceEur: 10,
  privatePriceEur: 250,
};
assert.equal(getTourAdultRateEur(sharedTour), 24, 'shared adult display must use the shared adult rate');
assert.equal(getTourChildRateEur(sharedTour), 10, 'shared child display must use the configured child rate');

const sharedTourWithoutChildRate = {
  tourType: 'Shared' as const,
  priceEur: 24,
  privatePriceEur: 250,
};
assert.equal(getTourChildRateEur(sharedTourWithoutChildRate), 12, 'shared tours without a child rate retain the 50% fallback');

console.log('Private and shared tour price display consistency checks passed.');
