'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Zap,
  Plus,
  Folder,
  FolderPlus,
  Trash2,
  Pencil,
  Play,
  Pause,
  Copy,
  Loader2,
  Activity,
  Settings as SettingsIcon,
  LayoutTemplate,
  ListChecks,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  Instagram,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  TRIGGER_META,
  NICHE_LABELS,
  STATUS_LABELS,
  RUN_STATUS_LABELS,
} from '@/lib/automations/ui-meta';
import type { TriggerType } from '@/lib/automations/types';

const TOP_TABS = [
  { id: 'flujos', label: 'Flujos', icon: ListChecks },
  { id: 'plantillas', label: 'Plantillas', icon: LayoutTemplate },
  { id: 'contenido-ig', label: 'Contenido IG', icon: Instagram },
  { id: 'actividad', label: 'Actividad', icon: Activity },
  { id: 'configuracion', label: 'Configuración', icon: SettingsIcon },
] as const;

type TopTab = (typeof TOP_TABS)[number]['id'];

interface FolderT {
  id: string;
  name: string;
}

interface WorkflowT {
  id: string;
  name: string;
  description: string | null;
  status: string;
  folderId: string | null;
  trigger: { type: TriggerType; config: Record<string, any> };
  steps: any[];
  runsCount: number;
  lastRunAt: string | null;
  updatedAt: string;
  _count?: { runs: number };
}

interface TemplateT {
  id: string;
  niche: 'servicios' | 'retail' | 'mayoreo';
  name: string;
  description: string;
  trigger: { type: TriggerType; config: Record<string, any> };
  steps: any[];
}

interface RunT {
  id: string;
  workflowId: string;
  status: string;
  contactId: string | null;
  contactName: string | null;
  trigger: any;
  result: { log?: { step: string; ok: boolean; detail: string }[] } | null;
  error: string | null;
  createdAt: string;
  workflow: { id: string; name: string };
}

interface SettingsT {
  automationsEnabled: boolean;
  automationNotifyEmail: string | null;
  n8nWebhookUrl: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-muted',
  active: 'badge-success',
  paused: 'badge-warning',
};

