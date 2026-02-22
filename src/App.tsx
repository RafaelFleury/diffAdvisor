import { RouterProvider } from 'react-router-dom'
import { router } from '@/router.tsx'
import { Toaster } from 'react-hot-toast'

export default function App() {
  return (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--card-bg)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
          },
        }}
      />
      <RouterProvider router={router} />
    </>
  )
}
