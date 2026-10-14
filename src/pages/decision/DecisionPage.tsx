import { Navigate } from 'react-router-dom';
import { useDecisionRole } from '@/contexts/DecisionRoleContext';
import ConfigCenter from './ConfigCenter';
import { getDecisionPage, ROLE_HOME, type DecisionPageDef } from './registry';
import { StubPage } from './StubPage';
import TodoCenter from './TodoCenter';

export function DecisionHomeRedirect() {
  const { role } = useDecisionRole();
  return <Navigate to={ROLE_HOME[role]} replace />;
}

export function DecisionPage({ pageId }: { pageId: string }) {
  const page = getDecisionPage(pageId);
  if (!page) return <Navigate to="/decision" replace />;
  return <DecisionPageView page={page} />;
}

function DecisionPageView({ page }: { page: DecisionPageDef }) {
  if (page.kind === 'todo') return <TodoCenter />;
  if (page.kind === 'config') return <ConfigCenter />;
  return <StubPage page={page} />;
}
