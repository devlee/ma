import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type AppRole = '运营' | '运营组长' | '设计' | '设计组长';

export const APP_ROLES: AppRole[] = ['运营', '运营组长', '设计', '设计组长'];

export const ROLE_ACTOR: Record<AppRole, string> = {
  运营: '张运营',
  运营组长: '李运营组长',
  设计: '付新玲',
  设计组长: '王设计组长',
};

interface RoleContextValue {
  role: AppRole;
  setRole: (role: AppRole) => void;
  actor: string;
  isOps: boolean;
  isDesigner: boolean;
  isLead: boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AppRole>('运营');
  const value = useMemo<RoleContextValue>(() => {
    const isOps = role === '运营' || role === '运营组长';
    const isDesigner = role === '设计' || role === '设计组长';
    const isLead = role === '运营组长' || role === '设计组长';
    return { role, setRole, actor: ROLE_ACTOR[role], isOps, isDesigner, isLead };
  }, [role]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error('useRole 必须在 RoleProvider 内使用');
  }
  return ctx;
}
