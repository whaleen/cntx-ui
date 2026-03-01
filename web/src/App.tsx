// web/src/App.tsx - Modular Layout using AppSidebar
import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BundleList } from './components/BundleList'
import { SystemStatus } from './components/SystemStatus'
import { SemanticChunks } from './components/SemanticChunks'
import { Search } from 'lucide-react'
import { ThemeToggle } from './components/theme-toggle'
import { VectorVisualization } from './components/VectorVisualization'
import { SystemSettings } from './components/SystemSettings'
import { Documentation } from './components/Documentation'
import { DatabaseViewer } from './components/DatabaseViewer'

// Modular Components
import { AppSidebar } from "./components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "./components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./components/ui/breadcrumb"
import { Separator } from "./components/ui/separator"

const queryClient = new QueryClient()

function App() {
  const [mcpStatus, setMcpStatus] = useState<'unknown' | 'running' | 'stopped'>('unknown')
  const [projectName, setProjectName] = useState<string>('cntx-ui')
  const [version, setVersion] = useState<string>('v3.1.18')
  const [activeSection, setActiveSection] = useState<string>('bundles')

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/status')
        if (response.ok) {
          const data = await response.json()
          if (data.projectPath) {
            const parts = data.projectPath.split('/')
            setProjectName(parts[parts.length - 1])
          }
          if (data.mcp) {
            setMcpStatus(data.mcp.available ? 'running' : 'stopped')
          }
        }
      } catch (e) {
        console.error('Failed to fetch status:', e)
      }
    }

    checkStatus()
    const statusInterval = setInterval(checkStatus, 10000)
    return () => clearInterval(statusInterval)
  }, [])

  const renderContent = () => {
    switch (activeSection) {
      case 'bundles': return <BundleList />
      case 'semantic': return (
        <div className="space-y-6">
          <header>
            <h1 className="text-lg  tracking-tight">Semantic Chunks</h1>
            <p className="text-xs text-muted-foreground ">AI-powered code organization and intelligent bundles</p>
          </header>
          <SemanticChunks />
        </div>
      )
      case 'vector-db': return <VectorVisualization />
      case 'database': return (
        <div className="space-y-6">
          <header>
            <h1 className="text-lg  tracking-tight">SQLite Database</h1>
            <p className="text-xs text-muted-foreground ">Query and inspect the bundle database</p>
          </header>
          <DatabaseViewer />
        </div>
      )
      case 'settings': return (
        <div className="space-y-6">
          <header>
            <h1 className="text-lg  tracking-tight">Settings</h1>
            <p className="text-xs text-muted-foreground ">Configure file visibility and bundle patterns</p>
          </header>
          <SystemSettings />
        </div>
      )
      case 'system-status': return (
        <div className="space-y-6">
          <header>
            <h1 className="text-lg  tracking-tight">System Status</h1>
            <p className="text-xs text-muted-foreground ">Overall health and configuration of cntx-ui</p>
          </header>
          <SystemStatus />
        </div>
      )
      case 'help': return <Documentation />
      default: return null
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <AppSidebar 
          projectName={projectName}
          version={version}
          mcpStatus={mcpStatus}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#" onClick={(e) => { e.preventDefault(); setActiveSection('bundles'); }}>
                      {projectName}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="capitalize">{activeSection.replace('-', ' ')}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <div className="hidden md:flex items-center relative max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input 
                  type="search" 
                  placeholder="Quick search..." 
                  className="pl-8 h-9 w-64 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <ThemeToggle />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-6 overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl">
              {renderContent()}
            </div>
          </div>
          <footer className="flex h-10 shrink-0 items-center gap-4 border-t px-4 bg-muted/20">
            <div className="flex items-center gap-2">
              <div className={`size-2 rounded-full ${mcpStatus === 'running' ? 'bg-[color:var(--color-success)]' : 'bg-destructive'}`} />
              <span className="text-[10px]  uppercase tracking-widest text-muted-foreground">
                MCP: {mcpStatus}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <span className="text-[10px]  uppercase tracking-widest text-muted-foreground">
                cntx-ui {version}
              </span>
            </div>
          </footer>
        </SidebarInset>
      </SidebarProvider>
    </QueryClientProvider>
  )
}

export default App
