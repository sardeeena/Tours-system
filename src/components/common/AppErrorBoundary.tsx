import React from 'react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Application render failure]', error, info.componentStack);
  }

  private recover = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main
          role="alert"
          className="min-h-screen flex items-center justify-center bg-[#FAF8F5] px-5 py-12 text-[#111A24] dark:bg-[#0A1118] dark:text-slate-100"
        >
          <section className="w-full max-w-xl rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-[#111E2E]">
            <h1 className="font-display text-2xl font-bold">This page could not be displayed</h1>
            <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-slate-300">
              Something interrupted the page. Reload to try again. Your booking details have not been submitted by this recovery screen.
            </p>
            <button
              type="button"
              onClick={this.recover}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0A6C74] px-6 py-3 text-sm font-semibold text-white hover:bg-[#08565C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D838C]"
            >
              Reload page
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
