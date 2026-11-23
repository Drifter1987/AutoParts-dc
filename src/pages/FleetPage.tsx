import { useState } from 'react';
import {
  Download,
  ExternalLink,
  FileUp,
  Play,
  Printer,
  ShieldAlert,
} from 'lucide-react';
import { usePageMetadata } from '../hooks/usePageMetadata';
import {
  checkFleetVins,
  extractFleetVins,
  fleetCsv,
  FLEET_MAX_VINS,
} from '../services/fleet';
import { nhtsaRecallUrl } from '../services/recalls';
import {
  MODEL_DATA_UNAVAILABLE,
  getVehicleIdentity,
  hasCompleteVehicleIdentity,
} from '../services/vehicleIdentity';
import { trackEvent } from '../services/telemetry';
import RollingNumber from '../components/ui/RollingNumber';
import type { FleetRow } from '../types';
import styles from '../styles/features.module.css';

export default function FleetPage() {
  const [input, setInput] = useState('');
  const [rows, setRows] = useState<FleetRow[]>([]);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  usePageMetadata(
    'Fleet VIN Recall Checker — AutoParts',
    'Bulk-check up to 25 VINs against NHTSA model-year recall campaigns, export a CSV, and open per-VIN NHTSA safety checks.',
    {
      canonicalPath: '/fleet',
      noindex: true,
      jsonLd: {
        '@type': 'WebPage',
        name: 'Fleet VIN Recall Checker',
        description: 'Bulk VIN recall campaign checking and CSV export.',
      },
    },
  );

  const runCheck = async () => {
    const vins = extractFleetVins(input);
    if (!vins.length) {
      setError('Paste at least one 17-character VIN, or upload a CSV/text file containing VINs.');
      return;
    }
    setError(null);
    setChecking(true);
    const initial: FleetRow[] = vins.map(vin => ({ vin, status: 'pending' }));
    setRows(initial);
    try {
      const finalRows = await checkFleetVins(vins, row => {
        setRows(previous => previous.map(item => (item.vin === row.vin ? row : item)));
      });
      setRows(finalRows);
      trackEvent('fleet_check_completed', {
        count: vins.length,
        withRecalls: finalRows.filter(row => (row.recalls?.length ?? 0) > 0).length,
      });
    } catch {
      setError('The fleet check stopped unexpectedly. Try a smaller list.');
    } finally {
      setChecking(false);
    }
  };

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      setInput(previous => `${previous}${previous ? '\n' : ''}${text}`);
      setFileName(file.name);
      setError(null);
    } catch {
      setError('That file could not be read.');
    }
  };

  const exportCsv = () => {
    const blob = new Blob([fleetCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `autoparts-fleet-recall-check-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    // Let the browser start reading the blob before releasing its URL. Revoking
    // in the same task can cancel the download under load.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const completeRows = rows.filter(row => row.status === 'complete');
  const recallRows = completeRows.filter(row => (row.recalls?.length ?? 0) > 0);
  const campaignCount = completeRows.reduce((total, row) => total + (row.recalls?.length ?? 0), 0);
  const skippedLookupCount = completeRows.filter(
    row => row.recallScope && row.recallScope !== 'model-year',
  ).length;
  const errorCount = rows.filter(row => row.status === 'error').length;

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className="eyebrow">Fleet safety workflow</p>
            <h1 className={styles.title}>Fleet VIN recall checker</h1>
            <p className={styles.subtitle}>
              Paste a list or upload a CSV of up to {FLEET_MAX_VINS} VINs. The checker resolves
              vehicle identity and model-year campaigns, keeps a per-VIN NHTSA link, and exports a
              reviewable CSV. It is a client-side batch tool; no VIN list is uploaded to a server.
            </p>
          </div>
        </div>

        <div className={`${styles.status} ${styles.statusWarning}`} role="note">
          <ShieldAlert size={16} aria-hidden="true" />
          <span>
            The campaign count is model-year data. NHTSA’s public recall API does not tell us whether
            a particular VIN has an open repair; use the per-VIN NHTSA link before scheduling work.
          </span>
        </div>

        <section className={`card ${styles.panel}`} style={{ marginTop: 'var(--space-5)' }} aria-labelledby="fleet-input-title">
          <div className={styles.panelHeader}>
            <div>
              <p className="eyebrow">Batch input</p>
              <h2 id="fleet-input-title" className={styles.panelTitle}>VINs or CSV</h2>
            </div>
            <span className={styles.panelMeta}>Max {FLEET_MAX_VINS} VINs per run</span>
          </div>
          <label className={styles.field}>
            <span className={styles.label}>VIN list, CSV, or auction export</span>
            <textarea
              className={`${styles.textarea} ${styles.transferBox}`}
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder={'Paste VINs, one per line, or upload a file.\n2HGFC2F59LH500001\n1HGCM82633A004352'}
              spellCheck={false}
            />
          </label>
          <div className={styles.formActions}>
            <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
              <FileUp size={14} /> Upload file
              <input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                hidden
                onChange={event => void loadFile(event.target.files?.[0])}
              />
            </label>
            {fileName && <span className={styles.panelMeta}>Loaded {fileName}</span>}
            <button type="button" className="btn btn-primary" onClick={() => void runCheck()} disabled={checking}>
              <Play size={14} /> {checking ? 'Checking VINs…' : 'Check VINs'}
            </button>
          </div>
          {error && (
            <div className={`${styles.status} ${styles.statusError}`} role="alert" style={{ marginTop: 'var(--space-3)' }}>
              {error}
            </div>
          )}
        </section>

        {rows.length > 0 && (
          <section className={styles.panel} aria-labelledby="fleet-results-title" style={{ marginTop: 'var(--space-5)' }}>
            <div className={styles.panelHeader}>
              <div>
                <p className="eyebrow">Results</p>
                <h2 id="fleet-results-title" className={styles.panelTitle}>Fleet safety summary</h2>
              </div>
              <div className={styles.actions}>
                <button type="button" className="btn btn-ghost" onClick={exportCsv} disabled={!rows.length}>
                  <Download size={14} /> Export CSV
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
                  <Printer size={14} /> Print
                </button>
              </div>
            </div>

            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <RollingNumber className={styles.summaryValue} value={completeRows.length} />
                <span className={styles.summaryLabel}>VINs checked</span>
              </div>
              <div className={styles.summaryItem}>
                <RollingNumber className={styles.summaryValue} value={recallRows.length} />
                <span className={styles.summaryLabel}>With campaigns</span>
              </div>
              <div className={styles.summaryItem}>
                <RollingNumber className={styles.summaryValue} value={campaignCount} />
                <span className={styles.summaryLabel}>Campaigns returned</span>
              </div>
              <div className={styles.summaryItem}>
                <RollingNumber className={styles.summaryValue} value={skippedLookupCount} />
                <span className={styles.summaryLabel}>Lookups skipped</span>
              </div>
              <div className={styles.summaryItem}>
                <RollingNumber className={styles.summaryValue} value={errorCount} />
                <span className={styles.summaryLabel}>Errors</span>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>VIN</th>
                    <th>Vehicle</th>
                    <th>Model-year campaigns</th>
                    <th>VIN-specific check</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.vin}>
                      <td className={styles.vinCell}>{row.vin}</td>
                      <td>
                        {hasCompleteVehicleIdentity(row) ? (
                          <>
                            <span className={styles.rowTitle}>{getVehicleIdentity(row)}</span>
                            <span className={styles.listMeta}>{row.status === 'complete' ? 'Decoded' : row.status}</span>
                          </>
                        ) : row.status === 'complete' ? (
                          <>
                            <span className={styles.rowTitle}>{MODEL_DATA_UNAVAILABLE}</span>
                            <span className={styles.listMeta}>
                              {getVehicleIdentity(row)
                                ? `${getVehicleIdentity(row)} · model-year campaigns not checked`
                                : 'Decoded VIN · model-year campaigns not checked'}
                            </span>
                          </>
                        ) : (
                          <span className={styles.listMeta}>{row.status === 'pending' ? 'Queued' : row.status}</span>
                        )}
                      </td>
                      <td>
                        {row.recallNote ? (
                          <span className={styles.listMeta}>{row.recallNote}</span>
                        ) : row.recalls?.length ? (
                          <span className={styles.campaignList}>
                            <span>{row.recalls.length} campaign{row.recalls.length === 1 ? '' : 's'}</span>
                            <span className={styles.listMeta}>{row.recalls.map(item => item.campaignNumber).join(', ')}</span>
                          </span>
                        ) : row.status === 'complete' ? (
                          <span className={styles.listMeta}>None returned</span>
                        ) : (
                          <span className={styles.listMeta}>—</span>
                        )}
                      </td>
                      <td>
                        <a className={styles.link} href={nhtsaRecallUrl(row.vin)} target="_blank" rel="noreferrer">
                          Open NHTSA <ExternalLink size={11} />
                        </a>
                      </td>
                      <td>
                        {row.status === 'complete' ? (
                          <span className="badge badge-success">Checked</span>
                        ) : row.status === 'error' ? (
                          <span className="badge badge-amber" title={row.error}>Error</span>
                        ) : (
                          <span className="badge badge-ice">{row.status}</span>
                        )}
                        {row.error && <span className={styles.listMeta}>{row.error}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.panelMeta} style={{ marginTop: 'var(--space-3)' }}>
              Export contains VIN, decoded vehicle, campaign numbers, whether the model-year
              lookup ran, NHTSA VIN-check URL, and status. It does not contain a claim about
              repair status; a blank campaign count means no lookup ran.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
