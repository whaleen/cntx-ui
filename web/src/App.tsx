// web/src/App.tsx - Sidebar Navigation with shadcn/ui
import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BundleList } from './components/BundleList'
import { AIRulesManager } from './components/AIRulesManager'
import { SystemStatus } from './components/SystemStatus'
import { SemanticChunks } from './components/SemanticChunks'
import { Button } from './components/ui/button'
import {
  Layers,
  Sparkles,
  CheckCircle,
  HelpCircle,
  Settings,
  Database,
  X,
  Activity,
  PanelLeft
} from 'lucide-react'
import { ThemeToggle } from './components/theme-toggle'
import { VectorVisualization } from './components/VectorVisualization'
import { Activities } from './components/Activities'
import { SystemSettings } from './components/SystemSettings'
import { Documentation } from './components/Documentation'

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
    id: 'vector-db',
    label: 'Vector Database',
    icon: Database
  },
  {
    id: 'activities',
    label: 'Activities',
    icon: Activity
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings
  },
  {
    id: 'ai-rules',
    label: 'AI Rules',
    icon: Sparkles
  },
  {
    id: 'system-status',
    label: 'System Status',
    icon: CheckCircle
  },
  {
    id: 'help',
    label: 'Help & Documentation',
    icon: HelpCircle
  }
]

// User preferences with localStorage persistence
const PREFERENCES_KEY = 'cntx-ui-preferences'

interface UserPreferences {
  sidebarCollapsed: boolean
  activeSection: string
  // Future preferences can be added here
}

const getStoredPreferences = (): UserPreferences => {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY)
    if (stored) {
      return { ...defaultPreferences, ...JSON.parse(stored) }
    }
  } catch (error) {
    console.warn('Failed to load preferences from localStorage:', error)
  }
  return defaultPreferences
}

const savePreferences = (preferences: UserPreferences) => {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
  } catch (error) {
    console.warn('Failed to save preferences to localStorage:', error)
  }
}

const defaultPreferences: UserPreferences = {
  sidebarCollapsed: false,
  activeSection: 'bundles'
}

