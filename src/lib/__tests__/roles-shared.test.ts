import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  isAdmin,
  isAdminOrManager,
  canWrite,
  hasModuleAccess,
  PERMISSIONS,
  PERMISSIONS_BY_ROLE,
  MODULE_ACCESS,
  ROLES,
  INVITABLE_ROLES,
  ESCALATION_ROLES,
  type Role,
  type Permission,
} from '../roles-shared';

describe('INVITABLE_ROLES / ESCALATION_ROLES', () => {
  for (const role of ['admin', 'super_admin', 'agency_owner'] as Role[]) {
    it(`Equipo no puede asignar '${role}'`, () => {
      expect(INVITABLE_ROLES).not.toContain(role);
    });
  }

  it('los roles operativos sí son invitables', () => {
    expect(INVITABLE_ROLES).toEqual(['gerente', 'agente', 'staff', 'viewer']);
  });

  it("ESCALATION_ROLES cubre super_admin y agency_owner, pero no 'admin'", () => {
    expect(ESCALATION_ROLES).toEqual(['super_admin', 'agency_owner']);
    expect(ESCALATION_ROLES).not.toContain('admin');
  });

  it('todo rol de escalada está también fuera de los invitables (las 2 capas coinciden)', () => {
    for (const role of ESCALATION_ROLES) {
      expect(INVITABLE_ROLES).not.toContain(role);
    }
  });
});

