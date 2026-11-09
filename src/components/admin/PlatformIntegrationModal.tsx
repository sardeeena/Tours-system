import React, { useState } from 'react';
import {
  ShieldCheck,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  Database,
  ArrowRight,
  X
} from 'lucide-react';
import {
  runPlatformIntegrationSimulation,
  SimulationReport,
  SimulationStepResult
} from '../../services/platformIntegrationSimulator';

interface PlatformIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlatformIntegrationModal: React.FC<PlatformIntegrationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<SimulationReport | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});

  if (!isOpen) return null;

  const handleRunSimulation = async () => {
    setIsRunning(true);
    setReport(null);
    try {
      const res = await runPlatformIntegrationSimulation((step) => {
        setReport((prev) => {
          const currentSteps = prev ? [...prev.steps] : [];
          const idx = currentSteps.findIndex((s) => s.step === step.step);
          if (idx !== -1) {
            currentSteps[idx] = step;
          } else {
            currentSteps.push(step);
          }
          return {
            success: currentSteps.every((s) => s.status === 'passed'),
            totalSteps: 15,
            passedSteps: currentSteps.filter((s) => s.status === 'passed').length,
            failedSteps: currentSteps.filter((s) => s.status === 'failed').length,
            totalDurationMs: 0,
            runAt: new Date().toISOString(),
            steps: currentSteps,
            context: prev?.context || {
              tourId: '',
              tourTitle: '',
              customerEmail: '',
              customerName: '',
            },
          };
        });
      });
      setReport(res);
    } catch (err) {
      console.error('Simulation run failed:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const toggleStep = (stepNum: number) => {
    setExpandedSteps((prev) => ({ ...prev, [stepNum]: !prev[stepNum] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-700 w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-stone-800 flex items-center justify-between bg-stone-950/60 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-[#0A6C74]/20 border border-[#0A6C74]/30 text-[#2dd4bf]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Unified Platform Integration Suite</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                  Real DB Verification
                </span>
              </h2>
              <p className="text-xs text-stone-400">
                Executes the authoritative 15-step customer lifecycle simulation across all 9 connected platform systems.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="p-4 bg-stone-950/30 border-b border-stone-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center space-x-4 text-xs text-stone-300">
            <div>
              <span className="text-stone-500 block text-[10px] uppercase font-bold">Systems Tested</span>
              <span className="font-semibold text-white">9 / 9 Connected Subsystems</span>
            </div>
            <div className="h-6 w-px bg-stone-800" />
            <div>
              <span className="text-stone-500 block text-[10px] uppercase font-bold">Data Provenance</span>
              <span className="font-semibold text-emerald-400 flex items-center space-x-1">
                <Database className="w-3 h-3" />
                <span>Zero Mock Data</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={isRunning}
            onClick={handleRunSimulation}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold flex items-center space-x-2 shadow-lg transition-all cursor-pointer ${
              isRunning
                ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                : 'bg-[#0A6C74] hover:bg-[#08565C] text-white'
            }`}
          >
            {isRunning ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Simulating 15 Steps...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>{report ? 'Re-run 15-Step Simulation' : 'Run Full Integration Simulation'}</span>
              </>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Summary Box */}
          {report && (
            <div
              className={`p-4 rounded-lg border ${
                report.success
                  ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300'
                  : 'bg-red-950/20 border-red-800/60 text-red-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {report.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                  )}
                  <span className="font-bold text-sm">
                    {report.success
                      ? 'ALL 15 INTEGRATION MILESTONES PASSED'
                      : `SIMULATION FAILED (${report.failedSteps} step errors)`}
                  </span>
                </div>
                <span className="text-xs font-mono text-stone-400">
                  {report.passedSteps} / {report.totalSteps} Completed &bull; {report.totalDurationMs}ms
                </span>
              </div>

              {report.context.customerEmail && (
                <div className="mt-3 pt-3 border-t border-stone-800/80 flex flex-wrap gap-4 text-[11px] text-stone-300">
                  <div>
                    <span className="text-stone-500">Test Customer: </span>
                    <strong className="text-white">{report.context.customerName}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500">Email: </span>
                    <strong className="font-mono text-white">{report.context.customerEmail}</strong>
                  </div>
                  {report.context.bookingReference && (
                    <div>
                      <span className="text-stone-500">Booking Ref: </span>
                      <strong className="font-mono text-[#2dd4bf]">{report.context.bookingReference}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 15 Steps List */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-stone-300 uppercase tracking-wider">
              Simulation Execution Steps (1 to 15)
            </h3>

            {(!report || report.steps.length === 0) && !isRunning && (
              <div className="p-12 text-center border border-dashed border-stone-800 rounded-lg text-stone-500 space-y-3">
                <Layers className="w-8 h-8 mx-auto text-stone-600" />
                <p>Click "Run Full Integration Simulation" above to execute the end-to-end journey.</p>
                <p className="text-[11px] text-stone-600 max-w-md mx-auto">
                  Validates discovery &rarr; inquiry &rarr; lead &rarr; follow-up &rarr; booking &rarr; capacity &rarr; CRM &rarr; operations &rarr; manifest &rarr; payment &rarr; balance &rarr; communication &rarr; customer timeline &rarr; dashboard &rarr; BI reports.
                </p>
              </div>
            )}

            {report?.steps.map((st) => {
              const isExpanded = Boolean(expandedSteps[st.step]);
              return (
                <div
                  key={st.step}
                  className={`border rounded-lg transition-colors overflow-hidden ${
                    st.status === 'passed'
                      ? 'bg-stone-950/40 border-stone-800 hover:border-stone-700'
                      : st.status === 'failed'
                      ? 'bg-red-950/20 border-red-900/60'
                      : 'bg-stone-900 border-stone-800'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleStep(st.step)}
                    className="w-full p-3.5 flex items-center justify-between text-left cursor-pointer hover:bg-stone-800/30"
                  >
                    <div className="flex items-center space-x-3">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                          st.status === 'passed'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : st.status === 'failed'
                            ? 'bg-red-950 text-red-400 border border-red-800'
                            : 'bg-stone-800 text-stone-400 border border-stone-700'
                        }`}
                      >
                        {st.step}
                      </span>

                      <div>
                        <div className="font-bold text-white flex items-center space-x-2">
                          <span>{st.name}</span>
                          <span className="text-[11px] font-normal text-stone-400">
                            &bull; {st.description}
                          </span>
                        </div>
                        {st.errorMessage && (
                          <p className="text-red-400 text-[11px] mt-0.5">{st.errorMessage}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      <span className="text-[10px] font-mono text-stone-500">
                        {st.durationMs}ms
                      </span>
                      {st.status === 'passed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : st.status === 'failed' ? (
                        <XCircle className="w-4 h-4 text-red-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-stone-500" />
                      )}
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-stone-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-stone-500" />
                      )}
                    </div>
                  </button>

                  {isExpanded && st.details && (
                    <div className="p-3.5 bg-black/40 border-t border-stone-800 text-[11px] font-mono">
                      <span className="text-stone-500 block mb-1 uppercase text-[9px] tracking-wider font-bold">
                        Step Execution Payload & Assertions
                      </span>
                      <pre className="text-stone-300 overflow-x-auto p-2.5 bg-stone-950 rounded border border-stone-800/80">
                        {JSON.stringify(st.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-800 bg-stone-950/60 flex items-center justify-between text-xs shrink-0">
          <span className="text-stone-400">
            Authoritative Consistency Engine: <strong className="text-stone-200">Active</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Close Suite
          </button>
        </div>
      </div>
    </div>
  );
};
