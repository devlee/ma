import { Form, Input, Modal } from 'antd';
import { useEffect } from 'react';

interface ReasonModalProps {
  open: boolean;
  title: string;
  hint?: string;
  label?: string;
  okText?: string;
  danger?: boolean;
  onCancel: () => void;
  onOk: (reason: string) => void;
}

export function ReasonModal({
  open,
  title,
  hint,
  label = '原因',
  okText = '确认',
  danger,
  onCancel,
  onOk,
}: ReasonModalProps) {
  const [form] = Form.useForm<{ reason: string }>();

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  return (
    <Modal
      open={open}
      title={title}
      okText={okText}
      okButtonProps={{ danger }}
      onCancel={onCancel}
      onOk={async () => {
        const values = await form.validateFields();
        onOk(values.reason.trim());
      }}
      destroyOnClose
    >
      {hint ? <p style={{ marginTop: 0, color: 'rgba(0,0,0,0.45)' }}>{hint}</p> : null}
      <Form form={form} layout="vertical">
        <Form.Item name="reason" label={label} rules={[{ required: true, message: `请填写${label}` }]}>
          <Input.TextArea rows={4} placeholder="必填" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
