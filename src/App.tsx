import { ChangeEvent, DragEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CleaningJob, CleaningPath, CostEstimate, SettingsStatus } from './types';

const API = 'http://127.0.0.1:41842';

const PATHS: Array<{ id: CleaningPath; title: string; short: string; description: string; accepts: string }> = [
  { id: 'news_articles', title: 'News articles', short: 'N', description: 'Remove webpage debris while preserving every article.', accepts: '.md,.txt,.docx,.pdf' },
  { id: 'documents', title: 'Documents', short: 'D', description: 'Restore prose, tables, forms, slides, and visual evidence.', accepts: '.md,.txt,.docx,.pdf' },
  { id: 'hearing_transcripts', title: 'Hearing transcripts', short: 'T', description: 'Repair captions, speakers, punctuation, and structure.', accepts: '.md,.txt,.docx,.pdf' },
  { id: 'beacon_article', title: 'Beacon article', short: 'A', description: 'OCR one historical article and reunite continuations.', accepts: '.pdf,.png,.jpg,.jpeg,.tif,.tiff,.heic' },
  { id: 'beacon_issue', title: 'Beacon issue', short: 'I', description: 'Recover every article and masthead from one issue.', accepts: '.pdf,.png,.jpg,.jpeg,.tif,.tiff,.heic' },
  { id: 'beacon_volume', title: 'Beacon volume', short: 'V', description: 'Split, checkpoint, and recover a multi-issue volume.', accepts: '.pdf' },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function pathTitle(path: CleaningPath) {
  return PATHS.find((item) => item.id === path)?.title ?? path;
}

function dollars(value: number) {
  if (value > 0 && value < 0.001) return '<$0.001';
  if (value > 0 && value < 0.01) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}

function estimateLabel(estimate: CostEstimate) {
  return `${dollars(estimate.lowUSD)}–${dollars(estimate.highUSD)}`;
}

function uniqueFiles(existing: File[], incoming: File[]) {
  const seen = new Set(existing.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  return [...existing, ...incoming.filter((file) => !seen.has(`${file.name}:${file.size}:${file.lastModified}`))];
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload as T;
}

export default function App() {
  const [selectedPath, setSelectedPath] = useState<CleaningPath>('news_articles');
  const [files, setFiles] = useState<File[]>([]);
  const [settings, setSettings] = useState<SettingsStatus | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-5.6-terra');
  const [effort, setEffort] = useState('high');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [job, setJob] = useState<CleaningJob | null>(null);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [estimatingCost, setEstimatingCost] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => PATHS.find((item) => item.id === selectedPath)!, [selectedPath]);

  const refreshSettings = useCallback(async () => {
    try {
      const status = await api<SettingsStatus>('/api/settings');
      setSettings(status);
      setModel(status.model);
      setEffort(status.reasoningEffort);
    } catch {
      setSettings(null);
    }
  }, []);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    if (!files.length) {
      setCostEstimate(null);
      setEstimatingCost(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setEstimatingCost(true);
      try {
        const estimate = await api<CostEstimate>('/api/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: selectedPath, files: files.map((file) => ({ name: file.name, size: file.size, type: file.type })) }),
          signal: controller.signal,
        });
        setCostEstimate(estimate);
      } catch (estimateError) {
        if (!(estimateError instanceof DOMException && estimateError.name === 'AbortError')) setCostEstimate(null);
      } finally {
        if (!controller.signal.aborted) setEstimatingCost(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [files, selectedPath, settings?.model]);

  useEffect(() => {
    if (!job || ['completed', 'failed', 'cancelled'].includes(job.status)) {
      setRunning(false);
      return;
    }
    const timer = window.setInterval(async () => {
      try {
        const next = await api<CleaningJob>(`/api/jobs/${job.id}`);
        setJob(next);
      } catch (pollError) {
        setError(pollError instanceof Error ? pollError.message : 'Could not read job status.');
      }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [job]);

  function addFiles(incoming: File[]) {
    const allowed = new Set(selected.accepts.split(','));
    const supported = incoming.filter((file) => allowed.has(`.${file.name.split('.').pop()?.toLowerCase()}`));
    if (supported.length !== incoming.length) {
      setError(`Some files were not added. ${selected.title} accepts ${selected.accepts.replaceAll(',', ', ')}.`);
    } else {
      setError('');
    }
    setFiles((current) => uniqueFiles(current, supported));
  }

  function choosePath(path: CleaningPath) {
    setSelectedPath(path);
    setFiles([]);
    setJob(null);
    setError('');
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setSavingSettings(true);
    setSettingsMessage('');
    try {
      const payload = await api<SettingsStatus & { message: string }>('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() || undefined, model, reasoningEffort: effort }),
      });
      setSettings(payload);
      setApiKey('');
      setSettingsMessage(payload.message);
    } catch (saveError) {
      setSettingsMessage(saveError instanceof Error ? saveError.message : 'Settings could not be saved.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function testKey() {
    setSavingSettings(true);
    setSettingsMessage('Testing connection…');
    try {
      const result = await api<{ ok: boolean; message: string }>('/api/settings/test', { method: 'POST' });
      setSettingsMessage(result.message);
    } catch (testError) {
      setSettingsMessage(testError instanceof Error ? testError.message : 'Connection test failed.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function runCleaning() {
    if (!files.length) return;
    if (!settings?.hasKey) {
      setSettingsOpen(true);
      setSettingsMessage('Add an OpenAI API key before cleaning.');
      return;
    }
    setRunning(true);
    setError('');
    const form = new FormData();
    form.set('path', selectedPath);
    files.forEach((file) => form.append('files', file, file.name));
    try {
      const created = await api<CleaningJob>('/api/jobs', { method: 'POST', body: form });
      setJob(created);
    } catch (runError) {
      setRunning(false);
      setError(runError instanceof Error ? runError.message : 'The cleaning job could not be started.');
    }
  }

  async function reveal(path?: string) {
    if (!path) return;
    try {
      await api('/api/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
    } catch (revealError) {
      setError(revealError instanceof Error ? revealError.message : 'Finder could not be opened.');
    }
  }

  async function cancelJob() {
    if (!job) return;
    try {
      const next = await api<CleaningJob>(`/api/jobs/${job.id}/cancel`, { method: 'POST' });
      setJob(next);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'The job could not be cancelled.');
    }
  }

  const finished = job && ['completed', 'failed', 'cancelled'].includes(job.status);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Document Cleaner home">
          <span className="brand-mark" aria-hidden="true"><span>✓</span></span>
          <span>Document Cleaner</span>
        </a>
        <div className="top-actions">
          <span className={`helper-status ${settings ? 'is-ready' : ''}`}><i />{settings ? `Local helper · ${settings.version}` : 'Connecting…'}</span>
          <button className="settings-button" type="button" onClick={() => setSettingsOpen(true)}>Settings</button>
        </div>
      </header>

      <section className="hero" id="top">
        <p className="eyebrow">Source-faithful restoration</p>
        <h1>Turn difficult files into <em>clean evidence.</em></h1>
        <p className="lede">Choose the source type, add one file or a batch, and receive faithful Markdown with a separate verification result. Originals are never overwritten.</p>
        <div className="flow" aria-label="Three steps"><span><b>1</b> Choose</span><i /><span><b>2</b> Add files</span><i /><span><b>3</b> Clean & audit</span></div>
      </section>

      <div className="workspace">
        <section className="path-card card" aria-labelledby="path-heading">
          <div className="section-heading path-heading"><div><p className="section-kicker">Cleaning path</p><h2 id="path-heading">What kind of source is this?</h2></div><span className="folder-chip">Outputs → Downloads</span></div>
          <div className="path-grid">
            {PATHS.map((path) => (
              <button key={path.id} type="button" className={selectedPath === path.id ? 'active' : ''} onClick={() => choosePath(path.id)} aria-pressed={selectedPath === path.id}>
                <span className="tool-icon" aria-hidden="true">{path.short}</span>
                <span><strong>{path.title}</strong><small>{path.description}</small></span>
              </button>
            ))}
          </div>
        </section>

        <section className="composer card" aria-labelledby="files-heading">
          <div className="section-heading"><div><p className="section-kicker">New {selected.title.toLowerCase()} job</p><h2 id="files-heading">Add source files</h2></div><span className="folder-chip">Accepts {selected.accepts.replaceAll(',', ' · ')}</span></div>
          <input ref={fileInput} className="visually-hidden" type="file" multiple accept={selected.accepts} onChange={onFileChange} />
          <div
            className={`drop-zone ${dragging ? 'is-dragging' : ''}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <span className="drop-icon" aria-hidden="true">↓</span>
            <div><h3>Drop files here</h3><p>Files stay local until you start the job. Relevant source content is then sent directly to OpenAI for cleaning and verification.</p></div>
            <button className="secondary-button" type="button" onClick={() => fileInput.current?.click()}>Choose files</button>
          </div>
          {error && <p className="inline-error" role="alert">{error}</p>}
        </section>

        <section className="queue card" aria-labelledby="queue-heading">
          <div className="section-heading queue-title"><div><p className="section-kicker">Ready to process</p><h2 id="queue-heading">File queue <span>{files.length}</span></h2></div>{files.length > 0 && !running && <button className="text-button" type="button" onClick={() => setFiles([])}>Clear all</button>}</div>
          <div className="file-list">
            {files.length === 0 ? (
              <div className="empty-state"><span aria-hidden="true">⇩</span><h3>Your queue is empty</h3><p>Select a cleaning path and add one or more supported files.</p></div>
            ) : files.map((file, index) => (
              <article className="file-row" key={`${file.name}:${file.size}:${file.lastModified}`}>
                <div className="file-number">{job?.status === 'completed' ? '✓' : index + 1}</div>
                <div className="file-copy"><h3>{file.name}</h3><p>{formatBytes(file.size)} · {file.type || 'document'}</p></div>
                {!running && <button className="remove-button" type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`}>×</button>}
              </article>
            ))}
          </div>

          {job && (
            <div className="job-progress" aria-live="polite">
              <div className="progress-heading"><div><strong>{job.stage}</strong><small>{job.completedFiles} of {job.totalFiles} source files finished{job.actualCostUSD > 0 ? ` · ${dollars(job.actualCostUSD)} API cost so far` : ''}</small></div><span>{Math.round(job.progress)}%</span></div>
              <div className="progress-track"><i style={{ width: `${job.progress}%` }} /></div>
              {job.results.length > 0 && <div className="results-list">{job.results.map((result) => (
                <div className={`result ${result.status === 'Unable to verify' ? 'is-error' : result.uncertainty ? 'is-warning' : ''}`} key={result.sourceName}>
                  <span>{result.status === 'Unable to verify' ? '!' : result.uncertainty ? '?' : '✓'}</span>
                  <div><strong>{result.sourceName}</strong><small>{result.status}{result.uncertainty ? ` — ${result.uncertainty}` : ''}{result.error ? ` — ${result.error}` : ''}</small></div>
                </div>
              ))}</div>}
              {finished && <div className="cost-summary"><span><small>Pre-run estimate</small><strong>{job.estimatedCost ? estimateLabel(job.estimatedCost) : 'Not available'}</strong></span><span><small>Recorded token cost</small><strong>{job.actualCostUSD > 0 ? dollars(job.actualCostUSD) : 'Not reported'}</strong></span></div>}
              {job.destination && <button className="finder-button" type="button" onClick={() => reveal(job.destination)}>Show output folder in Finder</button>}
            </div>
          )}

          <div className="run-bar">
            <div className="destination"><span aria-hidden="true">⌄</span><div><small>Destination</small><strong>Downloads · unique timestamped folder</strong><small className="cleanup-note">Originals remain untouched. Each source is independently checked.</small></div></div>
            <div className="cost-estimate" title={costEstimate?.assumption || 'Add files to estimate API cost.'}><small>Estimated API cost</small><strong>{estimatingCost ? 'Calculating…' : costEstimate ? estimateLabel(costEstimate) : 'Add files'}</strong><em>{costEstimate ? `${costEstimate.model} · estimate` : 'Before processing'}</em></div>
            {running && !finished ? <button className="cancel-button" type="button" onClick={cancelJob}>Cancel after current request</button> : <button className="primary-button" type="button" disabled={!files.length || !settings?.hasKey} onClick={runCleaning}>{finished ? `Run another ${pathTitle(selectedPath)} job` : `Clean ${files.length || ''} file${files.length === 1 ? '' : 's'}`}</button>}
          </div>
        </section>
      </div>

      <footer><span>Local Apple-silicon app · API key protected by Keychain</span><span>Markdown · text · Word · PDF · image · batch processing</span></footer>

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSettingsOpen(false)}>
          <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><p className="section-kicker">Local configuration</p><h2 id="settings-title">OpenAI settings</h2></div><button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button></div>
            <form onSubmit={saveSettings}>
              <label>API key <small>{settings?.hasKey ? 'A key is stored in macOS Keychain. Leave blank to keep it.' : 'Required. Stored only in macOS Keychain.'}</small><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings?.hasKey ? '••••••••••••••••' : 'sk-…'} autoComplete="off" /></label>
              <label>Processing model <small>Terra balances fidelity and cost; Sol prioritizes difficult sources.</small><select value={model} onChange={(event) => setModel(event.target.value)}><option value="gpt-5.6-terra">GPT-5.6 Terra — balanced</option><option value="gpt-5.6-sol">GPT-5.6 Sol — highest fidelity</option><option value="gpt-5.6-luna">GPT-5.6 Luna — lowest cost</option></select></label>
              <label>Reasoning effort <small>Used for Beacon paths and risk-triggered audits. Articles, documents, and transcripts begin with a faster medium-reasoning pass.</small><select value={effort} onChange={(event) => setEffort(event.target.value)}><option value="medium">Medium</option><option value="high">High</option><option value="xhigh">Extra high</option></select></label>
              <div className="privacy-note"><strong>Privacy behavior</strong><p>Requests go directly from this Mac to OpenAI. API response storage is disabled. Temporary working files are removed after a job finishes; completed outputs remain in Downloads.</p></div>
              {settings?.pricing && <div className="pricing-note"><strong>API prices used for estimates</strong><p>Per 1 million input/output tokens: Sol {dollars(settings.pricing.models['gpt-5.6-sol'].input)}/{dollars(settings.pricing.models['gpt-5.6-sol'].output)}, Terra {dollars(settings.pricing.models['gpt-5.6-terra'].input)}/{dollars(settings.pricing.models['gpt-5.6-terra'].output)}, and Luna {dollars(settings.pricing.models['gpt-5.6-luna'].input)}/{dollars(settings.pricing.models['gpt-5.6-luna'].output)}. <a href={settings.pricing.source} target="_blank" rel="noreferrer">Official pricing</a> · checked {settings.pricing.updatedAt}.</p></div>}
              {settingsMessage && <p className="settings-message" role="status">{settingsMessage}</p>}
              <div className="modal-actions"><button className="secondary-button" type="button" disabled={!settings?.hasKey || savingSettings} onClick={testKey}>Test saved key</button><button className="primary-button" type="submit" disabled={savingSettings || (!settings?.hasKey && !apiKey.trim())}>{savingSettings ? 'Saving…' : 'Save settings'}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
