import { useEffect } from 'react';

/**
 * One lightweight motion layer for the public site and admin workspace.
 * Content is only hidden for the brief reveal transition after JS has attached;
 * without IntersectionObserver (or when reduced motion is requested), it stays visible.
 */
export function SiteMotionSystem() {
  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionPreference.matches) return;

    const root = document.documentElement;
    const revealSelector = [
      '.public-site main > section',
      '.public-site main > div > section',
      '.public-site main > div > div > section',
      '.public-site main article',
      '.public-site main [data-motion="reveal"]',
      '.admin-shell .admin-content > section',
      '.admin-shell .admin-content > div',
      '.admin-shell .admin-content article',
      '.admin-shell [data-motion="reveal"]',
    ].join(',');

    root.classList.add('aat-motion-active');

    const isVisible = (element: HTMLElement) => {
      if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };

    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const element = entry.target as HTMLElement;
            element.classList.add('aat-visible');
            observer.unobserve(element);
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' })
      : null;

    const prepareRevealTargets = (scope: ParentNode) => {
      if (!observer) return;
      scope.querySelectorAll<HTMLElement>(revealSelector).forEach((element) => {
        if (element.dataset.motionReady === 'true' || !isVisible(element)) return;
        if (element.closest('[aria-hidden="true"], [data-no-motion]')) return;
        element.dataset.motionReady = 'true';
        element.classList.add('aat-reveal');
        observer.observe(element);
      });
    };

    prepareRevealTargets(document);

    const mutations = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches(revealSelector)) prepareRevealTargets(node.parentElement || document);
          else prepareRevealTargets(node);
        });
      });
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    const scrollToTarget = (target: HTMLElement, block: ScrollLogicalPosition = 'start') => {
      if (!isVisible(target)) return;
      target.scrollIntoView({
        behavior: motionPreference.matches ? 'auto' : 'smooth',
        block,
        inline: 'nearest',
      });
    };

    const handleDelegatedScroll = (event: MouseEvent) => {
      const origin = event.target;
      if (!(origin instanceof Element)) return;

      const explicitTrigger = origin.closest<HTMLElement>('[data-scroll-to]');
      if (explicitTrigger) {
        const requestedTarget = explicitTrigger.dataset.scrollTo?.trim();
        if (requestedTarget) {
          const targetId = requestedTarget.startsWith('#') ? requestedTarget.slice(1) : requestedTarget;
          const target = document.getElementById(targetId);
          if (target) requestAnimationFrame(() => scrollToTarget(target));
        }
        return;
      }

      const disclosure = origin.closest<HTMLElement>('[aria-controls]');
      if (!disclosure) return;
      const isTab = disclosure.getAttribute('role') === 'tab';
      const isOpening = disclosure.getAttribute('aria-expanded') !== 'false';
      if (!isTab && !isOpening) return;

      const targetId = disclosure.getAttribute('aria-controls')?.split(/\s+/)[0];
      if (!targetId) return;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const target = document.getElementById(targetId);
        if (!target || !isVisible(target)) return;
        const rect = target.getBoundingClientRect();
        const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
        if (!fullyVisible) scrollToTarget(target, 'nearest');
      }));
    };

    document.addEventListener('click', handleDelegatedScroll, true);

    return () => {
      document.removeEventListener('click', handleDelegatedScroll, true);
      mutations.disconnect();
      observer?.disconnect();
      root.classList.remove('aat-motion-active');
    };
  }, []);

  return null;
}
