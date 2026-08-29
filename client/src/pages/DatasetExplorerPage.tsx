import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { TopNav } from '../components/TopNav';
import { getDataset, getDatasetKeys, refreshDatasetCache } from '../services/api';
import { DatasetKey } from '../types/api';

const DataCell = ({ label, value }: { label: string; value: string | number }) => (
  <div className="bg-zinc-950/70 p-3 rounded-2xl border border-zinc-800"> 
    <div className="text-[0.78rem] uppercase tracking-[0.12em] text-zinc-500">{label}</div>
    <div className="mt-2 text-xl font-semibold text-white">{value}</div>
  </div>
);

const renderDataValue = (value: unknown): JSX.Element => {
  if (value === null) {
    return <span className="text-zinc-300">null</span>;
  }

  if (Array.isArray(value)) {
    return (
      <div className="space-y-2">
        <div className="text-zinc-300">Array ({value.length})</div>
        <pre className="overflow-auto rounded-xl bg-zinc-950/80 border border-zinc-800 p-3 text-[0.8rem] text-zinc-300">{JSON.stringify(value, null, 2)}</pre>
      </div>
    );
  }

  if (typeof value === 'object') {
    return (
      <pre className="overflow-auto rounded-xl bg-zinc-950/80 border border-zinc-800 p-3 text-[0.8rem] text-zinc-300">{JSON.stringify(value, null, 2)}</pre>
    );
  }

  return <span className="text-zinc-100">{String(value)}</span>;
};