describe('hasPermission', () => {
  for (const role of ROLES) {
    const granted = PERMISSIONS_BY_ROLE[role];
    const allPermissions: Permission[] = [
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
    const notGranted = allPermissions.filter((p) => !granted.includes(p));

    it(`role '${role}' returns true for a permission it has by default`, () => {
      expect(granted.length).toBeGreaterThan(0);
      expect(hasPermission(role, granted[0])).toBe(true);
    });

    it(`role '${role}' returns false for a permission it does not have by default`, () => {
      if (notGranted.length === 0) {
        // super_admin has every permission by default, so there is no
        // "not granted" case to test without an override. Use an override
        // that revokes one to still exercise the false path for this role.
        expect(
          hasPermission(role, allPermissions[0], { [allPermissions[0]]: false })
        ).toBe(false);
        return;
      }
      expect(hasPermission(role, notGranted[0])).toBe(false);
    });
  }

  it('overrides can grant a permission not present in the role default', () => {
    // 'viewer' does not have 'canCreateLead' by default
    expect(PERMISSIONS_BY_ROLE.viewer.includes('canCreateLead')).toBe(false);
    expect(
      hasPermission('viewer', 'canCreateLead', { canCreateLead: true })
    ).toBe(true);
  });

  it('overrides can revoke a permission present in the role default', () => {
    // 'admin' has 'canManageTeam' by default
    expect(PERMISSIONS_BY_ROLE.admin.includes('canManageTeam')).toBe(true);
    expect(
      hasPermission('admin', 'canManageTeam', { canManageTeam: false })
    ).toBe(false);
  });
});

describe('isAdmin', () => {
  it('returns true for super_admin', () => {
    expect(isAdmin('super_admin')).toBe(true);
  });

  it('returns true for agency_owner', () => {
    expect(isAdmin('agency_owner')).toBe(true);
  });

  it('returns true for admin', () => {
    expect(isAdmin('admin')).toBe(true);
  });

  it('returns false for gerente', () => {
    expect(isAdmin('gerente')).toBe(false);
  });

  it('returns false for viewer', () => {
    expect(isAdmin('viewer')).toBe(false);
  });
});

describe('isAdminOrManager', () => {
  it('returns true for super_admin', () => {
    expect(isAdminOrManager('super_admin')).toBe(true);
  });

  it('returns true for agency_owner', () => {
    expect(isAdminOrManager('agency_owner')).toBe(true);
  });

  it('returns true for admin', () => {
    expect(isAdminOrManager('admin')).toBe(true);
  });

  it('returns true for gerente', () => {
    expect(isAdminOrManager('gerente')).toBe(true);
  });

  it('returns false for viewer', () => {
    expect(isAdminOrManager('viewer')).toBe(false);
  });
});

describe('canWrite', () => {
  const writableRoles = ROLES.filter((r) => r !== 'viewer');

  for (const role of writableRoles) {
    it(`returns true for '${role}'`, () => {
      expect(canWrite(role)).toBe(true);
    });
  }

  it("returns false for 'viewer'", () => {
    expect(canWrite('viewer')).toBe(false);
  });
});

describe('hasModuleAccess', () => {
  it('super_admin always has access, even to restricted routes', () => {
    expect(hasModuleAccess('super_admin', '/keys')).toBe(true);
    expect(hasModuleAccess('super_admin', '/settings')).toBe(true);
    expect(hasModuleAccess('super_admin', '/facturacion')).toBe(true);
  });

  it("'/keys' es solo de nivel admin: 'agente' y 'gerente' quedan fuera", () => {
    expect(MODULE_ACCESS['/keys']).toEqual(['super_admin', 'agency_owner', 'admin']);
    expect(hasModuleAccess('agente', '/keys')).toBe(false);
    expect(hasModuleAccess('gerente', '/keys')).toBe(false);
  });

  it("'/keys' es solo de nivel admin: 'admin' pasa", () => {
    expect(hasModuleAccess('admin', '/keys')).toBe(true);
  });

  it('fail-closed: una ruta no listada en MODULE_ACCESS se oculta a todos salvo super_admin', () => {
    const unlistedPath = '/some-unlisted-route-xyz';
    expect(MODULE_ACCESS[unlistedPath]).toBeUndefined();
    for (const role of ROLES) {
      expect(hasModuleAccess(role, unlistedPath)).toBe(role === 'super_admin');
    }
  });
});

describe('MODULE_ACCESS — cobertura de los 7 roles', () => {
  it('super_admin y agency_owner están en todas las rutas', () => {
    for (const [path, allowed] of Object.entries(MODULE_ACCESS)) {
      expect(allowed, `super_admin falta en ${path}`).toContain('super_admin');
      expect(allowed, `agency_owner falta en ${path}`).toContain('agency_owner');
    }
  });

  it('cada ruta declara solo roles válidos y sin duplicados', () => {
    for (const [path, allowed] of Object.entries(MODULE_ACCESS)) {
      expect(new Set(allowed).size, `${path} tiene roles duplicados`).toBe(allowed.length);
      for (const role of allowed) {
        expect(ROLES, `${path} declara un rol inexistente: ${role}`).toContain(role);
      }
    }
  });

  it('staff no ve Pagos, Facturación, Claves ni Informes', () => {
    for (const path of ['/pagos', '/facturacion', '/keys', '/informes']) {
      expect(hasModuleAccess('staff', path), `staff no debería ver ${path}`).toBe(false);
    }
  });

  it('staff sí ve los módulos operativos que le da la matriz', () => {
    for (const path of ['/contactos', '/calendarios', '/calendario-contenido', '/conversaciones', '/settings']) {
      expect(hasModuleAccess('staff', path), `staff debería ver ${path}`).toBe(true);
    }
  });

  it('agency_owner ve todo lo que ve admin (sin bypass cross-tenant, que vive en otra capa)', () => {
    for (const [path, allowed] of Object.entries(MODULE_ACCESS)) {
      if (allowed.includes('admin')) {
        expect(hasModuleAccess('agency_owner', path), `agency_owner falta en ${path}`).toBe(true);
      }
    }
  });
});

describe('PERMISSIONS_BY_ROLE — los 3 roles nuevos', () => {
  it('agency_owner tiene todos los permisos', () => {
    expect([...PERMISSIONS_BY_ROLE.agency_owner].sort()).toEqual([...PERMISSIONS].sort());
  });

  it('todos los roles pueden ver contenido, pero viewer no puede gestionarlo', () => {
    for (const role of ROLES) expect(hasPermission(role, 'canViewContent')).toBe(true);
    expect(hasPermission('viewer', 'canManageContent')).toBe(false);
  });

  it('staff no administra facturación, equipo ni asesores', () => {
    expect(PERMISSIONS_BY_ROLE.staff).not.toContain('canManageBilling');
    expect(PERMISSIONS_BY_ROLE.staff).not.toContain('canManageTeam');
    expect(PERMISSIONS_BY_ROLE.staff).not.toContain('canManageAdvisors');
  });

  it('los 7 roles tienen entrada explícita', () => {
    for (const role of ROLES) {
      expect(PERMISSIONS_BY_ROLE[role], `falta entrada para ${role}`).toBeDefined();
    }
  });
});
