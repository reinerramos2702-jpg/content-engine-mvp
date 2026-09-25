'use client';
/* eslint-disable @next/next/no-img-element -- El preview acepta URLs blob locales y media R2 dinámica. */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, FileUp, Image as ImageIcon, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch, UnauthorizedError } from '@/lib/client-api';
import { Button } from '@/components/ui/Button';
import {
  distributeFiles,
  scheduledISOString,
  type CalendarSettings,
  type ContentPost,
  type MediaType,
  type Network,
} from './calendar-utils';
import styles from './content-calendar.module.css';

interface PostEditorProps {
  open: boolean;
  post: ContentPost | null;
  defaultDay: string;
  settings: CalendarSettings;
  occupiedDays: string[];
  onClose: () => void;
  onChanged: () => void;
}

interface UploadedFile {
  url: string;
  fileName?: string;
  kind: 'image' | 'video';
  mimeType?: string | null;
  sizeBytes?: number | null;
  r2Key?: string | null;
}

async function responseError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return typeof body?.error === 'string' ? body.error : fallback;
}

function uploadedFromPayload(payload: unknown, fallbackName: string): UploadedFile | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  const mediaList = Array.isArray(value.media) ? value.media : [];
  const nested = (value.file || mediaList[0] || value.media || value.asset) as Record<string, unknown> | undefined;
  const url = typeof value.url === 'string' ? value.url : typeof nested?.url === 'string' ? nested.url : null;
  if (!url) return null;
  return {
    url,
    fileName: typeof value.fileName === 'string' ? value.fileName : typeof nested?.fileName === 'string' ? nested.fileName : fallbackName,
    kind: nested?.kind === 'video' ? 'video' : 'image',
    mimeType: typeof nested?.mimeType === 'string' ? nested.mimeType : null,
    sizeBytes: typeof nested?.sizeBytes === 'number' ? nested.sizeBytes : null,
    r2Key: typeof nested?.r2Key === 'string' ? nested.r2Key : null,
  };
}

async function uploadFiles(files: File[]): Promise<UploadedFile[]> {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  const response = await apiFetch('/api/content-calendar/upload', { method: 'POST', body: form });
  if (!response.ok) throw new Error(await responseError(response, 'No se pudieron subir los archivos.'));
  const payload = await response.json();
  const media = Array.isArray(payload?.media) ? payload.media : [];
  const uploaded = media.map((item: unknown, index: number) =>
    uploadedFromPayload({ file: item }, files[index]?.name || `archivo-${index + 1}`)
  ).filter((item: UploadedFile | null): item is UploadedFile => item !== null);
  if (uploaded.length !== files.length) throw new Error('La subida no devolvió todos los archivos.');
  return uploaded;
}

async function uploadDistributedFiles(args: {
  files: File[];
  startDay: string;
  defaultTime: string;
  networks: Network[];
  title: string;
  caption: string;
}): Promise<void> {
  const form = new FormData();
  args.files.forEach((file) => form.append('files', file));
  form.append('startDay', args.startDay);
  form.append('defaultTime', args.defaultTime);
  form.append('networks', args.networks.join(','));
  if (args.title.trim()) form.append('title', args.title.trim());
  if (args.caption.trim()) form.append('caption', args.caption);
  const response = await apiFetch('/api/content-posts/upload', { method: 'POST', body: form });
  if (!response.ok) throw new Error(await responseError(response, 'No se pudieron distribuir los archivos.'));
}

