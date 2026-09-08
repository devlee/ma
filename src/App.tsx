import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { RouterProvider } from 'react-router-dom';
import { RoleProvider } from '@/contexts/RoleContext';
import { router } from '@/router';
import { BuyerShowProvider } from '@/store/buyerShow';

dayjs.locale('zh-cn');

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <RoleProvider>
        <BuyerShowProvider>
          <RouterProvider router={router} />
        </BuyerShowProvider>
      </RoleProvider>
    </ConfigProvider>
  );
}
