import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { DISABLED_DECISION_ROLES, DECISION_ROLES, type DecisionRole } from '@/types/decision';

export const DECISION_ROLE_ACTOR: Record<DecisionRole, string> = {
  管理层: '王管理层',
  运营负责人: '李运营负责人',
  站点Owner: '赵站点Owner',
  运营: '张运营',
  风格库负责人: '陈风格库',
  板块填报Owner: '周填报Owner',
  管理员: '系统管理员',
  品类负责人: '（角色暂不设）',
};

interface DecisionRoleContextValue {
  role: DecisionRole;
  setRole: (role: DecisionRole) => void;
  actor: string;
  roles: DecisionRole[];
}

const DecisionRoleContext = createContext<DecisionRoleContextValue | null>(null);

export function DecisionRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<DecisionRole>('运营');
  const value = useMemo<DecisionRoleContextValue>(() => {
    const setRole = (next: DecisionRole) => {
      if (DISABLED_DECISION_ROLES.has(next)) return;
      setRoleState(next);
    };
    return {
      role,
      setRole,
      actor: DECISION_ROLE_ACTOR[role],
      roles: DECISION_ROLES,
    };
  }, [role]);

  return <DecisionRoleContext.Provider value={value}>{children}</DecisionRoleContext.Provider>;
}

export function useDecisionRole() {
  const ctx = useContext(DecisionRoleContext);
  if (!ctx) {
    throw new Error('useDecisionRole 必须在 DecisionRoleProvider 内使用');
  }
  return ctx;
}
