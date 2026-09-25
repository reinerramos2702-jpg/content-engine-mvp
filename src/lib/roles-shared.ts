/**
 * Definiciones de roles y permisos compartidas entre cliente y servidor.
 * Este archivo NO debe importar nada de Prisma/servidor — es seguro
 * usarlo desde componentes 'use client' (Sidebar, páginas, etc.)
 *
 * RBAC formal (Bloque 1, v3.0-master-prompt, sección 3) — extiende los 4 roles
 * originales a los 7 mínimos del master prompt SIN renombrarlos (evita forzar
 * una migración masiva de las 32 rutas que ya usan los strings originales,
 * regla no negociable #5 anti-refactor-masivo). Equivalencia:
 *
 * - admin        ≈ TENANT_ADMIN → owner del workspace (implícito) o miembro 'admin'. Control total del tenant.
 * - gerente      ≈ MANAGER      → gestiona operación diaria, campañas, automatizaciones y configuración
 *                                  general, pero NO administra el equipo ni las claves de IA (BYOK).
 * - agente       ≈ ADVISOR      → trabaja en módulos operativos (Conversaciones, Calendarios, Campañas,
 *                                  Automatización) sin acceso a Configuración, Claves, Facturación ni Equipo.
 * - viewer       ≈ CLIENT       → acceso de solo lectura a los módulos operativos. No puede crear, editar
 *                                  ni eliminar nada. Reservado también para el futuro portal de cliente.
 * - super_admin  = SUPER_ADMIN  → RAI Agency, cross-tenant. Ve y administra todos los workspaces.
 * - agency_owner = AGENCY_OWNER → dueño de una agencia/tenant que revende el CRM a sus propios clientes
 *                                  (rol tipo Belloanam, genérico — nunca nombrado a un cliente específico).
 * - staff        = STAFF        → categorías de RRHH-lite del Bloque 4 (vendedor/CM/camarógrafo/editor),
 *                                  sin permisos administrativos por default.
 */

export type Role =
  | 'super_admin'
  | 'agency_owner'
  | 'admin'
  | 'gerente'
  | 'agente'
  | 'staff'
  | 'viewer';

export const ROLES: Role[] = [
  'super_admin',
  'agency_owner',
  'admin',
  'gerente',
  'agente',
  'staff',
  'viewer',
];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin (RAI Agency)',
  agency_owner: 'Dueño de agencia',
  admin: 'Administrador',
  gerente: 'Gerente',
  agente: 'Agente',
  staff: 'Staff',
  viewer: 'Solo lectura',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: 'RAI Agency — acceso cross-tenant a todos los workspaces. Reservado para operación interna.',
  agency_owner: 'Dueño de una agencia/tenant que revende el CRM: administra sus propios clientes/asesores desde un panel privado.',
  admin: 'Control total del tenant: equipo, configuración, claves de IA, facturación y todos los módulos.',
  gerente: 'Gestiona campañas, conversaciones, calendarios, marketing y automatizaciones. Sin acceso a Equipo ni Claves de IA.',
  agente: 'Trabaja en el día a día: conversaciones, calendarios y campañas. Sin acceso a configuración ni datos sensibles.',
  staff: 'Categoría de RRHH-lite (vendedor/CM/camarógrafo/editor) — acceso operativo acotado a su carga de trabajo.',
  viewer: 'Solo lectura en los módulos operativos. No puede crear, editar ni eliminar nada.',
};

/**
 * Roles que el módulo Equipo puede asignar a un miembro. Los tres excluidos se
 * obtienen por otra vía, nunca por invitación:
 *  - 'admin'        → implícito por ser owner del workspace.
 *  - 'super_admin'  → solo por la env var SUPER_ADMIN_EMAILS.
 *  - 'agency_owner' → tiene todos los permisos del tenant; que un admin pueda
 *                     otorgarlo es la misma escalada que se cerró para 'admin'.
 * Fuente única: la consumen el desplegable de Equipo y las dos rutas de /api/team.
 */
export const INVITABLE_ROLES: Role[] = ROLES.filter(
  (r) => r !== 'admin' && r !== 'super_admin' && r !== 'agency_owner'
);

/**
 * Roles de escalada: segunda capa del bloqueo. Si una fila de WorkspaceMember
 * ya trae uno de estos guardado (creada antes del fix, o por cualquier vía que
 * saltee la ruta), getRole() lo ignora y trata al miembro como 'viewer'.
 * 'admin' NO está acá a propósito: una membresía 'admin' guardada es legítima
 * y se sigue respetando.
 */
