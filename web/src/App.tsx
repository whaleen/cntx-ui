// web/src/App.tsx - Sidebar Navigation with shadcn/ui
import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BundleList } from './components/BundleList'
import { FileTree } from './components/FileTree'
import { EnhancedBundleConfig } from './components/EnhancedBundleConfig'
import { AIRulesManager } from './components/AIRulesManager'
import { HiddenFilesManager } from './components/HiddenFilesManager'
import { SemanticChunks } from './components/SemanticChunks'
import { SetupChecklist, UsageGuidance, WorkflowInstructions, QuickCliReference, SemanticFeaturesGuide, MCPFeaturesGuide } from './components/SetupComponents'
import SetupScreen from './components/SetupScreen'
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card'
import { Button } from './components/ui/button'
import {
  Layers,
  Sparkles,
  CheckCircle,
  HelpCircle,
  Rocket,
  EyeOff
} from 'lucide-react'
import { ThemeToggle } from './components/theme-toggle'

const queryClient = new QueryClient()

const navigationItems = [
  {
    id: 'bundles',
    label: 'Bundles & Files',
    icon: Layers
  },
  {
    id: 'semantic',
    label: 'Semantic Chunks',
    icon: Sparkles
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: EyeOff
  },
  {
    id: 'ai-rules',
    label: 'AI Rules',
    icon: Sparkles
  },
  {
    id: 'setup',
    label: 'Setup Status',
    icon: CheckCircle
  },
  {
    id: 'help',
    label: 'Help',
    icon: HelpCircle
  },
  {
    id: 'setup-guide',
    label: 'Setup Guide',
    icon: Rocket
  }
]

function App() {
  const [webStatus, setWebStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [mcpStatus, setMcpStatus] = useState<'unknown' | 'running' | 'stopped'>('unknown')
  const [activeSection, setActiveSection] = useState('bundles')
  const [showFullSetupGuide, setShowFullSetupGuide] = useState(false)

  useEffect(() => {
    // Web server status via WebSocket
    const ws = new WebSocket('ws://localhost:3333')
    ws.onopen = () => setWebStatus('connected')
    ws.onclose = () => setWebStatus('disconnected')

    // Check MCP server status
    const checkMcpStatus = async () => {
      try {
        const response = await fetch('/api/mcp-status')
        if (response.ok) {
          const { running } = await response.json()
          setMcpStatus(running ? 'running' : 'stopped')
        } else {
          setMcpStatus('stopped')
        }
      } catch {
        setMcpStatus('stopped')
      }
    }

    checkMcpStatus()
    const mcpInterval = setInterval(checkMcpStatus, 10000) // Check every 10s

    return () => {
      ws.close()
      clearInterval(mcpInterval)
    }
  }, [])

  if (showFullSetupGuide) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="relative">
          <Button
            variant="ghost"
            onClick={() => setShowFullSetupGuide(false)}
            className="absolute top-4 right-4 z-10"
          >
            ← Back to Dashboard
          </Button>
          <SetupScreen />
        </div>
      </QueryClientProvider>
    )
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'bundles':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-lg font-medium tracking-tight">Bundles & Files</h1>
              <p className="text-xs text-muted-foreground font-normal">Manage your file bundles and project structure</p>
            </div>
            <BundleList />
            <Card>
              <CardHeader>
                <CardTitle>Project Files</CardTitle>
              </CardHeader>
              <CardContent>
                <FileTree />
              </CardContent>
            </Card>
          </div>
        )
      case 'semantic':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-lg font-medium tracking-tight">Semantic Chunks</h1>
              <p className="text-xs text-muted-foreground font-normal">AI-powered code organization and intelligent bundles</p>
            </div>
            <SemanticChunks />
          </div>
        )
      case 'settings':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-lg font-medium tracking-tight">Settings</h1>
              <p className="text-xs text-muted-foreground font-normal">Configure file visibility and bundle patterns</p>
            </div>
            <HiddenFilesManager />
            <EnhancedBundleConfig />
          </div>
        )
      case 'ai-rules':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-lg font-medium tracking-tight">AI Rules</h1>
              <p className="text-xs text-muted-foreground font-normal">Configure AI context and project guidelines</p>
            </div>
            <AIRulesManager />
          </div>
        )
      case 'setup':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-lg font-medium tracking-tight">Setup Status</h1>
              <p className="text-xs text-muted-foreground font-normal">Project configuration checklist</p>
            </div>
            <SetupChecklist onOpenFullSetup={() => setShowFullSetupGuide(true)} />
          </div>
        )
      case 'help':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-lg font-medium tracking-tight">Help & Documentation</h1>
              <p className="text-xs text-muted-foreground font-normal">Usage guides and workflow instructions</p>
            </div>
            <UsageGuidance />
            <SemanticFeaturesGuide />
            <MCPFeaturesGuide />
            <WorkflowInstructions />
            <QuickCliReference />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen bg-background overflow-hidden">
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-64 border-r bg-muted/10 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                  <Layers className="w-3 h-3 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-sm font-medium">cntx-ui</h2>
                  <p className="text-xs text-muted-foreground font-normal">Context Manager</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
              {navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = activeSection === item.id

                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start h-8 text-xs font-normal"
                    onClick={() => {
                      if (item.id === 'setup-guide') {
                        setShowFullSetupGuide(true)
                      } else {
                        setActiveSection(item.id)
                      }
                    }}
                  >
                    <Icon className="w-3 h-3 mr-2" />
                    {item.label}
                  </Button>
                )
              })}
            </nav>

          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto pb-12">
            <main className="p-6 max-w-6xl">
              {renderContent()}
            </main>
          </div>
        </div>

        {/* Full-width Status Bar */}
        <div className="fixed bottom-0 left-0 right-0 h-10 bg-card border-t border-border px-4 flex items-center justify-between z-40">
          <div className="flex items-center gap-6">
            {/* Web Server Status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${webStatus === 'connected' ? 'bg-[color:var(--color-success)]' :
                webStatus === 'connecting' ? 'bg-[color:var(--color-warning)]' : 'bg-destructive'
                }`} />
              <span className="text-xs font-normal">
                Web: {webStatus === 'connected' ? 'Live' :
                  webStatus === 'connecting' ? 'Connecting' : 'Offline'}
              </span>
            </div>

            {/* MCP Server Status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${mcpStatus === 'running' ? 'bg-[color:var(--color-success)]' :
                mcpStatus === 'stopped' ? 'bg-destructive' : 'bg-muted-foreground'
                }`} />
              <span className="text-xs font-normal">
                MCP: {mcpStatus === 'running' ? 'Running' :
                  mcpStatus === 'stopped' ? 'Stopped' : 'Unknown'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs text-muted-foreground">
              cntx-ui v2.0.12
            </div>
            <ThemeToggle />
          </div>
        </div>

      </div>
    </QueryClientProvider>
  )
}

export default App
