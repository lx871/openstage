import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout.js'
import ChatPage from './pages/ChatPage.js'
import CharactersPage from './pages/CharactersPage.js'
import WorldbookPage from './pages/WorldbookPage.js'
import InspectorPage from './pages/InspectorPage.js'
import ConverterPage from './pages/ConverterPage.js'
import SettingsPage from './pages/SettingsPage.js'

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <ChatPage /> },
      { path: '/characters', element: <CharactersPage /> },
      { path: '/worldbook', element: <WorldbookPage /> },
      { path: '/inspector', element: <InspectorPage /> },
      { path: '/converter', element: <ConverterPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><RouterProvider router={router} /></React.StrictMode>)
