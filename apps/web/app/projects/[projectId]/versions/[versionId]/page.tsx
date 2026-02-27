'use client';

import {
  ArchitectureComponent,
  ArchitectureEdge,
  ComponentType,
  GradeReportResponse,
  SimulationRunResponse,
  TrafficProfile,
  UpdateVersionRequest,
  VersionDetail,
  defaultTrafficProfile,
  validateArchitectureTopology
} from '@sdc/shared-types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { PointerEvent, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth-token';

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

type PaletteItem = {
  type: ComponentType;
  label: string;
  stateful: boolean;
};

type DragState = {
  componentId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
} | null;

const PALETTE: PaletteItem[] = [
  { type: 'client', label: 'Client', stateful: false },
  { type: 'load-balancer', label: 'Load Balancer', stateful: false },
  { type: 'api-gateway', label: 'API Gateway', stateful: false },
  { type: 'service', label: 'Service', stateful: false },
  { type: 'cache', label: 'Cache', stateful: true },
  { type: 'database', label: 'Database', stateful: true },
  { type: 'queue', label: 'Queue', stateful: true },
  { type: 'cdn', label: 'CDN', stateful: false },
  { type: 'object-store', label: 'Object Store', stateful: true }
];

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const NODE_WIDTH = 190;
const NODE_HEIGHT = 102;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function defaultComponent(label: string, type: ComponentType, stateful: boolean, count: number): ArchitectureComponent {
  const columns = 4;
  const row = Math.floor(count / columns);
  const column = count % columns;

  return {
    id: crypto.randomUUID(),
    type,
    label,
    position: {
      x: 28 + column * 220,
      y: 28 + row * 132
    },
    capacity: {
      opsPerSecond: 1000,
      cpuCores: 2,
      memoryGb: 4
    },
    scaling: {
      replicas: 1,
      verticalTier: 'medium'
    },
    behavior: {
      stateful
    }
  };
}

function getDisplayPosition(component: ArchitectureComponent) {
  return {
    x: clamp(component.position.x, 0, CANVAS_WIDTH - NODE_WIDTH),
    y: clamp(component.position.y, 0, CANVAS_HEIGHT - NODE_HEIGHT)
  };
}

