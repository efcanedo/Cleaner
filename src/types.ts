export type CleaningPath =
  | 'news_articles'
  | 'documents'
  | 'hearing_transcripts'
  | 'beacon_article'
  | 'beacon_issue'
  | 'beacon_volume';

export type JobStatus = 'queued' | 'preparing' | 'processing' | 'auditing' | 'completed' | 'failed' | 'cancelled';

export type FileResult = {
  sourceName: string;
  status: 'Cleaned and verified' | 'Cleaned and verified with uncertainties' | 'Unable to verify';
  outputs: string[];
  uncertainty?: string;
  error?: string;
};

export type CleaningJob = {
  id: string;
  path: CleaningPath;
  status: JobStatus;
  stage: string;
  progress: number;
  totalFiles: number;
  completedFiles: number;
  createdAt: string;
  destination?: string;
  results: FileResult[];
  estimatedCost?: CostEstimate;
  actualCostUSD: number;
  error?: string;
};

export type CostEstimate = {
  lowUSD: number;
  highUSD: number;
  model: string;
  pricingUpdatedAt: string;
  pricingSource: string;
  assumption: string;
};

export type SettingsStatus = {
  hasKey: boolean;
  model: string;
  reasoningEffort: string;
  toolkitAvailable: boolean;
  version: string;
  pricing: {
    models: Record<string, { input: number; cachedInput: number; output: number }>;
    updatedAt: string;
    source: string;
  };
};
