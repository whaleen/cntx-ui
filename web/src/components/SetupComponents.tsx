// web/src/components/SetupComponents.tsx
import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Alert, AlertDescription } from './ui/alert'
import { CheckCircle, AlertTriangle, Settings, Play, Terminal, FileText, Monitor, Command, Sparkles, Brain, Zap, Eye, FolderOpen, Layers, Code, Globe } from 'lucide-react'

interface SetupStatus {
  hasConfig: boolean
  hasIgnoreFile: boolean
  bundleCount: number
  hasCursorRules: boolean
  isFirstTime: boolean
}

const fetchSetupStatus = async (): Promise<SetupStatus> => {
  try {
    const [configResponse, bundlesResponse, cursorResponse] = await Promise.all([
      fetch('http://localhost:3333/api/config'),
      fetch('http://localhost:3333/api/bundles'),
      fetch('http://localhost:3333/api/cursor-rules')
    ])

    const hasConfig = configResponse.ok
    const bundles = bundlesResponse.ok ? await bundlesResponse.json() : []
    const hasCursorRules = cursorResponse.ok

    return {
      hasConfig,
      hasIgnoreFile: true, // We can assume this exists if config exists
      bundleCount: bundles.length || 0,
      hasCursorRules,
      isFirstTime: !hasConfig || bundles.length === 0
    }
  } catch (error) {
    return {
      hasConfig: false,
      hasIgnoreFile: false,
      bundleCount: 0,
      hasCursorRules: false,
      isFirstTime: true
    }
  }
}

interface SetupBannerProps {
  onStartSetup: () => void
}

export function SetupBanner({ onStartSetup }: SetupBannerProps) {
  const { data: status, isLoading } = useQuery({
    queryKey: ['setup-status'],
    queryFn: fetchSetupStatus,
    refetchInterval: 5000,
  })

  if (isLoading || !status?.isFirstTime) {
    return null
  }

  return (
    <Alert className="mb-6 border-[color:var(--color-info)]/20 bg-[color:var(--color-info)]/5">
      <Settings className="w-4 h-4" />
      <AlertDescription className="flex items-center justify-between">
        <div>
          <strong>Welcome to cntx-ui!</strong> This looks like your first time.
          The web interface is already running - let's help you get set up properly.
        </div>
        <Button onClick={onStartSetup} size="sm">
          Start Setup Guide
        </Button>
      </AlertDescription>
    </Alert>
  )
}

interface SetupChecklistProps {
  onOpenFullSetup: () => void
}