export default function VersionWorkspacePage() {
  const router = useRouter();
  const params = useParams<{ projectId: string; versionId: string }>();
  const projectId = params.projectId;
  const versionId = params.versionId;

  const [version, setVersion] = useState<VersionDetail | null>(null);
  const [components, setComponents] = useState<ArchitectureComponent[]>([]);
  const [edges, setEdges] = useState<ArchitectureEdge[]>([]);
  const [trafficProfile, setTrafficProfile] = useState<TrafficProfile>(defaultTrafficProfile);
  const [notes, setNotes] = useState('');
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [linkSourceId, setLinkSourceId] = useState<string>('');
  const [linkTargetId, setLinkTargetId] = useState<string>('');
  const [dragState, setDragState] = useState<DragState>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isStartingSimulation, setIsStartingSimulation] = useState(false);
  const [isStartingGrade, setIsStartingGrade] = useState(false);

  const warnings = useMemo(() => validateArchitectureTopology(components, edges), [components, edges]);
  const selectedComponent = useMemo(() => {
    return components.find((component) => component.id === selectedComponentId) ?? null;
  }, [components, selectedComponentId]);
  const componentMap = useMemo(() => {
    return new Map(components.map((component) => [component.id, component]));
  }, [components]);
  const edgeLines = useMemo(() => {
    return edges.flatMap((edge) => {
      const source = componentMap.get(edge.sourceId);
      const target = componentMap.get(edge.targetId);

      if (!source || !target) {
        return [];
      }

      const sourcePosition = getDisplayPosition(source);
      const targetPosition = getDisplayPosition(target);

      return [
        {
          id: edge.id,
          sourceId: source.id,
          targetId: target.id,
          sourceLabel: source.label,
          targetLabel: target.label,
          x1: sourcePosition.x + NODE_WIDTH / 2,
          y1: sourcePosition.y + NODE_HEIGHT / 2,
          x2: targetPosition.x + NODE_WIDTH / 2,
          y2: targetPosition.y + NODE_HEIGHT / 2
        }
      ];
    });
  }, [componentMap, edges]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    setError(null);

    void (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/versions/${versionId}`, {
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

          setError('Unable to load version workspace.');
          return;
        }

        const payload = (await response.json()) as VersionDetail;
        setVersion(payload);
        setComponents(payload.components);
        setEdges(payload.edges);
        setTrafficProfile(payload.trafficProfile);
        setNotes(payload.notes ?? '');
        setSelectedComponentId(payload.components[0]?.id ?? null);
        setIsLoaded(true);
        setSaveState('saved');
        setLastSavedAt(new Date(payload.updatedAt).toLocaleTimeString());
      } catch {
        setError('Unable to reach server.');
      }
    })();
  }, [projectId, router, versionId]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    setSaveState('pending');

    const timer = setTimeout(() => {
      const token = getAuthToken();
      if (!token) {
        router.replace('/auth');
        return;
      }

      const payload: UpdateVersionRequest = {
        components,
        edges,
        trafficProfile,
        notes: notes.trim() || null
      };

      void (async () => {
        try {
          setSaveState('saving');
          const response = await fetch(`${API_BASE_URL}/projects/${projectId}/versions/${versionId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            if (response.status === 401) {
              clearAuthToken();
              router.replace('/auth');
              return;
            }

            setSaveState('error');
            setError('Autosave failed.');
            return;
          }

          const updated = (await response.json()) as VersionDetail;
          setVersion(updated);
          setTrafficProfile(updated.trafficProfile);
          setSaveState('saved');
          setLastSavedAt(new Date().toLocaleTimeString());
        } catch {
          setSaveState('error');
          setError('Autosave failed.');
        }
      })();
    }, 900);

    return () => clearTimeout(timer);
  }, [components, edges, isLoaded, notes, projectId, router, trafficProfile, versionId]);

  function updateComponent(componentId: string, update: (component: ArchitectureComponent) => ArchitectureComponent) {
    setComponents((current) =>
      current.map((component) => {
        if (component.id !== componentId) {
          return component;
        }
        return update(component);
      })
    );
  }

  function updateComponentPosition(componentId: string, x: number, y: number) {
    updateComponent(componentId, (component) => ({
      ...component,
      position: {
        x: clamp(Math.round(x), 0, CANVAS_WIDTH - NODE_WIDTH),
        y: clamp(Math.round(y), 0, CANVAS_HEIGHT - NODE_HEIGHT)
      }
    }));
  }

  function updateSelectedComponent(update: (component: ArchitectureComponent) => ArchitectureComponent) {
    if (!selectedComponentId) {
      return;
    }

    updateComponent(selectedComponentId, update);
  }

  function addComponent(item: PaletteItem) {
    const node = defaultComponent(
      `${item.label} ${components.length + 1}`,
      item.type,
      item.stateful,
      components.length
    );

    setComponents((current) => [...current, node]);
    setSelectedComponentId(node.id);
    setError(null);
  }

  function removeComponent(componentId: string) {
    setComponents((current) => current.filter((component) => component.id !== componentId));
    setEdges((current) =>
      current.filter((edge) => edge.sourceId !== componentId && edge.targetId !== componentId)
    );
    if (selectedComponentId === componentId) {
      setSelectedComponentId(null);
    }
    if (linkSourceId === componentId) {
      setLinkSourceId('');
    }
    if (linkTargetId === componentId) {
      setLinkTargetId('');
    }
  }

  function connectComponents() {
    if (!linkSourceId || !linkTargetId) {
      setError('Select both source and target components to connect.');
      return;
    }

    if (linkSourceId === linkTargetId) {
      setError('Cannot connect a component to itself.');
      return;
    }

    const duplicate = edges.some((edge) => edge.sourceId === linkSourceId && edge.targetId === linkTargetId);
    if (duplicate) {
      setError('This connection already exists.');
      return;
    }

    const edge: ArchitectureEdge = {
      id: crypto.randomUUID(),
      sourceId: linkSourceId,
      targetId: linkTargetId
    };

    setEdges((current) => [...current, edge]);
    setError(null);
  }

  async function startSimulation() {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    setIsStartingSimulation(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/versions/${versionId}/simulate`, {
        method: 'POST',
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

        const payload = (await response.json()) as { message?: string };
        setError(payload.message || 'Unable to start simulation run.');
        return;
      }

      const payload = (await response.json()) as SimulationRunResponse;
      router.push(`/runs/${payload.run.id}`);
    } catch {
      setError('Unable to reach server.');
    } finally {
      setIsStartingSimulation(false);
    }
  }

  async function startGrade() {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    setIsStartingGrade(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/versions/${versionId}/grade`, {
        method: 'POST',
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

        const payload = (await response.json()) as { message?: string };
        setError(payload.message || 'Unable to start grading report.');
        return;
      }

      const payload = (await response.json()) as GradeReportResponse;
      router.push(`/grades/${payload.report.id}`);
    } catch {
      setError('Unable to reach server.');
    } finally {
      setIsStartingGrade(false);
    }
  }

  function startNodeDrag(event: PointerEvent<HTMLDivElement>, component: ArchitectureComponent) {
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }

    const displayPosition = getDisplayPosition(component);
    setSelectedComponentId(component.id);
    setDragState({
      componentId: component.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: displayPosition.x,
      originY: displayPosition.y
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function dragNode(event: PointerEvent<HTMLDivElement>, componentId: string) {
    if (!dragState || dragState.componentId !== componentId) {
      return;
    }

    const nextX = dragState.originX + event.clientX - dragState.startX;
    const nextY = dragState.originY + event.clientY - dragState.startY;
    updateComponentPosition(componentId, nextX, nextY);
  }

  function stopNodeDrag(event: PointerEvent<HTMLDivElement>, componentId: string) {
    if (dragState?.componentId !== componentId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDragState(null);
  }

  const saveLabel =
    saveState === 'saving'
      ? 'Saving...'
      : saveState === 'saved'
        ? `Saved at ${lastSavedAt}`
        : saveState === 'error'
          ? 'Save failed'
          : saveState === 'pending'
            ? 'Pending changes'
            : 'Ready';

  return (
    <main className="main-wide">
      <div className="page-stack">
        <section className="card">
          <p style={{ marginTop: 0 }}>
            <Link href={`/projects/${projectId}`}>Back to Project History</Link>
          </p>
          <p className="kicker">Design Workspace</p>
          <h1>{version ? `Version ${version.versionNumber}` : 'Loading version workspace...'}</h1>
          <p className="subtitle">Drag components onto the canvas and connect them to model your architecture graph.</p>
          <div className="button-row">
            <span className={`pill ${saveState === 'saved' ? 'pill-accent' : ''}`}>{saveLabel}</span>
            <span className="pill">
              Traffic: {trafficProfile.baselineRps} RPS • x{trafficProfile.peakMultiplier}
            </span>
            <button className="button" type="button" disabled={isStartingSimulation} onClick={() => void startSimulation()}>
              {isStartingSimulation ? 'Starting run...' : 'Run Simulation'}
            </button>
            <button className="button button-secondary" type="button" disabled={isStartingGrade} onClick={() => void startGrade()}>
              {isStartingGrade ? 'Starting grade...' : 'Run AI Grade'}
            </button>
            <Link className="button button-secondary" href={`/projects/${projectId}/versions/${versionId}/traffic`}>
              Edit Traffic Profile
            </Link>
            <Link className="button button-secondary" href={`/projects/${projectId}/compare`}>
              Compare Attempts
            </Link>
            <Link className="button button-secondary" href={`/projects/${projectId}/report`}>
              Final Report
            </Link>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </section>

        <div className="workspace-grid">
          <section className="card">
            <h2>Component Palette</h2>
            <p className="muted">Add nodes and then define source-target links.</p>
            <div className="palette-grid">
              {PALETTE.map((item) => (
                <button key={item.type} className="button button-secondary" type="button" onClick={() => addComponent(item)}>
                  Add {item.label}
                </button>
              ))}
            </div>

            <hr />

            <h3>Connect Components</h3>
            <label className="field">
              Source
              <select value={linkSourceId} onChange={(event) => setLinkSourceId(event.target.value)}>
                <option value="">Select source</option>
                {components.map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              Target
              <select value={linkTargetId} onChange={(event) => setLinkTargetId(event.target.value)}>
                <option value="">Select target</option>
                {components.map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.label}
                  </option>
                ))}
              </select>
            </label>

            <button className="button" type="button" onClick={connectComponents}>
              Connect
            </button>
          </section>

          <section className="card">
            <div className="split-row">
              <h2>Architecture Canvas</h2>
              <p className="muted">Drag nodes to lay out the graph.</p>
            </div>
            {components.length === 0 ? (
              <p className="muted">Add components from the palette to start building your design.</p>
            ) : (
              <div className="canvas-shell">
                <div className="canvas-board">
                  <svg className="canvas-edge-layer" viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}>
                    {edgeLines.map((edge) => (
                      <line key={edge.id} className="edge-line" x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} />
                    ))}
                  </svg>

                  {components.map((component) => {
                    const displayPosition = getDisplayPosition(component);

                    return (
                      <div
                        key={component.id}
                        className={`canvas-node ${component.id === selectedComponentId ? 'selected' : ''}`}
                        style={{
                          left: displayPosition.x,
                          top: displayPosition.y
                        }}
                        onClick={() => setSelectedComponentId(component.id)}
                        onPointerDown={(event) => startNodeDrag(event, component)}
                        onPointerMove={(event) => dragNode(event, component.id)}
                        onPointerUp={(event) => stopNodeDrag(event, component.id)}
                        onPointerCancel={(event) => stopNodeDrag(event, component.id)}
                      >
                        <div className="node-top">
                          <div>
                            <p className="node-title">{component.label}</p>
                            <p className="node-type">{component.type}</p>
                          </div>
                          <button className="node-remove" type="button" onClick={() => removeComponent(component.id)}>
                            remove
                          </button>
                        </div>
                        <p className="node-meta">Replicas {component.scaling.replicas}</p>
                        <p className="node-meta">{component.capacity.opsPerSecond} ops/s</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <h3 style={{ marginTop: '1rem' }}>Edges</h3>
            {edgeLines.length === 0 ? <p className="muted">No edges yet.</p> : null}
            <div className="edge-list">
              {edgeLines.map((edge) => (
                <div key={edge.id} className="edge-item">
                  <span>
                    {edge.sourceLabel} {'->'} {edge.targetLabel}
                  </span>
                  <button
                    className="button button-link"
                    type="button"
                    onClick={() => setEdges((current) => current.filter((item) => item.id !== edge.id))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>Configuration</h2>
            {!selectedComponent ? (
              <p className="muted">Select a component from the canvas to configure it.</p>
            ) : (
              <>
                <label className="field">
                  Label
                  <input
                    value={selectedComponent.label}
                    onChange={(event) =>
                      updateSelectedComponent((component) => ({
                        ...component,
                        label: event.target.value
                      }))
                    }
                  />
                </label>

                <div className="page-grid-two">
                  <label className="field">
                    Position X
                    <input
                      type="number"
                      min={0}
                      max={CANVAS_WIDTH - NODE_WIDTH}
                      value={getDisplayPosition(selectedComponent).x}
                      onChange={(event) =>
                        updateSelectedComponent((component) => ({
                          ...component,
                          position: {
                            ...component.position,
                            x: clamp(Number(event.target.value) || 0, 0, CANVAS_WIDTH - NODE_WIDTH)
                          }
                        }))
                      }
                    />
                  </label>

                  <label className="field">
                    Position Y
                    <input
                      type="number"
                      min={0}
                      max={CANVAS_HEIGHT - NODE_HEIGHT}
                      value={getDisplayPosition(selectedComponent).y}
                      onChange={(event) =>
                        updateSelectedComponent((component) => ({
                          ...component,
                          position: {
                            ...component.position,
                            y: clamp(Number(event.target.value) || 0, 0, CANVAS_HEIGHT - NODE_HEIGHT)
                          }
                        }))
                      }
                    />
                  </label>
                </div>

                <label className="field">
                  Horizontal Scale (Replicas)
                  <input
                    type="number"
                    min={1}
                    value={selectedComponent.scaling.replicas}
                    onChange={(event) =>
                      updateSelectedComponent((component) => ({
                        ...component,
                        scaling: {
                          ...component.scaling,
                          replicas: Math.max(1, Number(event.target.value) || 1)
                        }
                      }))
                    }
                  />
                </label>

                <label className="field">
                  Vertical Tier
                  <select
                    value={selectedComponent.scaling.verticalTier}
                    onChange={(event) =>
                      updateSelectedComponent((component) => ({
                        ...component,
                        scaling: {
                          ...component.scaling,
                          verticalTier: event.target.value as ArchitectureComponent['scaling']['verticalTier']
                        }
                      }))
                    }
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                    <option value="xlarge">XLarge</option>
                  </select>
                </label>

                <label className="field">
                  Capacity (ops/s)
                  <input
                    type="number"
                    min={1}
                    value={selectedComponent.capacity.opsPerSecond}
                    onChange={(event) =>
                      updateSelectedComponent((component) => ({
                        ...component,
                        capacity: {
                          ...component.capacity,
                          opsPerSecond: Math.max(1, Number(event.target.value) || 1)
                        }
                      }))
                    }
                  />
                </label>

                <div className="page-grid-two">
                  <label className="field">
                    CPU Cores
                    <input
                      type="number"
                      min={1}
                      value={selectedComponent.capacity.cpuCores}
                      onChange={(event) =>
                        updateSelectedComponent((component) => ({
                          ...component,
                          capacity: {
                            ...component.capacity,
                            cpuCores: Math.max(1, Number(event.target.value) || 1)
                          }
                        }))
                      }
                    />
                  </label>

                  <label className="field">
                    Memory (GB)
                    <input
                      type="number"
                      min={1}
                      value={selectedComponent.capacity.memoryGb}
                      onChange={(event) =>
                        updateSelectedComponent((component) => ({
                          ...component,
                          capacity: {
                            ...component.capacity,
                            memoryGb: Math.max(1, Number(event.target.value) || 1)
                          }
                        }))
                      }
                    />
                  </label>
                </div>

                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={selectedComponent.behavior.stateful}
                    onChange={(event) =>
                      updateSelectedComponent((component) => ({
                        ...component,
                        behavior: {
                          ...component.behavior,
                          stateful: event.target.checked
                        }
                      }))
                    }
                  />
                  Stateful component
                </label>
              </>
            )}

            <hr />

            <label className="field">
              Version Notes
              <textarea
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Capture assumptions or next design steps."
              />
            </label>

            <h3>Validation Warnings</h3>
            {warnings.length === 0 ? <p className="muted">No validation warnings.</p> : null}
            <div className="warning-list">
              {warnings.map((warning, index) => (
                <div key={`${warning.code}-${index}`} className="warning-item">
                  <p style={{ marginBottom: '0.15rem', fontWeight: 600 }}>{warning.code}</p>
                  <p style={{ marginBottom: 0 }}>{warning.message}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
