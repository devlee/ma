import { StatusTag } from '@/components/StatusTag';
import type { ConsistencyStatus } from '@/types/buyer-show';

interface ConsistencyTagProps {
  status?: ConsistencyStatus;
  confirmedBy?: string;
  confirmedAt?: string;
}

export function ConsistencyTag({ status, confirmedBy, confirmedAt }: ConsistencyTagProps) {
  if (!status) return <span>—</span>;
  return (
    <span>
      <StatusTag value={status} />
      {status === '已确认' && (confirmedBy || confirmedAt) ? (
        <span style={{ color: 'rgba(0, 0, 0, 0.45)', fontSize: 12 }}>
          {confirmedBy}
          {confirmedBy && confirmedAt ? ' · ' : ''}
          {confirmedAt}
        </span>
      ) : null}
    </span>
  );
}
