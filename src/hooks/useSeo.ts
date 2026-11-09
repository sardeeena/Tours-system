import { useEffect } from 'react';
import { SeoMetadata, seoService } from '../services/seoService';

/**
 * Custom React hook to dynamically manage document head meta tags, OpenGraph, and Schema.org JSON-LD
 */
export function useSeo(metadata: SeoMetadata | null): void {
  useEffect(() => {
    if (!metadata) return;
    seoService.apply(metadata);
  }, [
    metadata?.title,
    metadata?.description,
    metadata?.canonicalUrl,
    metadata?.ogImage,
    metadata?.ogType,
  ]);
}
