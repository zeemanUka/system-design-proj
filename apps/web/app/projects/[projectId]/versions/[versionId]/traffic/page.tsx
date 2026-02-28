'use client';

import {
  TrafficProfile,
  TrafficProfilePresetName,
  VersionTrafficProfileResponse,
  defaultTrafficProfile,
  trafficProfilePresets,
  trafficProfileSchema
} from '@sdc/shared-types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL, apiFetch } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth-token';

type PresetMeta = {
  icon: string;
  title: string;
  description: string;
};

const PRESET_META: Record<TrafficProfilePresetName, PresetMeta> = {
  'interview-default': {
    icon: 'INT',
    title: 'Interview Default',
    description: 'Balanced baseline traffic for common architecture rounds.'
  },
  'read-heavy': {
    icon: 'RD',
    title: 'Read Heavy',
    description: 'Optimized for content feeds and read-dominant workloads.'
  },
  'write-heavy': {
    icon: 'WR',
    title: 'Write Heavy',
    description: 'High write volume for logging, chat, and event capture.'
  },
  'global-burst': {
    icon: 'GB',
    title: 'Global Burst',
    description: 'Multi-region spikes with aggressive peak surges.'
  }
};

function asNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function presetMatch(profile: TrafficProfile, preset: TrafficProfile): boolean {
  return JSON.stringify(profile) === JSON.stringify(preset);
}

function toSeries(profile: TrafficProfile): number[] {
  const peak = profile.baselineRps * profile.peakMultiplier;
  const burstFactor = profile.burstiness === 'steady' ? 0.2 : profile.burstiness === 'spiky' ? 0.45 : 0.7;

  return Array.from({ length: 12 }, (_, index) => {
    const wave = Math.sin((index / 11) * Math.PI);
    const localPeak = profile.baselineRps + wave * (peak - profile.baselineRps) * burstFactor;
    return Math.round(localPeak);
  });
}