export const ESCALATION_ROLES: Role[] = ['super_admin', 'agency_owner'];

/**
 * Permisos explícitos (sección 3 del master prompt) — la autorización real en
 * backend SIEMPRE se valida por permiso, nunca por nombre de rol "a pelo".
 * Cada rol tiene un set de permisos por default (ver PERMISSIONS_BY_ROLE).
 */
export type Permission =
  | 'canCreateLead'
  | 'canViewReports'
  | 'canManageTeam'
  | 'canManageBilling'
  | 'canConnectMeta'
  | 'canViewContent'
  | 'canManageContent'
  | 'canApproveContent'
  | 'canManageAdvisors';

export const PERMISSIONS: Permission[] = [
  'canCreateLead',
  'canViewReports',
  'canManageTeam',
  'canManageBilling',
  'canConnectMeta',
  'canViewContent',
  'canManageContent',
  'canApproveContent',
  'canManageAdvisors',
];

/** Set de permisos por default de cada rol. Un WorkspaceMember puede tener overrides puntuales (ver hasPermission). */
export const PERMISSIONS_BY_ROLE: Record<Role, Permission[]> = {
  super_admin: [...PERMISSIONS],
  agency_owner: [
    'canCreateLead',
    'canViewReports',
    'canManageTeam',
    'canManageBilling',
    'canConnectMeta',
    'canViewContent',
    'canManageContent',
    'canApproveContent',
    'canManageAdvisors',
  ],
  admin: [
    'canCreateLead',
    'canViewReports',
    'canManageTeam',
    'canManageBilling',
    'canConnectMeta',
    'canViewContent',
    'canManageContent',
    'canApproveContent',
    'canManageAdvisors',
  ],
  gerente: ['canCreateLead', 'canViewReports', 'canConnectMeta', 'canViewContent', 'canManageContent', 'canApproveContent', 'canManageAdvisors'],
  agente: ['canCreateLead', 'canViewContent', 'canManageContent'],
  staff: ['canViewContent', 'canManageContent'],
  viewer: ['canViewReports', 'canViewContent'],
};

/**
 * ¿El rol tiene el permiso indicado? Valida por permiso, no por rol hardcodeado.
 * `overrides` (opcional) permite ajustes puntuales por WorkspaceMember sin tocar
 * el default del rol (ej. un 'agente' con canApproveContent concedido a mano).
 */
export function hasPermission(role: Role, permission: Permission, overrides?: Partial<Record<Permission, boolean>>): boolean {
  if (overrides && permission in overrides) return !!overrides[permission];
  return PERMISSIONS_BY_ROLE[role]?.includes(permission) ?? false;
}

/**
 * Mapa de acceso a módulos del sidebar por rol (visibilidad de UI).
 *
 * OJO: esto NO es autorización. Solo lo consume el Sidebar para mostrar/ocultar
 * ítems; la autorización real vive en requireRole/requirePermission dentro de
 * cada ruta de API. Ocultar un ítem nunca sustituye al guard del backend.
 *
 * Matriz fuente: docs/AUDITORIA-SEGURIDAD-15SEP.md §5 (7 roles x 11 módulos).
 * Un rol aparece si tiene al menos lectura en ese módulo.
 *
 * Criterio al completar los 3 roles nuevos (sub-fase 0.3):
 *  - super_admin / agency_owner: acceso a todo el tenant (agency_owner sin
 *    bypass cross-tenant — ese bypass vive en resolveActiveWorkspace, no acá).
 *  - staff: solo donde la matriz le da acceso. Sin Pagos, Facturación, Equipo,
 *    Informes ni Agentes de IA; en Configuración entra como lectura (la
 *    escritura la corta el guard de la ruta, no el sidebar).
 *  - Las entradas de los 4 roles originales se dejaron intactas para no meter
 *    regresiones, salvo '/keys' (ver abajo).
 */
