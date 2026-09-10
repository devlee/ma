import { createHashRouter, Navigate } from 'react-router-dom';
import { BasicLayout } from '@/layouts/BasicLayout';
import QcLibrary from '@/pages/buyer-show/QcLibrary';
import TaskList from '@/pages/buyer-show/TaskList';
import TaskClaim from '@/pages/buyer-show/TaskClaim';
import ProduceBatch from '@/pages/buyer-show/ProduceBatch';
import FreeBatch from '@/pages/buyer-show/FreeBatch';
import ProduceSingle from '@/pages/buyer-show/ProduceSingle';
import SubtaskDetail from '@/pages/buyer-show/SubtaskDetail';
import Review from '@/pages/buyer-show/Review';
import Dashboard from '@/pages/buyer-show/Dashboard';
import Config from '@/pages/buyer-show/Config';

export const router = createHashRouter([
  {
    path: '/',
    element: <BasicLayout />,
    children: [
      { index: true, element: <Navigate to="/buyer-show/task-list" replace /> },
      { path: 'buyer-show', element: <Navigate to="/buyer-show/task-list" replace /> },
      { path: 'buyer-show/qc-library', element: <QcLibrary /> },
      { path: 'buyer-show/task-list', element: <TaskList /> },
      { path: 'buyer-show/task-claim', element: <TaskClaim /> },
      { path: 'buyer-show/produce-batch', element: <ProduceBatch /> },
      { path: 'buyer-show/free-batch', element: <FreeBatch /> },
      { path: 'buyer-show/produce-single', element: <ProduceSingle /> },
      { path: 'buyer-show/subtask/:id', element: <SubtaskDetail /> },
      { path: 'buyer-show/review', element: <Review /> },
      { path: 'buyer-show/dashboard', element: <Dashboard /> },
      { path: 'buyer-show/config', element: <Config /> },
    ],
  },
]);
