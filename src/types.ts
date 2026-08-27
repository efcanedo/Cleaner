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
  error?: string;
};

export type SettingsStatus = {
  hasKey: boolean;
  model: string;
  reasoningEffort: string;
  toolkitAvailable: boolean;
  version: string;
};