export const MODULE_ACCESS: Record<string, Role[]> = {
  '/': ['super_admin', 'agency_owner', 'admin', 'gerente', 'agente', 'staff', 'viewer'],
  '/launchpad': ['super_admin', 'agency_owner', 'admin', 'gerente', 'agente'],
  '/campaign/new': ['super_admin', 'agency_owner', 'admin', 'gerente', 'agente'],
  '/generador-imagenes': ['super_admin', 'agency_owner', 'admin', 'gerente', 'agente', 'staff'],
  '/agentes-ia': ['super_admin', 'agency_owner', 'admin', 'gerente', 'agente', 'viewer'],
  '/conversaciones': ['super_admin', 'agency_owner', 'admin', 'gerente', 'agente', 'staff', 'viewer'],
  '/calendarios': ['super_admin', 'agency_owner', 'admin', 'gerente', 'agente', 'staff', 'viewer'],
  '/calendario-contenido': ['super_admin', 'agency_owner', 'admin', 'gerente', 'agente', 'staff', 'viewer'],
  '/contactos': ['super_admin', 'agency_owner', 'admin', 'gerente', 'agente', 'staff', 'viewer'],
  '/clientes-potenciales': ['super_admin', 'agency_owner', 'admin', 'gerente', 'agente', 'staff', 'viewer'],
  '/pasajeros': ['super_admin', 'agency_owner', 'admin', 'gerente', 'agente', 'staff', 'viewer'],
  '/reservas': ['super_admin', 'agency_owner', 'admin', 'gerente', 'agente', 'staff', 'viewer'],
  // staff sin acceso a Pagos (decisión confirmada, auditoría §5).
  '/pagos': ['super_admin', 'agency_owner', 'admin', 'gerente', 'viewer'],
  '/automatizacion': ['super_admin', 'agency_owner', 'admin', 'gerente', 'agente', 'staff', 'viewer'],
  '/marketing': ['super_admin', 'agency_owner', 'admin', 'gerente', 'agente', 'staff', 'viewer'],
  '/sitios': ['super_admin', 'agency_owner', 'admin', 'gerente', 'agente'],
  '/contenido-multimedia': ['super_admin', 'agency_owner', 'admin', 'gerente', 'agente', 'staff'],
  '/reputacion': ['super_admin', 'agency_owner', 'admin', 'gerente', 'agente', 'viewer'],
  '/informes': ['super_admin', 'agency_owner', 'admin', 'gerente', 'viewer'],
  '/marketplace': ['super_admin', 'agency_owner', 'admin', 'gerente'],
  '/facturacion': ['super_admin', 'agency_owner', 'admin'],
  // Claves de IA: solo nivel admin. Se le quitó a 'gerente' porque contradecía
  // a ROLE_DESCRIPTIONS ("gerente ... NO administra las claves de IA (BYOK)").
  '/keys': ['super_admin', 'agency_owner', 'admin'],
  // staff entra como lectura (Configuración R en la matriz); la edición la
  // bloquea el guard de la ruta de API, nunca la visibilidad del sidebar.
  '/settings': ['super_admin', 'agency_owner', 'admin', 'gerente', 'staff'],
};

/** Roles que pueden crear/editar/eliminar (todo excepto 'viewer'). */
export function canWrite(role: Role): boolean {
  return role !== 'viewer';
}

// Backend role sets derived from the same module matrix used by navigation.
export const CAMPAIGN_ROLES = MODULE_ACCESS['/campaign/new'];
export const CONTENT_GENERATOR_READ_ROLES = MODULE_ACCESS['/generador-imagenes'];
export const CONTENT_GENERATOR_WRITE_ROLES = CONTENT_GENERATOR_READ_ROLES.filter(
  (role) => role !== 'staff' && canWrite(role)
);
export const MARKETING_WRITE_ROLES = MODULE_ACCESS['/marketing'].filter(canWrite);
export const AI_AGENT_WRITE_ROLES = MODULE_ACCESS['/agentes-ia'].filter(canWrite);

export function isAdmin(role: Role): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'agency_owner';
}

export function isAdminOrManager(role: Role): boolean {
  return isAdmin(role) || role === 'gerente';
}

/**
 * Fail-closed: una ruta que no esté en MODULE_ACCESS no se muestra a nadie
 * (salvo super_admin). Antes devolvía true, así que cualquier módulo nuevo
 * quedaba visible para todos los roles por olvido. Hoy las 22 entradas de
 * NAV_ITEMS están mapeadas, así que el cambio es no-op: es una red de
 * seguridad para el próximo módulo que se agregue.
 */
export function hasModuleAccess(role: Role, path: string): boolean {
  if (role === 'super_admin') return true; // cross-tenant, siempre pasa
  const allowed = MODULE_ACCESS[path];
  if (!allowed) return false;
  return allowed.includes(role);
}
