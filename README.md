# ma

运营系统【灵枢】仓库。本仓库包含【买家秀管理】前端工程。

## 技术栈

- Vite + React 18 + TypeScript（严格模式）
- Ant Design 5（含 `@ant-design/icons`），中文 locale（`zh_CN`），dayjs
- React Router v6（`createBrowserRouter`）
- 样式：CSS Modules
- 状态：React Context + `useReducer`（`src/store/buyerShow.tsx`，刷新即重置）
- 图表：`echarts` + `echarts-for-react`
- ESLint + Prettier

## 包管理

优先使用 **pnpm**。若本机没有 pnpm，可用 npm 代替（脚本名相同：`npm install` / `npm run dev` / `npm run build` / `npm run lint`）。

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
```

开发服务器启动后访问 http://localhost:5173/buyer-show/task-list 。

## 目录说明

```
docs/                 需求文档（请勿在实现时改动）
src/
  main.tsx            入口
  App.tsx             RouterProvider + ConfigProvider(zh_CN) + 角色 / 买家秀 store
  router/             路由表，前缀 /buyer-show
  layouts/            左侧菜单 + 顶部当前角色切换
  pages/buyer-show/   买家秀管理各页面
  components/         状态 Tag、图片占位、原因弹窗、素材选择器、描述词编辑器
  store/              买家秀内存 store（认领 / 分发 / 审核等流转）
  types/              领域类型（对齐需求第 8 / 4.3 / 6 / 11 节）
  mocks/              示例数据
  contexts/           角色 Context（运营 / 买家秀设计）
  styles/             全局样式
```
