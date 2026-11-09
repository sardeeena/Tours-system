import { runPlatformIntegrationSimulation } from '../src/services/platformIntegrationSimulator';

// Mock localStorage in Node environment if needed
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] || null,
    length: store.size,
  } as any;
}

async function main() {
  console.log('Starting 15-step Platform Integration Simulation test...\n');

  const report = await runPlatformIntegrationSimulation((step) => {
    const icon = step.status === 'passed' ? '✓' : step.status === 'failed' ? '✗' : '...';
    console.log(`[Step ${step.step}/15] ${icon} ${step.name} (${step.durationMs}ms)`);
    if (step.status === 'failed' && step.errorMessage) {
      console.error(`       Error: ${step.errorMessage}`);
    }
  });

  console.log('\n==================================================');
  console.log(`Simulation Result: ${report.success ? 'PASSED' : 'FAILED'}`);
  console.log(`Completed Steps: ${report.passedSteps} / ${report.totalSteps}`);
  console.log(`Total Duration: ${report.totalDurationMs}ms`);
  console.log('==================================================\n');

  if (!report.success) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