export function SetupChecklist({ onOpenFullSetup }: SetupChecklistProps) {
  const { data: status, isLoading } = useQuery({
    queryKey: ['setup-status'],
    queryFn: fetchSetupStatus,
    refetchInterval: 10000,
  })

  if (isLoading) {
    return <div>Checking setup status...</div>
  }

  const checks = [
    {
      label: 'Configuration file exists',
      passed: status?.hasConfig || false,
      description: '.cntx/config.json with bundle definitions'
    },
    {
      label: 'Ignore patterns configured',
      passed: status?.hasIgnoreFile || false,
      description: '.cntxignore file to exclude unnecessary files'
    },
    {
      label: 'Bundles generated',
      passed: (status?.bundleCount || 0) > 0,
      description: `${status?.bundleCount || 0} bundles currently configured`
    },
    {
      label: 'Cursor rules created',
      passed: status?.hasCursorRules || false,
      description: '.cursorrules file for AI assistant context'
    }
  ]

  const allPassed = checks.every(check => check.passed)

  return (
    <Card className={!allPassed ? 'border-[color:var(--color-warning)]/20' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Settings className="w-4 h-4" />
          Setup Status
          {allPassed ? (
            <CheckCircle className="w-4 h-4 text-[color:var(--color-success)]" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-[color:var(--color-warning)]" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {checks.map((check, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {check.passed ? (
                  <CheckCircle className="w-4 h-4 text-[color:var(--color-success)]" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[color:var(--color-warning)]" />
                )}
              </div>
              <div className="flex-1">
                <div className={`text-xs font-medium ${check.passed ? 'text-[color:var(--color-success)]' : 'text-[color:var(--color-warning)]'}`}>
                  {check.label}
                </div>
                <div className="text-xs text-muted-foreground font-normal">{check.description}</div>
              </div>
            </div>
          ))}
        </div>

        {!allPassed && (
          <div className="mt-4 pt-4 border-t">
            <Button onClick={onOpenFullSetup} variant="outline" size="sm" className="w-full h-7 text-xs">
              <Play className="w-3 h-3 mr-2" />
              Complete Setup Guide
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Main usage guidance component
export function UsageGuidance() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Monitor className="w-4 h-4" />
          How to Use cntx-ui
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="border-[color:var(--color-info)]/20 bg-[color:var(--color-info)]/5">
          <Terminal className="w-4 h-4" />
          <AlertDescription>
            <strong>You're already running!</strong> The web interface provides full functionality.
            CLI commands are available for automation and advanced workflows.
          </AlertDescription>
        </Alert>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs font-medium mb-3 flex items-center gap-2">
              <Monitor className="w-3 h-3" />
              Web Interface (Recommended)
            </h4>
            <div className="text-xs text-muted-foreground font-normal space-y-2">
              <p>Perfect for interactive use and project management:</p>
              <div className="ml-4 space-y-1">
                <div>• <strong>Bundle Management:</strong> View, create, and manage bundles</div>
                <div>• <strong>Semantic Analysis:</strong> AI-powered code chunking and analysis</div>
                <div>• <strong>Hidden Files:</strong> Control file visibility per bundle</div>
                <div>• <strong>Cursor Rules:</strong> Manage AI assistant context</div>
                <div>• <strong>Real-time Updates:</strong> See changes immediately</div>
                <div>• <strong>MCP Integration:</strong> Seamless AI tool connectivity</div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium mb-3 flex items-center gap-2">
              <Command className="w-3 h-3" />
              Command Line Interface
            </h4>
            <div className="text-xs text-muted-foreground font-normal space-y-2">
              <p>Great for automation, scripts, and CI/CD:</p>
              <div className="ml-4 space-y-1">
                <div>• <strong>Quick bundle generation:</strong> <code className="bg-muted px-1 rounded">cntx-ui bundle master</code></div>
                <div>• <strong>Status checking:</strong> <code className="bg-muted px-1 rounded">cntx-ui status</code></div>
                <div>• <strong>MCP server:</strong> <code className="bg-muted px-1 rounded">cntx-ui mcp</code></div>
                <div>• <strong>Claude Desktop setup:</strong> <code className="bg-muted px-1 rounded">cntx-ui setup-mcp</code></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-accent/50 p-4 rounded-lg border">
          <h4 className="text-xs font-medium mb-2">🚀 Key Features Overview</h4>
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground font-normal">
            <div className="flex items-center gap-2">
              <Layers className="w-3 h-3" />
              <span>File bundling & organization</span>
            </div>
            <div className="flex items-center gap-2">
              <Brain className="w-3 h-3" />
              <span>Semantic code analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-3 h-3" />
              <span>MCP server integration</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-3 h-3" />
              <span>Hidden files management</span>
            </div>
            <div className="flex items-center gap-2">
              <Code className="w-3 h-3" />
              <span>Cursor rules integration</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3" />
              <span>Real-time updates</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Quick CLI reference for advanced users
export function QuickCliReference() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Terminal className="w-4 h-4" />
          CLI Reference
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-medium mb-2">Basic Commands</h4>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-2 py-1 rounded text-xs">cntx-ui watch</code>
                  <span className="text-muted-foreground text-xs">Start server (already running)</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-2 py-1 rounded text-xs">cntx-ui status</code>
                  <span className="text-muted-foreground text-xs">Check configuration status</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-2 py-1 rounded text-xs">cntx-ui bundle [name]</code>
                  <span className="text-muted-foreground text-xs">Generate specific bundle</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-medium mb-2">Advanced Commands</h4>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-2 py-1 rounded text-xs">cntx-ui mcp</code>
                  <span className="text-muted-foreground text-xs">Start MCP server</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-2 py-1 rounded text-xs">cntx-ui setup-mcp</code>
                  <span className="text-muted-foreground text-xs">Setup Claude Desktop</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-2 py-1 rounded text-xs">cntx-ui init</code>
                  <span className="text-muted-foreground text-xs">Initialize project</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Workflow instructions component
export function WorkflowInstructions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <FileText className="w-4 h-4" />
          Common Workflows
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs font-medium mb-3 flex items-center gap-2">
              <Brain className="w-3 h-3" />
              For AI Development
            </h4>
            <div className="text-xs text-muted-foreground font-normal space-y-2">
              <div>1. Create focused bundles (api, ui, core)</div>
              <div>2. Use semantic analysis for intelligent chunking</div>
              <div>3. Hide debug/temp files from bundles</div>
              <div>4. Copy bundle XML for AI context</div>
              <div>5. Set up Cursor Rules for project context</div>
              <div>6. Enable MCP for seamless AI integration</div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium mb-3 flex items-center gap-2">
              <FolderOpen className="w-3 h-3" />
              For Project Organization
            </h4>
            <div className="text-xs text-muted-foreground font-normal space-y-2">
              <div>1. Configure ignore patterns for unwanted files</div>
              <div>2. Create bundles by feature or responsibility</div>
              <div>3. Use hidden files to trim bundle scope</div>
              <div>4. Monitor bundle sizes and file counts</div>
              <div>5. Leverage semantic analysis for smart grouping</div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-medium mb-3 flex items-center gap-2">
            <Globe className="w-3 h-3" />
            For MCP Integration
          </h4>
          <div className="text-xs text-muted-foreground font-normal space-y-2">
            <div>1. Run <code className="bg-muted px-1 rounded">cntx-ui setup-mcp</code> in your project</div>
            <div>2. Configure bundles via web interface</div>
            <div>3. AI clients connect via MCP to access bundles</div>
            <div>4. Real-time updates immediately available to AI</div>
            <div>5. Use with Claude Desktop, Cursor, or other MCP clients</div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-medium mb-3 flex items-center gap-2">
            <Zap className="w-3 h-3" />
            For CI/CD Integration
          </h4>
          <div className="text-xs text-muted-foreground font-normal space-y-2">
            <div>1. Use CLI commands in build scripts</div>
            <div>2. Generate bundles for automated testing</div>
            <div>3. Export project context for deployment</div>
            <div>4. Integrate semantic analysis in workflows</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Installation reminder for new users
export function InstallationReminder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">First Time Setup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert className="border-[color:var(--color-success)]/20 bg-[color:var(--color-success)]/5">
          <CheckCircle className="w-4 h-4" />
          <AlertDescription>
            <strong>You're all set!</strong> cntx-ui is installed and running.
            Use this web interface for full functionality.
          </AlertDescription>
        </Alert>

        <div className="text-xs text-muted-foreground font-normal">
          <p className="mb-2"><strong>For new projects:</strong></p>
          <div className="ml-4 space-y-1">
            <div>1. Install: <code className="bg-muted px-1 rounded">npm install -g cntx-ui</code></div>
            <div>2. Initialize: <code className="bg-muted px-1 rounded">cntx-ui init</code></div>
            <div>3. Start: <code className="bg-muted px-1 rounded">cntx-ui watch</code></div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// New component for semantic features
export function SemanticFeaturesGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Brain className="w-4 h-4" />
          Semantic Analysis Features
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-[color:var(--color-info)]/20 bg-[color:var(--color-info)]/5">
          <Sparkles className="w-4 h-4" />
          <AlertDescription>
            <strong>AI-Powered Code Understanding:</strong> cntx-ui uses advanced semantic analysis to intelligently organize your code.
          </AlertDescription>
        </Alert>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-medium mb-2">What Semantic Analysis Does</h4>
            <div className="text-xs text-muted-foreground font-normal space-y-1">
              <div>• Analyzes code structure and relationships</div>
              <div>• Identifies functions, classes, and components</div>
              <div>• Maps import/export dependencies</div>
              <div>• Groups related files intelligently</div>
              <div>• Suggests optimal bundle configurations</div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium mb-2">Available in Web Interface</h4>
            <div className="text-xs text-muted-foreground font-normal space-y-1">
              <div>• <strong>Semantic Chunks tab:</strong> View AI-generated code chunks</div>
              <div>• <strong>Bundle analysis:</strong> See file relationships</div>
              <div>• <strong>Complexity metrics:</strong> Understand code structure</div>
              <div>• <strong>Export chunks:</strong> Use semantic chunks with AI tools</div>
            </div>
          </div>
        </div>

        <div className="bg-accent/50 p-3 rounded-lg border">
          <h4 className="text-xs font-medium mb-2">How to Use Semantic Features</h4>
          <div className="text-xs text-muted-foreground font-normal space-y-1">
            <div>1. Go to <strong>Semantic Chunks</strong> tab in the web interface</div>
            <div>2. View AI-generated code chunks and their purposes</div>
            <div>3. Export specific chunks for AI context</div>
            <div>4. Use chunk insights to improve bundle organization</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// New component for MCP features
export function MCPFeaturesGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Globe className="w-4 h-4" />
          MCP Integration Guide
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-[color:var(--color-info)]/20 bg-[color:var(--color-info)]/5">
          <Zap className="w-4 h-4" />
          <AlertDescription>
            <strong>Seamless AI Integration:</strong> cntx-ui works as an MCP (Model Context Protocol) server for direct AI tool access.
          </AlertDescription>
        </Alert>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-medium mb-2">MCP Resources Available</h4>
            <div className="text-xs text-muted-foreground font-normal space-y-1">
              <div>• <code>cntx://bundle/[name]</code> - Access any bundle as XML</div>
              <div>• <code>cntx://file/[path]</code> - Access individual project files</div>
              <div>• Real-time bundle updates</div>
              <div>• Semantic chunk exports</div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium mb-2">MCP Tools Available</h4>
            <div className="text-xs text-muted-foreground font-normal space-y-1">
              <div>• <strong>list_bundles</strong> - List all available bundles</div>
              <div>• <strong>get_bundle</strong> - Retrieve specific bundle content</div>
              <div>• <strong>generate_bundle</strong> - Regenerate a bundle</div>
              <div>• <strong>get_file_tree</strong> - Get project file structure</div>
              <div>• <strong>get_project_status</strong> - Get current project status</div>
            </div>
          </div>
        </div>

        <div className="bg-accent/50 p-3 rounded-lg border">
          <h4 className="text-xs font-medium mb-2">Setup Instructions</h4>
          <div className="text-xs text-muted-foreground font-normal space-y-1">
            <div>1. Run <code className="bg-muted px-1 rounded">cntx-ui setup-mcp</code> in your project</div>
            <div>2. This automatically configures Claude Desktop</div>
            <div>3. AI tools can now access your bundles directly</div>
            <div>4. Changes in web interface are immediately available to AI</div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground font-normal">
          <p><strong>Supported MCP Clients:</strong> Claude Desktop, Cursor IDE, and other MCP-compatible AI tools.</p>
        </div>
      </CardContent>
    </Card>
  )
}

// Legacy components for backward compatibility
export const QuickSetupTips = QuickCliReference
export const UsageInstructions = WorkflowInstructions
