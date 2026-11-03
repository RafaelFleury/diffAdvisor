import { createBrowserRouter } from 'react-router-dom'
import Layout from '@/components/layout/Layout.tsx'
import Dashboard from '@/pages/Dashboard.tsx'
import Debrief from '@/pages/Debrief.tsx'
import KnowledgeBase from '@/pages/KnowledgeBase.tsx'
import Settings from '@/pages/Settings.tsx'
import CodeGraph from '@/pages/CodeGraph.tsx'
import { CODE_GRAPH_ENABLED } from '@/features.ts'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'debrief/:commitHash', element: <Debrief /> },
      ...(CODE_GRAPH_ENABLED ? [{ path: 'code-graph', element: <CodeGraph /> }] : []),
      { path: 'knowledge', element: <KnowledgeBase /> },
      { path: 'knowledge/:noteId', element: <KnowledgeBase /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
])
