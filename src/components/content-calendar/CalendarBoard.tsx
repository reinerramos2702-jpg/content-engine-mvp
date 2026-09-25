'use client';
/* eslint-disable @next/next/no-img-element -- URLs de media dinámicas (R2) no tienen host fijo para next/image. */

import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CalendarDays, ChevronLeft, ChevronRight, GripVertical, ImageOff, Plus } from 'lucide-react';
import {
  addDays,
  addMonths,
  calendarDays,
  groupPostsByDay,
  postDay,
  postTime,
  startOfMonth,
  startOfWeek,
  STATUS_META,
  toYMD,
  type CalendarView,
  type ContentPost,
} from './calendar-utils';
import styles from './content-calendar.module.css';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface CalendarBoardProps {
  canManage: boolean;
  anchor: Date;
  view: CalendarView;
  posts: ContentPost[];
  loading: boolean;
  onAnchorChange: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onCreate: (day: string) => void;
  onEdit: (post: ContentPost) => void;
  onMove: (post: ContentPost, day: string) => void;
}

export function CalendarBoard(props: CalendarBoardProps) {
  const { canManage, anchor, view, posts, loading, onAnchorChange, onViewChange, onCreate, onEdit, onMove } = props;
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const days = useMemo(() => calendarDays(anchor, view), [anchor, view]);
  const grouped = useMemo(() => groupPostsByDay(posts), [posts]);
  const drafts = useMemo(() => posts.filter((post) => !postDay(post)), [posts]);
  const activePost = activeId ? posts.find((post) => post.id === activeId) : undefined;
  const month = anchor.getMonth();

  const rangeLabel = view === 'week'
    ? `${days[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : anchor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  function shift(direction: number) {
    onAnchorChange(view === 'week' ? addDays(anchor, direction * 7) : addMonths(anchor, direction));
  }

  function finishDrag(event: DragEndEvent) {
    setActiveId(null);
    const post = posts.find((item) => item.id === String(event.active.id));
    const newDay = event.over ? String(event.over.id) : null;
    if (post && newDay && newDay !== postDay(post)) onMove(post, newDay);
  }

  return (
    <section aria-label="Calendario de publicaciones">
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <button className="btn btn-ghost btn-sm" onClick={() => shift(-1)} aria-label={view === 'week' ? 'Semana anterior' : 'Mes anterior'} title="Anterior">
            <ChevronLeft size={16} />
          </button>
          <strong className={styles.rangeLabel}>{rangeLabel}</strong>
          <button className="btn btn-ghost btn-sm" onClick={() => shift(1)} aria-label={view === 'week' ? 'Semana siguiente' : 'Mes siguiente'} title="Siguiente">
            <ChevronRight size={16} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => onAnchorChange(view === 'week' ? startOfWeek(new Date()) : startOfMonth(new Date()))}>Hoy</button>
        </div>
        <div className={styles.segmented} aria-label="Vista del calendario">
          <button data-active={view === 'week'} onClick={() => onViewChange('week')} aria-pressed={view === 'week'}>Semana</button>
          <button data-active={view === 'month'} onClick={() => onViewChange('month')} aria-pressed={view === 'month'}>Mes</button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={(event: DragStartEvent) => setActiveId(String(event.active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={finishDrag}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Moviendo publicación ${active.id}. Usa las flechas para elegir un día.`,
            onDragOver: ({ over }) => over ? `Sobre el día ${over.id}.` : 'Fuera del calendario.',
            onDragEnd: ({ over }) => over ? `Publicación movida al ${over.id}.` : 'Movimiento cancelado.',
            onDragCancel: () => 'Movimiento cancelado.',
          },
        }}
      >
        {!!drafts.length && (
          <div className={styles.draftTray} aria-label="Borradores sin programar">
            <strong>Borradores</strong>
            {canManage && <span className="muted">Arrástralos a un día para programarlos</span>}
            <div className={styles.draftList}>
              {drafts.map((post) => <DraggablePost key={post.id} post={post} onEdit={onEdit} canManage={canManage} />)}
            </div>
          </div>
        )}
        <div className={view === 'month' ? styles.monthWrap : undefined}>
          {view === 'month' && <div className={styles.monthHead}>{DAYS.map((day) => <div key={day}>{day}</div>)}</div>}
          <div className={view === 'month' ? styles.monthGrid : styles.weekGrid}>
            {days.map((day, index) => {
              const key = toYMD(day);
              return (
                <DayCell
                  key={key}
                  day={key}
                  dayName={DAYS[index % 7]}
                  dayNumber={day.getDate()}
                  posts={grouped[key] || []}
                  loading={loading}
                  compact={view === 'month'}
                  outside={view === 'month' && day.getMonth() !== month}
                  onCreate={onCreate}
                   onEdit={onEdit}
                   canManage={canManage}
                />
              );
            })}
          </div>
        </div>
        <DragOverlay>{activePost ? <PostCard post={activePost} overlay onEdit={() => undefined} /> : null}</DragOverlay>
      </DndContext>
    </section>
  );
}

