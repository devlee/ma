import { Card, Typography, message } from 'antd';
import { AuditTrail } from '@/components/decision/AuditTrail';
import { DecisionPageHeader } from '@/components/decision/PageHeader';
import { DiagnosisRow } from '@/components/decision/DiagnosisRow';
import { SuggestionCard } from '@/components/decision/SuggestionCard';
import { TargetVsActualPanel } from '@/components/decision/TargetVsActualPanel';
import { mockAuditTrail, mockDiagnoses, mockSuggestions, mockTargetVsActual } from '@/mocks/decision';
import type { PageSection, DecisionPageDef } from './registry';
import styles from './stub.module.css';

const PORTRAIT_PANELS = [
  '经营结果',
  '等级与集中度',
  '结构三维',
  '商品数量与处置态',
  '新品健康',
  '素材完备度与新鲜度',
  '营销效率',
  '服务与交付护栏',
];

function Placeholder({ reserved }: { reserved?: boolean }) {
  return (
    <Typography.Text type="secondary" className={styles.placeholder}>
      {reserved ? '留位 · 待实现' : '待实现'}
    </Typography.Text>
  );
}

function SectionBody({ page, section }: { page: DecisionPageDef; section: PageSection }) {
  if (section.demo === 'target-vs-actual') {
    const data = mockTargetVsActual.find((item) => item.title === section.title);
    if (!data) return <Placeholder />;
    return (
      <TargetVsActualPanel
        title={data.title}
        targetValue={data.targetValue}
        targetVersion={data.targetVersion}
        actualValue={data.actualValue}
        actualAsOf={data.actualAsOf}
        actual口径={data.actual口径}
        gap={data.gap}
        achievementRate={data.achievementRate}
        status={data.status}
        momDirection={data.momDirection}
        source={data.source}
      />
    );
  }

  if (section.demo === 'diagnosis') {
    return (
      <div>
        <DiagnosisRow allNormalCount={8} />
        <Typography.Paragraph type="secondary" style={{ margin: '12px 0 0' }}>
          分项结论（骨架示例，与「全正常」态并存仅作组件演示）：
        </Typography.Paragraph>
        {mockDiagnoses.map((item) => (
          <DiagnosisRow key={item.id} item={item} />
        ))}
      </div>
    );
  }

  if (section.demo === 'audit') {
    return <AuditTrail items={mockAuditTrail} />;
  }

  if (section.demo === 'suggestion') {
    const module = page.id === 'disposition' ? '处置' : '换图';
    const list = mockSuggestions.filter((item) => item.module === module);
    return (
      <div>
        {list.map((item) => (
          <SuggestionCard
            key={item.id}
            suggestion={item}
            onApprove={() => message.success(`已批准 ${item.id}（骨架）`)}
            onRevise={() => message.info(`改选 ${item.id}（骨架）`)}
            onReject={() => message.warning(`驳回 ${item.id}（骨架，理由后置）`)}
          />
        ))}
      </div>
    );
  }

  if (section.demo === 'portrait-eight') {
    return (
      <div className={styles.portrait}>
        {PORTRAIT_PANELS.map((name) => (
          <div key={name} className={styles.portraitItem}>
            {name}
            <div>待实现</div>
          </div>
        ))}
      </div>
    );
  }

  return <Placeholder reserved={section.reserved} />;
}

interface StubPageProps {
  page: DecisionPageDef;
}

export function StubPage({ page }: StubPageProps) {
  const useBarePanels = page.sections.some((section) => section.demo === 'target-vs-actual');

  return (
    <div className={styles.page}>
      <DecisionPageHeader title={page.title} board={page.board} sourceDoc={page.sourceDoc} />
      <div className={useBarePanels ? styles.grid : styles.stack}>
        {page.sections.map((section) =>
          section.demo === 'target-vs-actual' ? (
            <SectionBody key={section.title} page={page} section={section} />
          ) : (
            <Card
              key={section.title}
              size="small"
              title={section.reserved ? `${section.title}（留位）` : section.title}
            >
              <SectionBody page={page} section={section} />
            </Card>
          ),
        )}
      </div>
    </div>
  );
}
