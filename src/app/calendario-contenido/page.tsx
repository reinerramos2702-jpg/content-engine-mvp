'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch, UnauthorizedError } from '@/lib/client-api';
import { Button } from '@/components/ui/Button';
import { CalendarBoard } from '@/components/content-calendar/CalendarBoard';
import { CalendarSettingsDialog } from '@/components/content-calendar/CalendarSettingsDialog';
import { PostEditor } from '@/components/content-calendar/PostEditor';
import {
  DEFAULT_SETTINGS,
  postDay,
  postTime,
  scheduledISOString,
  startOfWeek,
  toYMD,
  visibleRange,
  type CalendarSettings,
  type CalendarView,
  type ContentPost,
  type MediaType,
  type Network,
  type PostStatus,
} from '@/components/content-calendar/calendar-utils';
import styles from '@/components/content-calendar/content-calendar.module.css';
import { hasPermission, type Role } from '@/lib/roles-shared';

const KNOWN_STATUSES = new Set<PostStatus>(['draft', 'pending_approval', 'scheduled', 'publishing', 'published', 'error']);

function normalizePost(value: unknown): ContentPost | null {
  if (!value || typeof value !== 'object') return null;
  const post = value as Record<string, unknown>;
  if (typeof post.id !== 'string') return null;
  const rawStatus = typeof post.status === 'string' ? post.status : 'draft';
  const status = rawStatus === 'failed' ? 'error' : KNOWN_STATUSES.has(rawStatus as PostStatus) ? rawStatus as PostStatus : 'draft';
  const media = Array.isArray(post.media) ? post.media.filter((item): item is ContentPost['media'][number] => !!item && typeof item === 'object' && typeof (item as { url?: unknown }).url === 'string') : [];
  const networks = Array.isArray(post.networks) ? post.networks.filter((item): item is Network => item === 'instagram' || item === 'facebook') : [];
  const mediaType = ['image', 'carousel', 'reel', 'video'].includes(String(post.mediaType)) ? post.mediaType as MediaType : 'image';
  return {
    id: post.id,
    title: typeof post.title === 'string' ? post.title : null,
    caption: typeof post.caption === 'string' ? post.caption : null,
    day: typeof post.day === 'string' ? post.day : null,
    time: typeof post.time === 'string' ? post.time : null,
    scheduledFor: typeof post.scheduledFor === 'string' ? post.scheduledFor : null,
    status,
    networks,
    mediaType,
    media,
  };
}

async function errorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === 'string' ? body.error : fallback;
}

export default function CalendarioContenidoPage() {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<CalendarView>('week');
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [settings, setSettings] = useState<CalendarSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [editingPost, setEditingPost] = useState<ContentPost | null>(null);
  const [defaultDay, setDefaultDay] = useState(toYMD(new Date()));

  const loadPosts = useCallback(async () => {
    const range = visibleRange(anchor, view);
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`/api/content-posts?from=${range.from}&to=${range.to}`);
      if (!response.ok) throw new Error(await errorMessage(response, 'No se pudieron cargar las publicaciones.'));
      const payload = await response.json();
      const values: unknown[] = Array.isArray(payload) ? payload : Array.isArray(payload.posts) ? payload.posts : [];
      setPosts(values.map(normalizePost).filter((post): post is ContentPost => post !== null));
    } catch (cause) {
      if (!(cause instanceof UnauthorizedError)) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el calendario.');
    } finally { setLoading(false); }
  }, [anchor, view]);

  const loadSettings = useCallback(async () => {
    try {
      const response = await apiFetch('/api/content-calendar/settings');
      if (!response.ok) return;
      const payload = await response.json();
      setSettings({ ...DEFAULT_SETTINGS, ...(payload.settings || payload) });
    } catch (cause) {
      if (!(cause instanceof UnauthorizedError)) toast.error('No se pudieron cargar los ajustes del calendario.');
    }
  }, []);

  useEffect(() => { void loadPosts(); }, [loadPosts]);
  useEffect(() => { void loadSettings(); }, [loadSettings]);
  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/me')
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!cancelled && payload?.role) setCanManage(hasPermission(payload.role as Role, 'canManageContent'));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function createPost(day: string) {
    setEditingPost(null);
    setDefaultDay(day);
    setEditorOpen(true);
  }

  async function movePost(post: ContentPost, day: string) {
    const previous = posts;
    const time = postTime(post) || settings.defaultPostTime;
    const scheduledFor = scheduledISOString(day, time, settings.timezone);
    setPosts((current) => current.map((item) => item.id === post.id ? { ...item, day, time, scheduledFor, status: item.status === 'draft' ? 'scheduled' : item.status } : item));
    try {
      const response = await apiFetch(`/api/content-posts/${post.id}`, { method: 'PATCH', body: JSON.stringify({ scheduledFor }) });
      if (!response.ok) throw new Error(await errorMessage(response, 'No se pudo mover la publicación.'));
      const payload = await response.json().catch(() => null);
      const saved = normalizePost(payload?.post || payload);
      if (saved) setPosts((current) => current.map((item) => item.id === saved.id ? saved : item));
      toast.success(`Publicación movida al ${day}.`);
    } catch (cause) {
      setPosts(previous);
      if (!(cause instanceof UnauthorizedError)) toast.error(cause instanceof Error ? `${cause.message} Se revirtió el cambio.` : 'No se pudo mover. Se revirtió el cambio.');
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><h1 className="h1">Calendario de Contenido</h1><p className="muted">Planifica, previsualiza y organiza las publicaciones de tu marca.</p></div>
        <div className={styles.headerActions}>
          {canManage && <Button variant="secondary" onClick={() => setSettingsOpen(true)} title="Configurar zona horaria y frecuencia"><Settings size={16} /> Ajustes</Button>}
          {canManage && <Button onClick={() => createPost(toYMD(new Date()))} title="Crear una nueva publicación"><Plus size={16} /> Nueva publicación</Button>}
        </div>
      </header>
      {error && <div className={styles.banner} role="alert"><span>{error}</span><Button variant="ghost" size="sm" onClick={loadPosts}><RefreshCw size={14} /> Reintentar</Button></div>}
       <CalendarBoard canManage={canManage} anchor={anchor} view={view} posts={posts} loading={loading} onAnchorChange={setAnchor} onViewChange={setView} onCreate={createPost} onEdit={(post) => { setEditingPost(post); setDefaultDay(post.day || toYMD(new Date())); setEditorOpen(true); }} onMove={movePost} />
       {canManage && <PostEditor open={editorOpen} post={editingPost} defaultDay={defaultDay} settings={settings} occupiedDays={posts.map(postDay).filter((day): day is string => day !== null)} onClose={() => setEditorOpen(false)} onChanged={loadPosts} />}
       {canManage && <CalendarSettingsDialog open={settingsOpen} settings={settings} onClose={() => setSettingsOpen(false)} onSaved={(updated) => { setSettings(updated); toast.success('Ajustes guardados.'); }} />}
    </main>
  );
}