function App() {
  const [webStatus, setWebStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [mcpStatus, setMcpStatus] = useState<'unknown' | 'running' | 'stopped'>('unknown')

  // Initialize preferences from localStorage
  const [preferences, setPreferences] = useState<UserPreferences>(getStoredPreferences)
  const { sidebarCollapsed, activeSection } = preferences

  // Helper to update preferences and persist to localStorage
  const updatePreferences = (updates: Partial<UserPreferences>) => {
    const newPreferences = { ...preferences, ...updates }
    setPreferences(newPreferences)
    savePreferences(newPreferences)
  }

  const setSidebarCollapsed = (collapsed: boolean) => {
    updatePreferences({ sidebarCollapsed: collapsed })
  }

  const setActiveSection = (section: string) => {
    updatePreferences({ activeSection: section })
  }

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


  const renderContent = () => {
    switch (activeSection) {
      case 'bundles':
        return (
          <div className="space-y-6">

            <BundleList />
          </div>
        )
      case 'semantic':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-lg font-thin tracking-tight">Semantic Chunks</h1>
              <p className="text-xs text-muted-foreground font-thin">AI-powered code organization and intelligent bundles</p>
            </div>
            <SemanticChunks />
          </div>
        )
      case 'vector-db':
        return (
          <div className="space-y-6">
            <VectorVisualization />
          </div>
        )
      case 'activities':
        return (
          <Activities />
        )
      case 'settings':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-lg font-thin tracking-tight">Settings</h1>
              <p className="text-xs text-muted-foreground font-thin">Configure file visibility and bundle patterns</p>
            </div>
            <SystemSettings />
          </div>
        )
      case 'ai-rules':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-lg font-thin tracking-tight">AI Rules</h1>
              <p className="text-xs text-muted-foreground font-thin">Configure AI context and project guidelines</p>
            </div>
            <AIRulesManager />
          </div>
        )
      case 'system-status':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-lg font-thin tracking-tight">System Status</h1>
              <p className="text-xs text-muted-foreground font-thin">Overall health and configuration of cntx-ui</p>
            </div>
            <SystemStatus />
          </div>
        )
      case 'help':
        return (
          <Documentation />
        )
      default:
        return null
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen bg-background overflow-hidden flex flex-col">
        {/* Header - Full width when sidebar collapsed */}
        {sidebarCollapsed && (
          <div className="h-16 border-b flex items-center px-4 flex-shrink-0">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                  <Layers className="w-3 h-3 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-sm font-thin">cntx-ui</h2>
                  <p className="text-xs text-muted-foreground font-thin">Context Manager</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-xs text-muted-foreground">
                cntx-ui v2.0.12
              </div>
              <ThemeToggle />
            </div>
          </div>
        )}

        <div className="flex flex-1" style={{ height: sidebarCollapsed ? 'calc(100vh - 4rem)' : '100%' }}>
          {/* Sidebar */}
          <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} border-r flex flex-col h-full transition-all duration-200`}>
            {/* Header - Only visible when sidebar expanded */}
            {!sidebarCollapsed && (
              <div className="p-4 border-b flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                    <Layers className="w-3 h-3 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-sm font-thin">cntx-ui</h2>
                    <p className="text-xs text-muted-foreground font-thin">Context Manager</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSidebarCollapsed(true)}
                    className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Collapsed header with just toggle */}
            {sidebarCollapsed && (
              <div className="p-3 border-b flex-shrink-0 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarCollapsed(false)}
                  className="h-8 w-8 p-0"
                >
                  <PanelLeft className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Navigation */}
            <nav className={`${sidebarCollapsed ? 'p-2' : 'p-4'} space-y-1 flex-1 overflow-y-auto`}>
              {navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = activeSection === item.id

                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "secondary" : "ghost"}
                    className={`${sidebarCollapsed
                      ? 'w-12 h-12 p-0 justify-center'
                      : 'w-full justify-start h-8 text-xs font-thin'
                      } transition-all`}
                    onClick={() => setActiveSection(item.id)}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon className={`${sidebarCollapsed ? 'w-4 h-4' : 'w-3 h-3 mr-2'}`} />
                    {!sidebarCollapsed && item.label}
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

        {/* Fixed Status Bar - Always visible, positioned correctly */}
        <div className={`fixed left-0 right-0 h-10 bg-card border-t border-border px-4 flex items-center justify-between z-40 ${sidebarCollapsed ? 'bottom-0' : 'bottom-0'
          }`}>
          <div className="flex items-center gap-6">
            {/* Web Server Status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${webStatus === 'connected' ? 'bg-[color:var(--color-success)]' :
                webStatus === 'connecting' ? 'bg-[color:var(--color-warning)]' : 'bg-destructive'
                }`} />
              <span className="text-xs font-thin">
                UI: {webStatus === 'connected' ? 'Live' :
                  webStatus === 'connecting' ? 'Connecting' : 'Offline'}
              </span>
            </div>

            {/* MCP Server Status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${mcpStatus === 'running' ? 'bg-[color:var(--color-success)]' :
                mcpStatus === 'stopped' ? 'bg-destructive' : 'bg-muted-foreground'
                }`} />
              <span className="text-xs font-thin">
                MCP SERVER: {mcpStatus === 'running' ? 'Running' :
                  mcpStatus === 'stopped' ? 'Stopped' : 'Unknown'}
              </span>
            </div>
          </div>

          {!sidebarCollapsed && (
            <div className="flex items-center gap-4">
              <div className="text-xs text-muted-foreground">
                cntx-ui v2.0.12
              </div>
              <ThemeToggle />
            </div>
          )}
        </div>

      </div>
    </QueryClientProvider>
  )
}

export default App