export default function TrafficProfilePage() {
  const router = useRouter();
  const params = useParams<{ projectId: string; versionId: string }>();
  const projectId = params.projectId;
  const versionId = params.versionId;

  const [profile, setProfile] = useState<TrafficProfile>(defaultTrafficProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/versions/${versionId}/traffic`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            clearAuthToken();
            router.replace('/auth');
            return;
          }

          setError('Unable to load traffic profile.');
          return;
        }

        const payload = (await response.json()) as VersionTrafficProfileResponse;
        setProfile(payload.trafficProfile);
      } catch {
        setError('Unable to reach server.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [projectId, router, versionId]);

  async function saveProfile() {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    setError(null);
    setSuccess(null);

    const validation = trafficProfileSchema.safeParse(profile);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      setError(firstIssue?.message || 'Traffic profile is invalid.');
      return;
    }

    setIsSaving(true);

    try {
      const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/versions/${versionId}/traffic`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          trafficProfile: validation.data
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearAuthToken();
          router.replace('/auth');
          return;
        }

        const payload = (await response.json()) as { message?: string };
        setError(payload.message || 'Unable to save traffic profile.');
        return;
      }

      const payload = (await response.json()) as VersionTrafficProfileResponse;
      setProfile(payload.trafficProfile);
      setSuccess('Traffic profile saved.');
    } catch {
      setError('Unable to reach server.');
    } finally {
      setIsSaving(false);
    }
  }

  function applyPreset(name: TrafficProfilePresetName) {
    setProfile(trafficProfilePresets[name]);
    setSuccess(`Applied preset: ${name}`);
    setError(null);
  }

  function setReadPercentage(value: number) {
    const clamped = Math.min(100, Math.max(0, Math.round(value)));
    setProfile((current) => ({
      ...current,
      readPercentage: clamped,
      writePercentage: 100 - clamped
    }));
  }

  function setWritePercentage(value: number) {
    const clamped = Math.min(100, Math.max(0, Math.round(value)));
    setProfile((current) => ({
      ...current,
      writePercentage: clamped,
      readPercentage: 100 - clamped
    }));
  }

  const previewSeries = useMemo(() => toSeries(profile), [profile]);
  const chartPoints = useMemo(() => {
    return previewSeries.map((value, index) => `${index * 40},${130 - Math.min(120, value / 50)}`).join(' ');
  }, [previewSeries]);
  const areaPoints = useMemo(() => {
    if (previewSeries.length === 0) {
      return '0,130';
    }
    return `0,130 ${chartPoints} ${(previewSeries.length - 1) * 40},130`;
  }, [chartPoints, previewSeries.length]);

  const peakRps = Math.round(profile.baselineRps * profile.peakMultiplier);
  const hourlyRequests = profile.baselineRps * 3600;
  const peakThroughputMBps = (peakRps * profile.payloadKb) / 1024;
  const regionTotal =
    profile.regionDistribution.usEast +
    profile.regionDistribution.usWest +
    profile.regionDistribution.europe +
    profile.regionDistribution.apac;

  return (
    <main>
      <div className="page-stack">
        <section className="card">
          <p style={{ marginTop: 0 }}>
            <Link href={`/projects/${projectId}/versions/${versionId}`}>Back to Workspace</Link>
          </p>
          <p className="kicker">Traffic Profile</p>
          <h1>Define demand assumptions for this version</h1>
          <p className="subtitle">Tune load shape and see real-time impact before running simulation.</p>
          {error ? <p className="error">{error}</p> : null}
          {success ? <p className="muted">{success}</p> : null}
        </section>

        <div className="traffic-layout">
          <div className="page-stack">
            <section className="card">
              <h2>Presets</h2>
              <div className="preset-grid">
                {(Object.keys(trafficProfilePresets) as TrafficProfilePresetName[]).map((name) => {
                  const preset = trafficProfilePresets[name];
                  const active = presetMatch(profile, preset);

                  return (
                    <button
                      key={name}
                      className={`preset-card ${active ? 'active' : ''}`}
                      type="button"
                      onClick={() => applyPreset(name)}
                    >
                      <div className="list-item-header" style={{ marginBottom: '0.4rem' }}>
                        <strong>{PRESET_META[name].title}</strong>
                        <span className="pill">{PRESET_META[name].icon}</span>
                      </div>
                      <p className="muted" style={{ marginBottom: '0.35rem' }}>
                        {PRESET_META[name].description}
                      </p>
                      <p className="muted" style={{ marginBottom: 0 }}>
                        {preset.baselineRps} RPS x {preset.peakMultiplier} peak • {preset.readPercentage}/{preset.writePercentage}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="card">
              {isLoading ? (
                <p className="muted">Loading traffic profile...</p>
              ) : (
                <>
                  <h2>Profile Controls</h2>

                  <div className="slider-row">
                    <label className="field" style={{ marginBottom: 0 }}>
                      Baseline RPS
                      <input
                        type="range"
                        min={100}
                        max={12000}
                        step={50}
                        value={profile.baselineRps}
                        onChange={(event) =>
                          setProfile((current) => ({
                            ...current,
                            baselineRps: Math.max(1, Math.floor(asNumber(event.target.value, current.baselineRps)))
                          }))
                        }
                      />
                    </label>
                    <div className="slider-meta">
                      <span>100</span>
                      <strong>{profile.baselineRps.toLocaleString()} RPS</strong>
                      <span>12k</span>
                    </div>
                  </div>

                  <div className="slider-row">
                    <label className="field" style={{ marginBottom: 0 }}>
                      Peak Multiplier
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={0.1}
                        value={profile.peakMultiplier}
                        onChange={(event) =>
                          setProfile((current) => ({
                            ...current,
                            peakMultiplier: Math.max(1, asNumber(event.target.value, current.peakMultiplier))
                          }))
                        }
                      />
                    </label>
                    <div className="slider-meta">
                      <span>x1</span>
                      <strong>x{profile.peakMultiplier.toFixed(1)}</strong>
                      <span>x10</span>
                    </div>
                  </div>

                  <div className="slider-row">
                    <label className="field" style={{ marginBottom: 0 }}>
                      Payload Size (KB)
                      <input
                        type="range"
                        min={1}
                        max={256}
                        step={1}
                        value={Math.round(profile.payloadKb)}
                        onChange={(event) =>
                          setProfile((current) => ({
                            ...current,
                            payloadKb: Math.max(0.1, asNumber(event.target.value, current.payloadKb))
                          }))
                        }
                      />
                    </label>
                    <div className="slider-meta">
                      <span>1 KB</span>
                      <strong>{profile.payloadKb.toFixed(1)} KB</strong>
                      <span>256 KB</span>
                    </div>
                  </div>

                  <div className="page-grid-two">
                    <div className="slider-row">
                      <label className="field" style={{ marginBottom: 0 }}>
                        Read %
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={profile.readPercentage}
                          onChange={(event) => setReadPercentage(Number(event.target.value))}
                        />
                      </label>
                      <div className="slider-meta">
                        <span>0%</span>
                        <strong>{profile.readPercentage}%</strong>
                        <span>100%</span>
                      </div>
                    </div>

                    <div className="slider-row">
                      <label className="field" style={{ marginBottom: 0 }}>
                        Write %
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={profile.writePercentage}
                          onChange={(event) => setWritePercentage(Number(event.target.value))}
                        />
                      </label>
                      <div className="slider-meta">
                        <span>0%</span>
                        <strong>{profile.writePercentage}%</strong>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>

                  <h3>Regional Distribution %</h3>
                  <div className="page-grid-two">
                    <label className="field">
                      US East
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={profile.regionDistribution.usEast}
                        onChange={(event) =>
                          setProfile((current) => ({
                            ...current,
                            regionDistribution: {
                              ...current.regionDistribution,
                              usEast: Math.min(
                                100,
                                Math.max(0, asNumber(event.target.value, current.regionDistribution.usEast))
                              )
                            }
                          }))
                        }
                      />
                    </label>

                    <label className="field">
                      US West
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={profile.regionDistribution.usWest}
                        onChange={(event) =>
                          setProfile((current) => ({
                            ...current,
                            regionDistribution: {
                              ...current.regionDistribution,
                              usWest: Math.min(
                                100,
                                Math.max(0, asNumber(event.target.value, current.regionDistribution.usWest))
                              )
                            }
                          }))
                        }
                      />
                    </label>

                    <label className="field">
                      Europe
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={profile.regionDistribution.europe}
                        onChange={(event) =>
                          setProfile((current) => ({
                            ...current,
                            regionDistribution: {
                              ...current.regionDistribution,
                              europe: Math.min(
                                100,
                                Math.max(0, asNumber(event.target.value, current.regionDistribution.europe))
                              )
                            }
                          }))
                        }
                      />
                    </label>

                    <label className="field">
                      APAC
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={profile.regionDistribution.apac}
                        onChange={(event) =>
                          setProfile((current) => ({
                            ...current,
                            regionDistribution: {
                              ...current.regionDistribution,
                              apac: Math.min(100, Math.max(0, asNumber(event.target.value, current.regionDistribution.apac)))
                            }
                          }))
                        }
                      />
                    </label>
                  </div>

                  <label className="field">
                    Burstiness
                    <select
                      value={profile.burstiness}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          burstiness: event.target.value as TrafficProfile['burstiness']
                        }))
                      }
                    >
                      <option value="steady">Steady</option>
                      <option value="spiky">Spiky</option>
                      <option value="extreme">Extreme</option>
                    </select>
                  </label>

                  <div className="traffic-preview">
                    <div className="split-row">
                      <h3 style={{ marginBottom: 0 }}>Live Preview</h3>
                      <span className="pill">Peak {peakRps.toLocaleString()} RPS</span>
                    </div>
                    <svg className="preview-chart" viewBox="0 0 440 130" preserveAspectRatio="none">
                      <polyline className="preview-area" points={areaPoints} />
                      <polyline className="preview-line" points={chartPoints} />
                    </svg>
                    <p className="muted" style={{ marginBottom: 0 }}>
                      Read/write split: {profile.readPercentage}% / {profile.writePercentage}% • Burstiness: {profile.burstiness}
                    </p>
                  </div>

                  <button className="button" type="button" disabled={isSaving} onClick={() => void saveProfile()}>
                    {isSaving ? 'Saving...' : 'Save Traffic Profile'}
                  </button>
                </>
              )}
            </section>
          </div>

          <aside className="card sticky-summary">
            <p className="kicker">Traffic Summary</p>
            <h3 style={{ marginBottom: '0.4rem' }}>Computed Load</h3>
            <div className="list-grid">
              <div className="list-item">
                <p className="muted" style={{ marginBottom: '0.2rem' }}>
                  Peak load
                </p>
                <p className="metric-value">{peakRps.toLocaleString()} RPS</p>
              </div>
              <div className="list-item">
                <p className="muted" style={{ marginBottom: '0.2rem' }}>
                  Hourly requests
                </p>
                <p className="metric-value">{Math.round(hourlyRequests).toLocaleString()}</p>
              </div>
              <div className="list-item">
                <p className="muted" style={{ marginBottom: '0.2rem' }}>
                  Peak throughput
                </p>
                <p className="metric-value">{peakThroughputMBps.toFixed(2)} MB/s</p>
              </div>
              <div className="list-item">
                <p className="muted" style={{ marginBottom: '0.2rem' }}>
                  Region total check
                </p>
                <p className={`metric-value ${regionTotal === 100 ? 'delta-positive' : 'delta-negative'}`}>{regionTotal}%</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