export function PostEditor({ open, post, defaultDay, settings, occupiedDays, onClose, onChanged }: PostEditorProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [day, setDay] = useState(defaultDay);
  const [time, setTime] = useState(settings.defaultPostTime);
  const [networks, setNetworks] = useState<Network[]>(['instagram']);
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [files, setFiles] = useState<File[]>([]);
  const [separatePosts, setSeparatePosts] = useState(false);
  const [distributionConfirmed, setDistributionConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    setTitle(post?.title || '');
    setCaption(post?.caption || '');
    setDay(post?.day || post?.scheduledFor?.slice(0, 10) || defaultDay);
    setTime(post?.time || settings.defaultPostTime);
    setNetworks(post?.networks?.length ? post.networks : ['instagram']);
    setMediaType(post?.mediaType || 'image');
    setFiles([]);
    setSeparatePosts(false);
    setDistributionConfirmed(false);
    setError('');
    requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus.current?.focus();
    };
  }, [open, post, defaultDay, settings.defaultPostTime, onClose]);

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  const distribution = useMemo(
    () => distributeFiles(files.map((file) => file.name), day, time, settings.maxPostsPerDay, occupiedDays),
    [files, day, time, settings.maxPostsPerDay, occupiedDays],
  );

  if (!open) return null;

  function toggleNetwork(network: Network) {
    setNetworks((current) => current.includes(network) ? current.filter((item) => item !== network) : [...current, network]);
  }

  async function save(asDraft = false) {
    if (!networks.length) { setError('Selecciona al menos una red.'); return; }
    if (!asDraft && (!day || !time)) { setError('Indica fecha y hora.'); return; }
    if (separatePosts && files.length > 1 && !distributionConfirmed) { setError('Confirma la distribución antes de guardar.'); return; }
    setSaving(true);
    setError('');
    try {
      if (separatePosts && files.length > 1 && !post && !asDraft) {
        await uploadDistributedFiles({ files, startDay: day, defaultTime: time, networks, title, caption });
        toast.success(`${files.length} publicaciones creadas y distribuidas.`);
      } else {
        const uploaded = files.length ? await uploadFiles(files) : [];
        const existingMedia = post?.media?.map((item) => ({
          url: item.url,
          kind: item.kind || (item.mimeType?.startsWith('video/') ? 'video' : 'image'),
          mimeType: item.mimeType || null,
          fileName: item.fileName || null,
          sizeBytes: item.sizeBytes || null,
          r2Key: item.r2Key || null,
        })) || [];
        const response = await apiFetch(post ? `/api/content-posts/${post.id}` : '/api/content-posts', {
          method: post ? 'PATCH' : 'POST',
          body: JSON.stringify({
            title: title.trim() || null,
            caption: caption.trim() || null,
            media: [...existingMedia, ...uploaded],
            networks,
            mediaType: uploaded.length + existingMedia.length > 1 && mediaType === 'image' ? 'carousel' : mediaType,
            scheduledFor: asDraft ? null : scheduledISOString(day, time, settings.timezone),
          }),
        });
        if (!response.ok) throw new Error(await responseError(response, 'No se pudo guardar la publicación.'));
        toast.success(asDraft ? 'Borrador guardado.' : post ? 'Publicación actualizada.' : 'Publicación creada.');
      }
      onChanged();
      onClose();
    } catch (cause) {
      if (!(cause instanceof UnauthorizedError)) setError(cause instanceof Error ? cause.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!post || !window.confirm('¿Eliminar esta publicación? Esta acción no se puede deshacer.')) return;
    setDeleting(true);
    setError('');
    try {
      const response = await apiFetch(`/api/content-posts/${encodeURIComponent(post.id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await responseError(response, 'No se pudo eliminar la publicación.'));
      toast.success('Publicación eliminada.');
      onChanged();
      onClose();
    } catch (cause) {
      if (!(cause instanceof UnauthorizedError)) setError(cause instanceof Error ? cause.message : 'No se pudo eliminar.');
    } finally { setDeleting(false); }
  }

  async function duplicate() {
    if (!post) return;
    setDuplicating(true);
    setError('');
    try {
      const response = await apiFetch(`/api/content-posts/${post.id}/duplicate`, { method: 'POST' });
      if (!response.ok) throw new Error(await responseError(response, 'No se pudo duplicar la publicación.'));
      toast.success('Publicación duplicada.');
      onChanged();
      onClose();
    } catch (cause) {
      if (!(cause instanceof UnauthorizedError)) setError(cause instanceof Error ? cause.message : 'No se pudo duplicar.');
    } finally { setDuplicating(false); }
  }

  const previewUrl = previews[0]?.url || post?.media?.[0]?.thumbUrl || post?.media?.[0]?.url;
  const previewIsVideo = previews[0]?.file.type.startsWith('video/') || post?.media?.[0]?.kind === 'video';

  return (
    <div className={styles.dialogBackdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="post-editor-title">
        <header className={styles.dialogHeader}>
          <h2 id="post-editor-title">{post ? 'Editar publicación' : 'Nueva publicación'}</h2>
          <button ref={closeRef} className={styles.iconButton} onClick={onClose} aria-label="Cerrar editor" title="Cerrar"><X size={18} /></button>
        </header>
        <div className={styles.dialogBody}>
          <div className={styles.editorGrid}>
            <div className={styles.formStack}>
              <div className={styles.field}><label htmlFor="post-title">Título interno</label><input id="post-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Lanzamiento del viernes" /></div>
              <div className={styles.field}><label htmlFor="post-caption">Texto de la publicación</label><textarea id="post-caption" rows={5} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Escribe el caption…" /></div>
              <fieldset><legend className={styles.fieldLegend}>Redes</legend><div className={styles.checkRow}><label><input type="checkbox" checked={networks.includes('instagram')} onChange={() => toggleNetwork('instagram')} /> Instagram</label><label><input type="checkbox" checked={networks.includes('facebook')} onChange={() => toggleNetwork('facebook')} /> Facebook</label></div></fieldset>
              <div className={styles.settingsGrid}>
                <div className={styles.field}><label htmlFor="post-day">Fecha</label><input id="post-day" type="date" value={day} onChange={(event) => { setDay(event.target.value); setDistributionConfirmed(false); }} /></div>
                <div className={styles.field}><label htmlFor="post-time">Hora</label><input id="post-time" type="time" value={time} onChange={(event) => { setTime(event.target.value); setDistributionConfirmed(false); }} /></div>
                <div className={styles.field}><label htmlFor="post-type">Formato</label><select id="post-type" value={mediaType} onChange={(event) => setMediaType(event.target.value as MediaType)}><option value="image">Imagen</option><option value="carousel">Carrusel</option><option value="reel">Reel</option><option value="video">Video</option></select></div>
              </div>
              <div className={styles.dropzone}>
                <FileUp size={24} aria-hidden="true" />
                <p><strong>Sube imágenes o videos</strong></p>
                <p className="muted" style={{ fontSize: 12 }}>Puedes seleccionar varios archivos.</p>
                <input aria-label="Seleccionar archivos" type="file" accept="image/*,video/*" multiple onChange={(event) => { setFiles(Array.from(event.target.files || [])); setDistributionConfirmed(false); }} style={{ marginTop: 10, maxWidth: '100%' }} />
                {!!files.length && <div className={styles.fileList}>{files.map((file) => <div className={styles.fileRow} key={`${file.name}-${file.lastModified}`}><span>{file.name}</span><span className="muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span></div>)}</div>}
              </div>
              {!post && files.length > 1 && <div className={styles.note}>
                <label><input type="checkbox" checked={separatePosts} onChange={(event) => { setSeparatePosts(event.target.checked); setDistributionConfirmed(false); }} /> Crear una publicación por archivo y auto-distribuir</label>
                {separatePosts && <div className={styles.distribution} aria-live="polite">{distribution.map((slot) => <div className={styles.fileRow} key={slot.fileName}><span>{slot.fileName}</span><strong>{slot.day} · {slot.time}</strong></div>)}<label><input type="checkbox" checked={distributionConfirmed} onChange={(event) => setDistributionConfirmed(event.target.checked)} /> Confirmo esta distribución visible</label></div>}
              </div>}
              {error && <p className={styles.errorText} role="alert">{error}</p>}
            </div>
            <aside aria-label="Preview de publicación">
              <p className={styles.fieldLegend}>Preview estilo feed</p>
              <div className={styles.feed} style={{ '--brand-color': settings.brandPrimary || 'var(--rai-gold)' } as React.CSSProperties}>
                <div className={styles.feedHeader}><span className={styles.avatar}>{settings.brandAvatarUrl ? <img src={settings.brandAvatarUrl} alt="" /> : (settings.brandName || 'R').slice(0, 1)}</span><div><strong>{settings.brandName || 'Tu marca'}</strong><div className="muted" style={{ fontSize: 11 }}>{settings.brandHandle || '@tu_marca'}</div></div></div>
                <div className={styles.feedMedia}>{previewUrl ? previewIsVideo ? <video src={previewUrl} controls /> : <img src={previewUrl} alt="Vista previa del contenido" /> : <><ImageIcon size={30} /><span>Tu contenido aparecerá aquí</span></>}</div>
                <div className={styles.feedCaption}><strong>{settings.brandHandle || '@tu_marca'}</strong> {caption || 'El texto de tu publicación aparecerá aquí.'}</div>
              </div>
            </aside>
          </div>
          <footer className={styles.dialogFooter}>
            <div className={styles.actions}>{post && <Button variant="danger" size="sm" onClick={remove} loading={deleting} title="Eliminar publicación"><Trash2 size={14} /> Eliminar</Button>}{post && <Button variant="secondary" size="sm" onClick={duplicate} loading={duplicating} title="Crear una copia editable"><Copy size={14} /> Duplicar</Button>}</div>
             <div className={styles.actions}><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="secondary" onClick={() => save(true)} disabled={saving}>Guardar borrador</Button><Button onClick={() => save(false)} loading={saving}>{saving ? 'Guardando…' : 'Programar'}</Button></div>
          </footer>
        </div>
      </div>
    </div>
  );
}
