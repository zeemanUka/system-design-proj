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
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth-token';

function asNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/versions/${versionId}/traffic`, {
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
      const response = await fetch(`${API_BASE_URL}/projects/${projectId}/versions/${versionId}/traffic`, {
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

  return (
    <main>
      <div className="page-stack">
        <section className="card">
          <p style={{ marginTop: 0 }}>
            <Link href={`/projects/${projectId}/versions/${versionId}`}>Back to Workspace</Link>
          </p>
          <p className="kicker">Traffic Profile</p>
          <h1>Define demand assumptions for this version</h1>
          <p className="subtitle">These values drive simulation realism and grading context.</p>
          {error ? <p className="error">{error}</p> : null}
          {success ? <p className="muted">{success}</p> : null}
        </section>

        <section className="card">
          <h2>Presets</h2>
          <div className="page-grid-two">
            {(Object.keys(trafficProfilePresets) as TrafficProfilePresetName[]).map((name) => (
              <button key={name} className="button button-secondary" type="button" onClick={() => applyPreset(name)}>
                {name}
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          {isLoading ? (
            <p className="muted">Loading traffic profile...</p>
          ) : (
            <>
              <h2>Profile Settings</h2>

              <div className="page-grid-three">
                <label className="field">
                  Baseline RPS
                  <input
                    type="number"
                    min={1}
                    value={profile.baselineRps}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        baselineRps: Math.max(1, Math.floor(asNumber(event.target.value, current.baselineRps)))
                      }))
                    }
                  />
                </label>

                <label className="field">
                  Peak Multiplier
                  <input
                    type="number"
                    min={1}
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

                <label className="field">
                  Payload Size (KB)
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={profile.payloadKb}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        payloadKb: Math.max(0.1, asNumber(event.target.value, current.payloadKb))
                      }))
                    }
                  />
                </label>
              </div>

              <div className="page-grid-two">
                <label className="field">
                  Read %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={profile.readPercentage}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        readPercentage: Math.min(100, Math.max(0, asNumber(event.target.value, current.readPercentage)))
                      }))
                    }
                  />
                </label>

                <label className="field">
                  Write %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={profile.writePercentage}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        writePercentage: Math.min(100, Math.max(0, asNumber(event.target.value, current.writePercentage)))
                      }))
                    }
                  />
                </label>
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
                          usEast: Math.min(100, Math.max(0, asNumber(event.target.value, current.regionDistribution.usEast)))
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
                          usWest: Math.min(100, Math.max(0, asNumber(event.target.value, current.regionDistribution.usWest)))
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
                          europe: Math.min(100, Math.max(0, asNumber(event.target.value, current.regionDistribution.europe)))
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

              <button className="button" type="button" disabled={isSaving} onClick={() => void saveProfile()}>
                {isSaving ? 'Saving...' : 'Save Traffic Profile'}
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
