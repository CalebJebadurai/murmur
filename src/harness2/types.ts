/**
 * Type definitions for Google Harness² (Recursive Agent Harnessing).
 * Maps the 8 editable harness components to Murmuration IR.
 */

export type HarnessTargetKind = "skill" | "instruction" | "subagent" | "prompt";

export type HarnessCandidate = {
  id: string;
  kind: HarnessTargetKind;
  targetName: string;
  action: "create" | "patch";
  content: string;
  rationale: string;
};

export type ProbeTrace = {
  candidateId: string;
  success: boolean;
  score?: number;
  outputSummary: string;
  divergenceNotes?: string;
};

export type EvolutionResult = {
  task: string;
  candidatesProposed: number;
  probesRun: number;
  selectedCandidate?: HarnessCandidate;
  composedFilePath?: string;
  experienceSummary: string;
  doctorPassed: boolean;
};

export type EvolveOptions = {
  k?: number; // Candidate exploration budget (default: 3)
  mode?: "parallel" | "sequential";
  targetKind?: HarnessTargetKind;
  dryRun?: boolean;
  verbose?: boolean;
  json?: boolean;
};
