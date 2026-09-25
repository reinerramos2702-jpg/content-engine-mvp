'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  Key,
  Settings,
  Wifi,
  WifiOff,
  Megaphone,
  Receipt,
  MessageSquare,
  Rocket,
  Calendar,
  CalendarRange,
  Zap,
  ShieldCheck,
  Images,
  Bot,
  Users,
  Target,
  UserCheck,
  BedDouble,
  CreditCard,
  Globe,
  FolderOpen,
  Star,
  BarChart3,
  Store,
  Menu,
  X,
} from 'lucide-react';
import { hasModuleAccess, ROLE_LABELS, type Role } from '@/lib/roles-shared';
import { apiFetch } from '@/lib/client-api';

interface SidebarProps {
  n8nConnected?: boolean;
}

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/launchpad', label: 'Guía de Inicio', icon: Rocket },
  { href: '/campaign/new', label: 'Nueva Campaña', icon: PlusCircle },
  { href: '/generador-imagenes', label: 'Generador Imágenes', icon: Images },
  { href: '/agentes-ia', label: 'Agentes de IA', icon: Bot },
  { href: '/conversaciones', label: 'Conversaciones', icon: MessageSquare },
  { href: '/calendarios', label: 'Calendarios', icon: Calendar },
  { href: '/calendario-contenido', label: 'Calendario de contenido', icon: CalendarRange },
  { href: '/contactos', label: 'Contactos', icon: Users },
  { href: '/clientes-potenciales', label: 'Clientes Potenciales', icon: Target },
  { href: '/pasajeros', label: 'Pasajeros', icon: UserCheck },
  { href: '/reservas', label: 'Reservas', icon: BedDouble },
  { href: '/pagos', label: 'Pagos', icon: CreditCard },
  { href: '/automatizacion', label: 'Automatización', icon: Zap },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/sitios', label: 'Sitios', icon: Globe },
  { href: '/contenido-multimedia', label: 'Contenido multimedia', icon: FolderOpen },
  { href: '/reputacion', label: 'Reputación', icon: Star },
  { href: '/informes', label: 'Informes', icon: BarChart3 },
  { href: '/marketplace', label: 'Aplicaciones del mercado', icon: Store },
  { href: '/facturacion', label: 'Facturación', icon: Receipt },
  { href: '/keys', label: 'Claves de IA', icon: Key },
  { href: '/settings', label: 'Configuración', icon: Settings },
];

/**
 * Sidebar lateral premium con logo RAI, navegación y estado de n8n.
 */
export function Sidebar({ n8nConnected }: SidebarProps) {
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.role) setRole(data.role as Role);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const visibleItems = NAV_ITEMS.filter((item) => !role || hasModuleAccess(role, item.href));

  return (
    <>
      {/* Mobile header bar */}
      <div className="mobile-header">
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menú"
          style={{ border: 'none', boxShadow: 'none' }}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image
            src="/crystal-logo.webp"
            alt="RAI"
            width={28}
            height={28}
            sizes="28px"
            style={{ width: 28, height: 28, objectFit: 'contain', filter: 'drop-shadow(0 0 6px rgba(123,94,167,0.4))' }}
          />
          <span className="gradient-text" style={{ fontSize: 16, fontWeight: 800 }}>RAI</span>
        </div>
        <div style={{ width: 22 }} />
      </div>

      {/* Mobile overlay */}
      <div
        className={`mobile-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside className={`app-sidebar ${mobileOpen ? 'open' : ''}`}>
      {/* Logo */}
      <div
        style={{
          padding: '24px 20px',
          borderBottom: '1px solid var(--rai-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image
            src="/crystal-logo.webp"
            alt="RAI Agency"
            width={40}
            height={40}
            sizes="40px"
            style={{
              width: 40,
              height: 40,
              borderRadius: 0,
              objectFit: 'contain',
              flexShrink: 0,
              filter: 'drop-shadow(0 0 8px rgba(123, 94, 167, 0.4))',
            }}
          />
          <div>
            <div
              className="gradient-text"
              style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              RAI
            </div>
            <div style={{ fontSize: 10, color: 'var(--rai-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Agency CRM
            </div>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav style={{ flex: 1, padding: '12px 8px' }}>
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                marginBottom: 2,
                color: isActive ? 'var(--rai-gold)' : 'var(--rai-muted)',
                background: isActive ? 'rgba(201,168,76,0.1)' : 'transparent',
                border: isActive ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
                transition: 'var(--transition)',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                textDecoration: 'none',
              }}
              className={isActive ? 'nav-active' : 'nav-item'}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Estado n8n */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--rai-border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--rai-muted)',
          }}
        >
          {n8nConnected ? (
            <>
              <Wifi size={12} color="var(--rai-success)" />
              <span style={{ color: 'var(--rai-success)' }}>n8n conectado</span>
            </>
          ) : (
            <>
              <WifiOff size={12} />
              <span>n8n no configurado</span>
            </>
          )}
        </div>
        {role && (
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--rai-muted)',
            }}
          >
            <ShieldCheck size={12} color="var(--rai-gold)" />
            <span>Rol: {ROLE_LABELS[role]}</span>
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--rai-muted)', opacity: 0.6 }}>
          RAI Agency © 2025
        </div>
      </div>
    </aside>
    </>
  );
}