const RUN_STATUS_BADGE: Record<string, string> = {
  success: 'badge-success',
  error: 'badge-error',
  skipped: 'badge-muted',
  pending: 'badge-gold',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AutomatizacionPage() {
  const [topTab, setTopTab] = useState<TopTab>('flujos');

  // ---- Flujos ----
  const [folders, setFolders] = useState<FolderT[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowT[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(true);
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // ---- Plantillas ----
  const [templates, setTemplates] = useState<TemplateT[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [nicheFilter, setNicheFilter] = useState<'todos' | 'servicios' | 'retail' | 'mayoreo'>('todos');

  // ---- Actividad ----
  const [runs, setRuns] = useState<RunT[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [runWorkflowFilter, setRunWorkflowFilter] = useState('');
  const [runStatusFilter, setRunStatusFilter] = useState('');
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  // ---- Configuración ----
  const [settings, setSettings] = useState<SettingsT | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingEnabled, setSavingEnabled] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // ============================================================
  // Carga de datos
  // ============================================================
  async function fetchWorkflows() {
    setLoadingWorkflows(true);
    try {
      const res = await fetch('/api/automations');
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        setWorkflows(data.workflows || []);
      }
    } catch {
      toast.error('Error de red al cargar los flujos.');
    } finally {
      setLoadingWorkflows(false);
    }
  }

  async function fetchTemplates() {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/automations/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {
      toast.error('Error de red al cargar las plantillas.');
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function fetchRuns() {
    setLoadingRuns(true);
    try {
      const params = new URLSearchParams();
      if (runWorkflowFilter) params.set('workflowId', runWorkflowFilter);
      if (runStatusFilter) params.set('status', runStatusFilter);
      params.set('limit', '100');
      const res = await fetch(`/api/automations/runs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch {
      toast.error('Error de red al cargar la actividad.');
    } finally {
      setLoadingRuns(false);
    }
  }

  async function fetchSettings() {
    setLoadingSettings(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const s = data.settings || {};
        setSettings({
          automationsEnabled: s.automationsEnabled ?? true,
          automationNotifyEmail: s.automationNotifyEmail ?? null,
          n8nWebhookUrl: s.n8nWebhookUrl ?? null,
        });
        setNotifyEmail(s.automationNotifyEmail || '');
      }
    } catch {
      toast.error('Error de red al cargar la configuración.');
    } finally {
      setLoadingSettings(false);
    }
  }

  useEffect(() => {
    fetchWorkflows();
    fetchTemplates();
    fetchSettings();
  }, []);

  useEffect(() => {
    if (topTab === 'actividad') fetchRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topTab, runWorkflowFilter, runStatusFilter]);

  // ============================================================
  // Carpetas
  // ============================================================
  async function createFolder() {
    if (!newFolderName.trim()) {
      toast.error('El nombre de la carpeta es requerido.');
      return;
    }
    setCreatingFolder(true);
    try {
      const res = await fetch('/api/automations/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });
      if (res.ok) {
        toast.success('Carpeta creada.');
        setShowFolderModal(false);
        setNewFolderName('');
        fetchWorkflows();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Error del servidor (${res.status})`);
      }
    } catch {
      toast.error('Error de red: no se pudo contactar al servidor.');
    } finally {
      setCreatingFolder(false);
    }
  }

  async function deleteFolder(id: string) {
    if (!confirm('¿Eliminar esta carpeta? Los flujos quedarán sin carpeta.')) return;
    try {
      const res = await fetch(`/api/automations/folders?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Carpeta eliminada.');
        if (folderFilter === id) setFolderFilter('all');
        fetchWorkflows();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Error del servidor (${res.status})`);
      }
    } catch {
      toast.error('Error de red: no se pudo contactar al servidor.');
    }
  }

  // ============================================================
  // Flujos
  // ============================================================
  async function createBlankWorkflow() {
    setCreatingWorkflow(true);
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Nuevo flujo sin título',
          folderId: folderFilter !== 'all' ? folderFilter : undefined,
          trigger: { type: 'contact.created', config: {} },
          steps: [],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = `/automatizacion/${data.workflow.id}`;
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Error del servidor (${res.status})`);
      }
    } catch {
      toast.error('Error de red: no se pudo contactar al servidor.');
    } finally {
      setCreatingWorkflow(false);
    }
  }

  async function useTemplate(templateId: string) {
    setCreatingWorkflow(true);
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success('Flujo creado desde la plantilla. Revísalo y actívalo cuando esté listo.');
        window.location.href = `/automatizacion/${data.workflow.id}`;
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Error del servidor (${res.status})`);
      }
    } catch {
      toast.error('Error de red: no se pudo contactar al servidor.');
    } finally {
      setCreatingWorkflow(false);
    }
  }

  async function toggleStatus(wf: WorkflowT) {
    const next = wf.status === 'active' ? 'paused' : 'active';
    setBusyId(wf.id);
    try {
      const res = await fetch(`/api/automations/${wf.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        toast.success(next === 'active' ? 'Flujo activado.' : 'Flujo pausado.');
        fetchWorkflows();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Error del servidor (${res.status})`);
      }
    } catch {
      toast.error('Error de red: no se pudo contactar al servidor.');
    } finally {
      setBusyId(null);
    }
  }

  async function duplicateWorkflow(wf: WorkflowT) {
    setBusyId(wf.id);
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${wf.name} (copia)`,
          description: wf.description,
          folderId: wf.folderId,
          trigger: wf.trigger,
          steps: wf.steps,
        }),
      });
      if (res.ok) {
        toast.success('Flujo duplicado como borrador.');
        fetchWorkflows();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Error del servidor (${res.status})`);
      }
    } catch {
      toast.error('Error de red: no se pudo contactar al servidor.');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteWorkflow(id: string) {
    if (!confirm('¿Eliminar este flujo permanentemente? Se borrará su historial de ejecuciones.')) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/automations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Flujo eliminado.');
        fetchWorkflows();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Error del servidor (${res.status})`);
      }
    } catch {
      toast.error('Error de red: no se pudo contactar al servidor.');
    } finally {
      setBusyId(null);
    }
  }

  // ============================================================
  // Configuración
  // ============================================================
  async function toggleAutomationsEnabled() {
    if (!settings) return;
    const next = !settings.automationsEnabled;
    setSavingEnabled(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automationsEnabled: next }),
      });
      if (res.ok) {
        setSettings({ ...settings, automationsEnabled: next });
        toast.success(next ? 'Automatización activada.' : 'Automatización pausada globalmente.');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Error del servidor (${res.status})`);
      }
    } catch {
      toast.error('Error de red: no se pudo contactar al servidor.');
    } finally {
      setSavingEnabled(false);
    }
  }

  async function saveNotifyEmail() {
    if (!settings) return;
    setSavingEmail(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automationNotifyEmail: notifyEmail.trim() || null }),
      });
      if (res.ok) {
        setSettings({ ...settings, automationNotifyEmail: notifyEmail.trim() || null });
        toast.success('Correo de notificaciones guardado.');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Error del servidor (${res.status})`);
      }
    } catch {
      toast.error('Error de red: no se pudo contactar al servidor.');
    } finally {
      setSavingEmail(false);
    }
  }

  // ============================================================
  // Derivados
  // ============================================================
  const filteredWorkflows = folderFilter === 'all' ? workflows : workflows.filter((w) => w.folderId === folderFilter);
  const filteredTemplates = nicheFilter === 'todos' ? templates : templates.filter((t) => t.niche === nicheFilter);
  const selectedFolder = folders.find((f) => f.id === folderFilter);

  const activeCount = workflows.filter((w) => w.status === 'active').length;
  const totalRuns = workflows.reduce((sum, w) => sum + (w._count?.runs ?? w.runsCount ?? 0), 0);

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="container">
      <div className="mb-6 row-between">
        <div>
          <h1 className="h1" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={24} color="var(--rai-gold)" /> Automatización
          </h1>
          <p className="muted">
            Diseña flujos que reaccionan a eventos del CRM (nuevos contactos, citas, etiquetas) o que corren en
            segundo plano según el calendario, sin tocar una sola línea de código.
          </p>
        </div>
        <div className="row" style={{ gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--rai-gold)' }}>{activeCount}</div>
            <div className="muted" style={{ fontSize: 12 }}>Flujos activos</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{totalRuns}</div>
            <div className="muted" style={{ fontSize: 12 }}>Ejecuciones totales</div>
          </div>
        </div>
      </div>

      {/* Aviso si está pausado globalmente */}
      {settings && !settings.automationsEnabled && (
        <div
          className="card mb-6"
          style={{ background: 'rgba(230,57,70,0.06)', borderColor: 'rgba(230,57,70,0.4)', display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <AlertTriangle size={20} color="var(--rai-error)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>La automatización está pausada globalmente</div>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              Ningún flujo se ejecutará (aunque esté "Activo") hasta que la reactives en Configuración.
            </p>
          </div>
          <button className="primary" onClick={() => setTopTab('configuracion')}>Ir a Configuración</button>
        </div>
      )}

      {/* Top tabs */}
      <div className="row mb-6" style={{ gap: 8, borderBottom: '1px solid var(--rai-border)', paddingBottom: 0 }}>
        {TOP_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = topTab === tab.id;
          return (
            <button
              key={tab.id}
              className="ghost"
              onClick={() => setTopTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: '8px 8px 0 0',
                border: '1px solid var(--rai-border)',
                borderBottom: active ? '3px solid var(--rai-gold)' : '1px solid var(--rai-border)',
                color: active ? 'var(--rai-gold)' : 'var(--rai-muted)',
                fontWeight: active ? 600 : 400,
                background: active ? 'var(--rai-card)' : 'transparent',
                boxShadow: active ? '0 -2px 8px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ===================== TAB: FLUJOS ===================== */}
      {topTab === 'flujos' && (
        <div className="grid" style={{ gridTemplateColumns: '240px 1fr', gap: 24, alignItems: 'start' }}>
          {/* Sidebar de carpetas */}
          <div className="card">
            <div className="row-between mb-4">
              <span style={{ fontWeight: 600 }}>Carpetas</span>
              <button className="btn-sm secondary" onClick={() => setShowFolderModal(true)}>
                <FolderPlus size={14} /> Nueva
              </button>
            </div>
            <div
              onClick={() => setFolderFilter('all')}
              className="row-between"
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                marginBottom: 4,
                background: folderFilter === 'all' ? 'rgba(201,168,76,0.1)' : 'transparent',
                color: folderFilter === 'all' ? 'var(--rai-gold)' : 'var(--rai-text)',
                fontWeight: folderFilter === 'all' ? 600 : 400,
              }}
            >
              <span>Todos los flujos</span>
              <span className="muted">{workflows.length}</span>
            </div>
            {folders.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, padding: '8px 10px' }}>
                Sin carpetas aún. Crea una para organizar tus flujos por área (servicios, retail, mayoreo...).
              </p>
            ) : (
              folders.map((f) => (
                <div
                  key={f.id}
                  onClick={() => setFolderFilter(f.id)}
                  className="row-between"
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    marginBottom: 4,
                    background: folderFilter === f.id ? 'rgba(201,168,76,0.1)' : 'transparent',
                    color: folderFilter === f.id ? 'var(--rai-gold)' : 'var(--rai-text)',
                    fontWeight: folderFilter === f.id ? 600 : 400,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Folder size={13} /> {f.name}
                  </span>
                  <Trash2
                    size={13}
                    style={{ cursor: 'pointer', flexShrink: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFolder(f.id);
                    }}
                  />
                </div>
              ))
            )}
          </div>

          {/* Lista de flujos */}
          <div className="card">
            <div className="row-between mb-4">
              <span style={{ fontWeight: 600 }}>
                {folderFilter === 'all' ? 'Todos los flujos' : selectedFolder?.name || 'Flujos'}
              </span>
              <button className="primary" onClick={createBlankWorkflow} disabled={creatingWorkflow}>
                {creatingWorkflow ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Nuevo flujo
              </button>
            </div>

            {loadingWorkflows ? (
              <div className="row" style={{ justifyContent: 'center', padding: 20 }}>
                <Loader2 className="animate-spin" size={20} />
              </div>
            ) : filteredWorkflows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Zap size={32} className="muted" style={{ marginBottom: 8 }} />
                <p className="muted">No hay flujos en esta vista todavía.</p>
                <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 12 }}>
                  <button className="primary" onClick={createBlankWorkflow} disabled={creatingWorkflow}>
                    <Plus size={14} /> Crear flujo en blanco
                  </button>
                  <button className="secondary" onClick={() => setTopTab('plantillas')}>
                    <LayoutTemplate size={14} /> Ver plantillas
                  </button>
                </div>
              </div>
            ) : (
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Flujo</th>
                    <th>Disparador</th>
                    <th>Pasos</th>
                    <th>Estado</th>
                    <th>Ejecuciones</th>
                    <th>Última corrida</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkflows.map((wf) => {
                    const trigMeta = TRIGGER_META[wf.trigger?.type as TriggerType];
                    return (
                      <tr key={wf.id}>
                        <td>
                          <Link href={`/automatizacion/${wf.id}`} style={{ fontWeight: 600, color: 'var(--rai-text)', textDecoration: 'none' }}>
                            {wf.name}
                          </Link>
                          {wf.description && <div className="muted" style={{ fontSize: 12 }}>{wf.description}</div>}
                        </td>
                        <td>
                          <span className="muted" style={{ fontSize: 13 }}>
                            {trigMeta?.label || wf.trigger?.type || '—'}
                          </span>
                        </td>
                        <td>{wf.steps?.length ?? 0}</td>
                        <td>
                          <span className={STATUS_BADGE[wf.status] || 'badge-muted'}>
                            {STATUS_LABELS[wf.status] || wf.status}
                          </span>
                        </td>
                        <td>{wf._count?.runs ?? wf.runsCount ?? 0}</td>
                        <td className="muted" style={{ fontSize: 13 }}>{fmtDate(wf.lastRunAt)}</td>
                        <td>
                          <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
                            {busyId === wf.id ? (
                              <Loader2 className="animate-spin" size={14} />
                            ) : (
                              <>
                                {wf.status === 'active' ? (
                                  <span title="Pausar" style={{ display: 'flex' }}>
                                    <Pause size={14} style={{ cursor: 'pointer' }} onClick={() => toggleStatus(wf)} />
                                  </span>
                                ) : (
                                  <span title="Activar" style={{ display: 'flex' }}>
                                    <Play size={14} style={{ cursor: 'pointer' }} onClick={() => toggleStatus(wf)} />
                                  </span>
                                )}
                                <span title="Editar" style={{ display: 'flex' }}>
                                  <Pencil size={14} style={{ cursor: 'pointer' }} onClick={() => { window.location.href = `/automatizacion/${wf.id}`; }} />
                                </span>
                                <span title="Duplicar" style={{ display: 'flex' }}>
                                  <Copy size={14} style={{ cursor: 'pointer' }} onClick={() => duplicateWorkflow(wf)} />
                                </span>
                                <span title="Eliminar" style={{ display: 'flex' }}>
                                  <Trash2 size={14} style={{ cursor: 'pointer' }} onClick={() => deleteWorkflow(wf.id)} />
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal: Nueva carpeta */}
      {showFolderModal && (
        <div className="modal-backdrop" onClick={() => setShowFolderModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row-between mb-4">
              <h3 style={{ margin: 0 }}>Nueva carpeta</h3>
              <X size={18} style={{ cursor: 'pointer' }} onClick={() => setShowFolderModal(false)} />
            </div>
            <div className="mb-6">
              <label className="muted" style={{ fontSize: 12 }}>Nombre</label>
              <input
                className="input"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ej. Mayoreo"
                style={{ width: '100%' }}
                onKeyDown={(e) => e.key === 'Enter' && createFolder()}
              />
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="ghost" onClick={() => setShowFolderModal(false)}>Cancelar</button>
              <button className="primary" onClick={createFolder} disabled={creatingFolder}>
                {creatingFolder ? <Loader2 className="animate-spin" size={14} /> : 'Crear carpeta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB: PLANTILLAS ===================== */}
      {topTab === 'plantillas' && (
        <div>
          <div className="row mb-6" style={{ gap: 8 }}>
            <button className={nicheFilter === 'todos' ? 'primary' : 'ghost'} onClick={() => setNicheFilter('todos')}>
              Todas
            </button>
            <button className={nicheFilter === 'servicios' ? 'primary' : 'ghost'} onClick={() => setNicheFilter('servicios')}>
              {NICHE_LABELS.servicios}
            </button>
            <button className={nicheFilter === 'retail' ? 'primary' : 'ghost'} onClick={() => setNicheFilter('retail')}>
              {NICHE_LABELS.retail}
            </button>
            <button className={nicheFilter === 'mayoreo' ? 'primary' : 'ghost'} onClick={() => setNicheFilter('mayoreo')}>
              {NICHE_LABELS.mayoreo}
            </button>
          </div>

          {loadingTemplates ? (
            <div className="row" style={{ justifyContent: 'center', padding: 40 }}>
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {filteredTemplates.map((tpl) => {
                const trigMeta = TRIGGER_META[tpl.trigger?.type as TriggerType];
                return (
                  <div key={tpl.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="row-between mb-2">
                      <span className="badge-gold" style={{ fontSize: 11 }}>{NICHE_LABELS[tpl.niche]}</span>
                      <span className="muted" style={{ fontSize: 11 }}>{tpl.steps.length} pasos</span>
                    </div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{tpl.name}</h3>
                    <p className="muted" style={{ fontSize: 13, flex: 1 }}>{tpl.description}</p>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
                      <strong>Disparador:</strong> {trigMeta?.label || tpl.trigger?.type}
                    </div>
                    <button className="primary" onClick={() => useTemplate(tpl.id)} disabled={creatingWorkflow}>
                      {creatingWorkflow ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Usar plantilla
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB: ACTIVIDAD ===================== */}
      {topTab === 'actividad' && (
        <div className="card">
          <div className="row mb-4" style={{ gap: 8 }}>
            <select className="input" style={{ width: 240 }} value={runWorkflowFilter} onChange={(e) => setRunWorkflowFilter(e.target.value)}>
              <option value="">Todos los flujos</option>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <select className="input" style={{ width: 200 }} value={runStatusFilter} onChange={(e) => setRunStatusFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              {Object.entries(RUN_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {loadingRuns ? (
            <div className="row" style={{ justifyContent: 'center', padding: 20 }}>
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : runs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Activity size={32} className="muted" style={{ marginBottom: 8 }} />
              <p className="muted">Aún no hay ejecuciones registradas.</p>
              <p className="muted" style={{ fontSize: 12 }}>
                Activa un flujo y dispara su evento (o espera la próxima corrida del cron) para ver actividad aquí.
              </p>
            </div>
          ) : (
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Flujo</th>
                  <th>Disparador</th>
                  <th>Contacto</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr>
                      <td style={{ fontWeight: 600 }}>{r.workflow?.name || '—'}</td>
                      <td className="muted" style={{ fontSize: 13 }}>{r.trigger?.type || '—'}</td>
                      <td>{r.contactName || <span className="muted">—</span>}</td>
                      <td>
                        <span className={RUN_STATUS_BADGE[r.status] || 'badge-muted'}>
                          {RUN_STATUS_LABELS[r.status] || r.status}
                        </span>
                      </td>
                      <td className="muted" style={{ fontSize: 13 }}>{fmtDate(r.createdAt)}</td>
                      <td>
                        {r.result?.log && r.result.log.length > 0 && (
                          <button
                            className="btn-sm ghost"
                            onClick={() => setExpandedRun(expandedRun === r.id ? null : r.id)}
                          >
                            {expandedRun === r.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Detalle
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedRun === r.id && r.result?.log && (
                      <tr>
                        <td colSpan={6}>
                          <div style={{ background: 'var(--rai-dark)', borderRadius: 8, padding: 12 }}>
                            {r.result.log.map((entry, i) => (
                              <div key={i} className="row" style={{ gap: 8, fontSize: 12, marginBottom: 4, alignItems: 'flex-start' }}>
                                <span className={entry.ok ? 'badge-success' : 'badge-error'} style={{ fontSize: 10, flexShrink: 0 }}>
                                  {entry.ok ? 'OK' : 'X'}
                                </span>
                                <span className="muted">{entry.step}:</span>
                                <span>{entry.detail}</span>
                              </div>
                            ))}
                            {r.error && (
                              <div className="muted" style={{ fontSize: 12, marginTop: 6, color: 'var(--rai-error)' }}>
                                Error: {r.error}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ===================== TAB: CONTENIDO IG ===================== */}
      {topTab === 'contenido-ig' && (
        <div className="card" style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(24px, 5vw, 48px)' }}>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 56,
                height: 56,
                margin: '0 auto 16px',
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--rai-gold)',
                background: 'rgba(201,168,76,0.1)',
                border: '1px solid rgba(201,168,76,0.3)',
              }}
            >
              <Instagram size={26} />
            </div>
            <span className="badge-gold">Fuente única de contenido</span>
            <h2 style={{ margin: '16px 0 8px', fontSize: 'clamp(20px, 4vw, 28px)' }}>
              Programa y revisa tus publicaciones en el calendario
            </h2>
            <p className="muted" style={{ maxWidth: 580, margin: '0 auto 24px', lineHeight: 1.6 }}>
              El Calendario de contenido es ahora el único lugar para programar y revisar publicaciones de Instagram,
              evitando estados duplicados entre secciones.
            </p>
            <Link href="/calendario-contenido" className="btn btn-primary">
              Ir al Calendario de contenido <ExternalLink size={15} />
            </Link>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              marginTop: 28,
              padding: 14,
              borderRadius: 8,
              background: 'rgba(136,136,170,0.05)',
              border: '1px solid var(--rai-border)',
            }}
          >
            <Sparkles size={17} color="var(--rai-gold)" style={{ flexShrink: 0, marginTop: 1 }} />
            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
              La planificación asistida por IA y la configuración de marca se incorporarán gradualmente a esta
              experiencia.
            </p>
          </div>
        </div>
      )}

      {/* ===================== TAB: CONFIGURACIÓN ===================== */}
      {topTab === 'configuracion' && (
        <div className="grid" style={{ gap: 16, maxWidth: 760 }}>
          <div className="card">
            <div className="row-between">
              <div>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Zap size={15} /> Motor de automatización
                </div>
                <p className="muted" style={{ fontSize: 13, marginTop: 4, maxWidth: 480 }}>
                  Interruptor general. Si lo desactivas, ningún flujo se ejecutará (ni por eventos ni por el cron),
                  aunque esté marcado como "Activo". Útil para pausar todo de golpe.
                </p>
              </div>
              <div>
                {loadingSettings ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <button className={settings?.automationsEnabled ? 'primary' : 'danger'} onClick={toggleAutomationsEnabled} disabled={savingEnabled}>
                    {savingEnabled ? <Loader2 className="animate-spin" size={14} /> : settings?.automationsEnabled ? 'Activado' : 'Desactivado'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Activity size={15} /> Correo de alertas internas
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Dirección donde recibirás un resumen si un flujo crítico falla repetidamente (próximamente vía email; hoy
              se usa como referencia para tus webhooks de notificación).
            </p>
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input"
                type="email"
                placeholder="gerencia@tuempresa.com"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="secondary" onClick={saveNotifyEmail} disabled={savingEmail}>
                {savingEmail ? <Loader2 className="animate-spin" size={14} /> : 'Guardar'}
              </button>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <ExternalLink size={15} /> Webhook de notificaciones (n8n)
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Los pasos de tipo "Enviar notificación" usan la URL configurada en Configuración general → Conexión n8n.
              {settings?.n8nWebhookUrl ? ' Actualmente configurado.' : ' Aún no configurada: esos pasos se registrarán como omitidos.'}
            </p>
            <Link href="/settings">
              <button className="ghost">
                <SettingsIcon size={14} /> Ir a Configuración general
              </button>
            </Link>
          </div>

          <div className="card" style={{ background: 'rgba(136,136,170,0.05)' }}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Sparkles size={15} /> Constructor con IA
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Describe el flujo que necesitas en lenguaje natural y deja que la IA arme el disparador y los pasos por ti.
            </p>
            <button className="ghost" disabled>
              Próximamente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
