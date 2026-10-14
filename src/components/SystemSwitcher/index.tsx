import { Select } from 'antd';
import { useNavigate } from 'react-router-dom';

type SystemKey = 'buyer-show' | 'decision';

const OPTIONS = [
  { value: 'buyer-show', label: '买家秀管理' },
  { value: 'decision', label: '经营决策系统' },
];

interface SystemSwitcherProps {
  current: SystemKey;
}

export function SystemSwitcher({ current }: SystemSwitcherProps) {
  const navigate = useNavigate();

  return (
    <Select
      size="small"
      value={current}
      style={{ width: 148, minWidth: 148, flexShrink: 0 }}
      options={OPTIONS}
      onChange={(value) => {
        navigate(value === 'decision' ? '/decision' : '/buyer-show/task-list');
      }}
    />
  );
}