export default function DatasetExplorerPage() {
  const [keys, setKeys] = useState<DatasetKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<DatasetKey>('iss');
  const [dataset, setDataset] = useState<unknown>(null);
  const [rawJson, setRawJson] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Loading offline datasets...');

  const loadKeys = async () => {
    try {
      setStatusMessage('Fetching available dataset keys...');
      const datasetKeys = await getDatasetKeys();
      if (datasetKeys.length > 0) {
        setKeys(datasetKeys);
        setSelectedKey(datasetKeys[0]);
      }
      setStatusMessage('Select a dataset to inspect its live offline payload.');
    } catch (error) {
      setStatusMessage(`Unable to load dataset keys: ${(error as Error).message}`);
    }
  };

  const loadSelectedDataset = async (datasetKey: DatasetKey) => {
    try {
      setStatusMessage(`Loading dataset ${datasetKey}...`);
      const data = await getDataset(datasetKey);
      setDataset(data);
      setRawJson(JSON.stringify(data, null, 2));
      setStatusMessage(`Dataset ${datasetKey} is loaded and ready.`);
    } catch (error) {
      setStatusMessage(`Unable to load dataset ${datasetKey}: ${(error as Error).message}`);
      setDataset(null);
      setRawJson('');
    }
  };

  const refreshCache = async () => {
    setIsRefreshing(true);
    try {
      const message = await refreshDatasetCache();
      await loadSelectedDataset(selectedKey);
      setStatusMessage(message);
    } catch (error) {
      setStatusMessage(`Cache refresh failed: ${(error as Error).message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  useEffect(() => {
    if (selectedKey) {
      loadSelectedDataset(selectedKey);
    }
  }, [selectedKey]);

  const datasetSummary = useMemo(() => {
    if (!dataset || typeof dataset !== 'object') {
      return null;
    }

    if (Array.isArray(dataset)) {
      return { itemCount: dataset.length, summary: `${dataset.length} records` };
    }

    const keys = Object.keys(dataset as Record<string, unknown>);
    return {
      itemCount: keys.length,
      summary: `${keys.length} root properties`,
    };
  }, [dataset]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white selection:bg-cyan-400/40 selection:text-zinc-950">
      <TopNav />
      <section className="mx-auto max-w-7xl px-6 py-8 sm:px-8 lg:px-10">
        <div className="grid gap-6 md:grid-cols-[1.8fr_1fr] lg:grid-cols-[2.2fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950/70 p-8 shadow-2xl shadow-cyan-600/10 backdrop-blur-xl">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-cyan-400/90">Dataset Explorer</p>
                  <h1 className="mt-4 text-4xl font-semibold text-white">Offline Mission Data Intelligence</h1>
                  <p className="mt-3 max-w-2xl text-zinc-400">Inspect every local dataset available to AstraHealth Nexus and validate mission payloads without internet access.</p>
                </div>
                <button
                  onClick={refreshCache}
                  disabled={isRefreshing}
                  className="inline-flex items-center justify-center rounded-3xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRefreshing ? 'Refreshing cache…' : 'Refresh dataset cache'}
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DataCell label="Datasets Available" value={keys.length} />
              <DataCell label="Current Selection" value={selectedKey} />
              <DataCell label="Root Properties" value={datasetSummary?.itemCount ?? 0} />
              <DataCell label="Offline Mode" value="Enabled" />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <motion.section
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="rounded-[2rem] border border-zinc-800 bg-zinc-950/80 p-8"
              >
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">Dataset Payload</h2>
                    <p className="mt-2 text-sm text-zinc-400">Rendered JSON for the selected dataset. Use this to confirm the dataset shape and ensure accurate mission state delivery.</p>
                  </div>
                  <span className="rounded-full border border-zinc-800 bg-zinc-900/90 px-4 py-2 text-xs uppercase tracking-[0.18em] text-zinc-400">{datasetSummary?.summary ?? 'No dataset selected'}</span>
                </div>
                <div className="rounded-[1.75rem] border border-zinc-800 bg-zinc-950/90 p-5">
                  <pre className="whitespace-pre-wrap break-words text-[0.85rem] leading-6 text-zinc-200">{rawJson || statusMessage}</pre>
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.06 }}
                className="rounded-[2rem] border border-zinc-800 bg-zinc-950/80 p-8"
              >
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">Live Dataset Health</h2>
                    <p className="mt-2 text-sm text-zinc-400">Every dataset request is validated from local source files to ensure offline reliability.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5">
                      <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Latest Status</p>
                      <p className="mt-4 text-xl font-semibold text-white">{statusMessage}</p>
                    </div>
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5">
                      <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Dataset Key</p>
                      <p className="mt-4 text-xl font-semibold text-white">{selectedKey}</p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5">
                      <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Payload Size</p>
                      <p className="mt-4 text-xl font-semibold text-white">{rawJson.length.toLocaleString()} chars</p>
                    </div>
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5">
                      <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Cache Status</p>
                      <p className="mt-4 text-xl font-semibold text-cyan-400">Local and instant</p>
                    </div>
                  </div>
                </div>
              </motion.section>
            </div>
          </div>

          <aside className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="rounded-[2rem] border border-zinc-800 bg-zinc-950/80 p-8"
            >
              <h2 className="text-2xl font-semibold text-white">Datasets</h2>
              <p className="mt-3 text-sm text-zinc-400">Choose from any space dataset available for offline mission scenarios.</p>
              <div className="mt-6 grid gap-3">
                {keys.map((key) => (
                  <button
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    className={`w-full rounded-3xl border px-4 py-4 text-left transition ${selectedKey === key ? 'border-cyan-500 bg-cyan-500/10 text-white' : 'border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900/80'}`}
                  >
                    <div className="text-base font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                    <div className="mt-1 text-sm text-zinc-500">Inspect the {key} dataset payload.</div>
                  </button>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.06 }}
              className="rounded-[2rem] border border-zinc-800 bg-zinc-950/80 p-8"
            >
              <h2 className="text-2xl font-semibold text-white">Quick Tips</h2>
              <ul className="mt-4 space-y-3 text-sm text-zinc-400">
                <li>• Use the dataset explorer to validate the offline mission state before launching the UI.</li>
                <li>• Every payload is served directly from local JSON files, so the application remains functional without internet.</li>
                <li>• The cache refresh endpoint rebuilds dataset mappings and preserves the same reliable local source.</li>
                <li>• Expand these payloads to create mission intelligence, predictive alerts, and crew analytics in real-time.</li>
              </ul>
            </motion.div>
          </aside>
        </div>
      </section>
    </main>
  );
}
