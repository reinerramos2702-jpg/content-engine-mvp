'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { apiFetch, UnauthorizedError } from '@/lib/client-api';
import type { CalendarSettings } from './calendar-utils';
import styles from './content-calendar.module.css';

export function CalendarSettingsDialog({ open, settings, onClose, onSaved }: {
  open: boolean;
  settings: CalendarSettings;
  onClose: () => void;
  onSaved: (settings: CalendarSettings) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    setForm(settings);
    setError('');
    requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
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
  }, [open, settings, onClose]);

  if (!open) return null;

  async function save() {
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch('/api/content-calendar/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          timezone: form.timezone,
          defaultPostTime: form.defaultPostTime,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'No se pudo guardar la configuración.');
      const updated = { ...form, ...(body.settings || body) };
      onSaved(updated);
      onClose();
    } catch (cause) {
      if (!(cause instanceof UnauthorizedError)) setError(cause instanceof Error ? cause.message : 'No se pudo guardar.');
    } finally { setSaving(false); }
  }

  return (
    <div className={styles.dialogBackdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={dialogRef} className={styles.dialog} style={{ maxWidth: 620 }} role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className={styles.dialogHeader}><h2 id="settings-title">Ajustes del calendario</h2><button ref={closeRef} className={styles.iconButton} onClick={onClose} aria-label="Cerrar ajustes" title="Cerrar"><X size={18} /></button></header>
        <div className={styles.dialogBody}>
          <div className={styles.settingsGrid}>
            <div className={styles.field}><label htmlFor="calendar-timezone">Zona horaria</label><input id="calendar-timezone" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} placeholder="America/Caracas" /></div>
            <div className={styles.field}><label htmlFor="calendar-time">Hora predeterminada</label><input id="calendar-time" type="time" value={form.defaultPostTime} onChange={(event) => setForm({ ...form, defaultPostTime: event.target.value })} /></div>
          </div>
          <p className={styles.note} style={{ marginTop: 14 }}>Estos valores vienen de la base de datos y controlan la auto-distribución. El backend actual distribuye una pieza por día libre. No se guarda progreso en el navegador.</p>
          {error && <p className={styles.errorText} role="alert" style={{ marginTop: 10 }}>{error}</p>}
          <footer className={styles.dialogFooter}><span /><div className={styles.actions}><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={saving}>Guardar ajustes</Button></div></footer>
        </div>
      </div>
    </div>
  );
}