function DayCell({ day, dayName, dayNumber, posts, loading, compact, outside, onCreate, onEdit, canManage }: {
  day: string;
  dayName: string;
  dayNumber: number;
  posts: ContentPost[];
  loading: boolean;
  compact: boolean;
  outside: boolean;
  onCreate: (day: string) => void;
  onEdit: (post: ContentPost) => void;
  canManage: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day });
  const className = [compact ? styles.monthDay : styles.day, outside ? styles.outside : '', day === toYMD(new Date()) ? styles.today : '', isOver ? styles.over : ''].filter(Boolean).join(' ');
  return (
    <div ref={setNodeRef} className={className} aria-label={`${dayName} ${dayNumber}, ${posts.length} publicaciones`}>
      <div className={styles.dayHeader}>
        <div><span className={styles.dayName}>{compact ? '' : dayName}</span> <span className={styles.dayNumber}>{dayNumber}</span></div>
        {canManage && <button className={styles.iconButton} onClick={() => onCreate(day)} aria-label={`Crear publicación el ${day}`} title="Nueva publicación"><Plus size={15} /></button>}
      </div>
      <div className={styles.posts}>
        {loading ? <><div className={styles.skeleton} /><div className={styles.skeleton} /></> : posts.length ? posts.map((post) => <DraggablePost key={post.id} post={post} onEdit={onEdit} canManage={canManage} />) : !compact && <div className={styles.empty}><CalendarDays size={17} /> Sin publicaciones</div>}
      </div>
    </div>
  );
}

function DraggablePost({ post, onEdit, canManage }: { post: ContentPost; onEdit: (post: ContentPost) => void; canManage: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: post.id, disabled: !canManage });
  return (
    <div ref={setNodeRef} style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}>
      <PostCard post={post} dragging={isDragging} onEdit={canManage ? onEdit : () => undefined} interactive={canManage} handle={canManage ? <button className={styles.dragHandle} {...listeners} {...attributes} onClick={(event) => event.stopPropagation()} aria-label={`Mover ${post.title || post.caption || 'publicación'}`} title="Mover a otro día"><GripVertical size={15} /></button> : null} />
    </div>
  );
}

function PostCard({ post, dragging, overlay, handle, onEdit, interactive = true }: { post: ContentPost; dragging?: boolean; overlay?: boolean; handle?: React.ReactNode; onEdit: (post: ContentPost) => void; interactive?: boolean }) {
  const status = STATUS_META[post.status] || STATUS_META.draft;
  const media = post.media?.[0];
  return (
    <div
      className={styles.post}
      data-dragging={dragging || undefined}
      style={{ '--status-color': status.color, boxShadow: overlay ? 'var(--shadow-lg)' : undefined } as React.CSSProperties}
    >
      <button type="button" className={styles.postContent} onClick={() => onEdit(post)} title={interactive ? 'Editar publicación' : 'Publicación de solo lectura'} disabled={!interactive}>
        <span className={styles.thumb}>{media?.thumbUrl || media?.url ? media.kind === 'video' || media.mimeType?.startsWith('video/') ? <video src={media.thumbUrl || media.url} muted preload="metadata" /> : <img src={media.thumbUrl || media.url} alt="" /> : <ImageOff size={15} />}</span>
        <span className={styles.postBody}>
          <span className={styles.postTitle}>{post.title || post.caption || 'Sin título'}</span>
          <span className={styles.postMeta}><span className={styles.status}>{status.label}</span><span className={styles.time}>{postTime(post) || 'Sin hora'}</span></span>
        </span>
      </button>
      {handle || <span aria-hidden="true"><GripVertical size={15} /></span>}
    </div>
  );
}
