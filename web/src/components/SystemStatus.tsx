// web/src/components/SystemStatus.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Alert, AlertDescription } from './ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { CheckCircle, AlertTriangle, Info, Server, Database, Zap, TestTube, RefreshCw, Play } from 'lucide-react'
import { toast } from '@/lib/toast'

interface ServerStatus {
  uptime: number
  memory: any
  bundles: Array<{ name: string; fileCount: number; size: number; changed: boolean }>
  scanning: boolean
  totalFiles: number
  mcp: { enabled: boolean; available: boolean }
}

interface EndpointStatus {
  path: string
  method: string
  description: string
  status: 'unknown' | 'success' | 'error'
  responseTime?: number
  error?: string
}

interface MCPToolStatus {
  name: string
  description: string
  status: 'unknown' | 'available' | 'error'
  error?: string
  group: string
}

// API endpoints to test
const API_ENDPOINTS: Omit<EndpointStatus, 'status' | 'responseTime' | 'error'>[] = [
  { path: '/api/status', method: 'GET', description: 'Server status and health' },
  { path: '/api/bundles', method: 'GET', description: 'List all bundles' },
  { path: '/api/config', method: 'GET', description: 'Get bundle configuration' },
  { path: '/api/files', method: 'GET', description: 'Get file tree' },
  { path: '/api/semantic-chunks', method: 'GET', description: 'Get semantic analysis' },
  { path: '/api/vector-db/status', method: 'GET', description: 'Vector database status' },
  { path: '/api/cursor-rules', method: 'GET', description: 'Cursor rules configuration' },
  { path: '/api/claude-md', method: 'GET', description: 'Claude.md file content' },
  { path: '/api/activities', method: 'GET', description: 'Available activities' },
  { path: '/api/mcp-status', method: 'GET', description: 'MCP server status' },
]

// MCP tools to check - actual tools implemented in mcp-server.js
const MCP_TOOLS: Omit<MCPToolStatus, 'status' | 'error'>[] = [
  // Bundle Management
  { name: 'list_bundles', description: 'List all available file bundles', group: 'Bundle Management' },
  { name: 'get_bundle', description: 'Get the content of a specific bundle', group: 'Bundle Management' },
  { name: 'generate_bundle', description: 'Regenerate a specific bundle', group: 'Bundle Management' },
  { name: 'create_bundle', description: 'Create a new bundle with specified patterns', group: 'Bundle Management' },
  { name: 'update_bundle', description: 'Update an existing bundle\'s patterns', group: 'Bundle Management' },
  { name: 'delete_bundle', description: 'Delete an existing bundle', group: 'Bundle Management' },

  // Project Exploration
  { name: 'get_file_tree', description: 'Get the project file tree', group: 'Project Exploration' },
  { name: 'get_project_status', description: 'Get current project status and bundle information', group: 'Project Exploration' },
  { name: 'update_cntxignore', description: 'Update the .cntxignore file with new ignore patterns', group: 'Project Exploration' },

  // Semantic Analysis
  { name: 'get_semantic_chunks', description: 'Get function-level semantic chunks from the codebase', group: 'Semantic Analysis' },
  { name: 'get_semantic_chunks_filtered', description: 'Get semantic chunks filtered by purpose, type, complexity, or bundle', group: 'Semantic Analysis' },
  { name: 'analyze_bundle_suggestions', description: 'Analyze codebase and suggest optimal bundle organization', group: 'Semantic Analysis' },

  // Agent Modes
  { name: 'agent_discover', description: 'Agent Discovery Mode: Get comprehensive codebase overview', group: 'Agent Modes' },
  { name: 'agent_query', description: 'Agent Query Mode: Answer specific questions about the codebase', group: 'Agent Modes' },
  { name: 'agent_investigate', description: 'Agent Investigation Mode: Investigate existing implementations for a feature', group: 'Agent Modes' },
  { name: 'agent_discuss', description: 'Agent Passive Mode: Engage in discussion about codebase architecture', group: 'Agent Modes' },
  { name: 'agent_organize', description: 'Agent Project Organizer Mode: Setup and maintenance of project organization', group: 'Agent Modes' },

  // File Operations
  { name: 'read_file', description: 'Read contents of a specific file with bundle context and metadata', group: 'File Operations' },
  { name: 'write_file', description: 'Write content to a file with validation and safety checks', group: 'File Operations' },

  // Activities Management
  { name: 'manage_activities', description: 'CRUD operations for project activities', group: 'Activities Management' },
]

const fetchServerStatus = async (): Promise<ServerStatus> => {
  const response = await fetch('http://localhost:3333/api/status')
  if (!response.ok) throw new Error('Failed to fetch server status')
  return response.json()
}

const testEndpoint = async (endpoint: Omit<EndpointStatus, 'status' | 'responseTime' | 'error'>): Promise<EndpointStatus> => {
  const startTime = Date.now()
  try {
    const response = await fetch(`http://localhost:3333${endpoint.path}`)
    const responseTime = Date.now() - startTime

    if (response.ok) {
      return { ...endpoint, status: 'success', responseTime }
    } else {
      return { ...endpoint, status: 'error', responseTime, error: `HTTP ${response.status}` }
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    return {
      ...endpoint,
      status: 'error',
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

const testMCPTool = async (tool: Omit<MCPToolStatus, 'status' | 'error'>): Promise<MCPToolStatus> => {
  try {
    // For now, just check if MCP status endpoint is available
    // In a real implementation, you'd call the actual MCP tools
    const response = await fetch('http://localhost:3333/api/mcp-status')
    if (response.ok) {
      const data = await response.json()
      if (data.enabled) {
        return { ...tool, status: 'available' }
      } else {
        return { ...tool, status: 'error', error: 'MCP server not enabled' }
      }
    } else {
      return { ...tool, status: 'error', error: 'MCP status unavailable' }
    }
  } catch (error) {
    return {
      ...tool,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export function SystemStatus() {
  const [endpointTests, setEndpointTests] = useState<EndpointStatus[]>([])
  const [mcpTests, setMCPTests] = useState<MCPToolStatus[]>([])
  const [testing, setTesting] = useState(false)
  const [selectedMCPGroup, setSelectedMCPGroup] = useState<string>('All')

  const { data: serverStatus, isLoading, error, refetch } = useQuery({
    queryKey: ['server-status'],
    queryFn: fetchServerStatus,
    refetchInterval: 5000,
  })

  const runEndpointTests = async () => {
    setTesting(true)
    try {
      const results = await Promise.all(
        API_ENDPOINTS.map(endpoint => testEndpoint(endpoint))
      )
      setEndpointTests(results)
    } catch (error) {
      console.error('Failed to run endpoint tests:', error)
    } finally {
      setTesting(false)
    }
  }

  const runMCPTests = async () => {
    setTesting(true)
    try {
      const results = await Promise.all(
        MCP_TOOLS.map(tool => testMCPTool(tool))
      )
      setMCPTests(results)
    } catch (error) {
      console.error('Failed to run MCP tests:', error)
    } finally {
      setTesting(false)
    }
  }

  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${Math.floor(seconds)}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const formatMemory = (bytes: number) => {
    const mb = bytes / 1024 / 1024
    return `${Math.round(mb)}MB`
  }

  const getMCPGroups = () => {
    const groups = ['All', ...new Set(MCP_TOOLS.map(tool => tool.group))]
    return groups
  }

  const getFilteredMCPTools = () => {
    if (selectedMCPGroup === 'All') {
      return MCP_TOOLS
    }
    return MCP_TOOLS.filter(tool => tool.group === selectedMCPGroup)
  }

  const getGroupedMCPTools = () => {
    const filtered = getFilteredMCPTools()
    const grouped = filtered.reduce((acc, tool) => {
      if (!acc[tool.group]) {
        acc[tool.group] = []
      }
      acc[tool.group].push(tool)
      return acc
    }, {} as Record<string, typeof MCP_TOOLS>)
    return grouped
  }

  const formatResponseForToast = (data: any, endpoint: string) => {
    // Filter response data to show only relevant info for toasts
    if (typeof data === 'string') {
      return data.length > 100 ? data.substring(0, 100) + '...' : data
    }

    if (Array.isArray(data)) {
      return `Array with ${data.length} items`
    }

    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data)

      // Special formatting for specific endpoints
      if (endpoint.includes('/api/status')) {
        return `Uptime: ${Math.floor(data.uptime || 0)}s, Memory: ${Math.round((data.memory?.heapUsed || 0) / 1024 / 1024)}MB, Files: ${data.totalFiles || 0}`
      }

      if (endpoint.includes('/api/bundles')) {
        return `${data.length || keys.length} bundles found`
      }

      if (endpoint.includes('/api/semantic-chunks')) {
        return `${data.chunks?.length || 0} chunks, ${data.summary?.totalFunctions || 0} functions`
      }

      if (endpoint.includes('/api/vector-db/status')) {
        return `${data.stats?.totalChunks || 0} chunks indexed with ${data.stats?.modelName || 'unknown model'}`
      }

      if (endpoint.includes('/api/activities')) {
        return `${data.length || keys.length} activities found`
      }

      // Generic object formatting
      const summary = keys.slice(0, 3).map(key => {
        const value = data[key]
        if (typeof value === 'object') {
          return `${key}: ${Array.isArray(value) ? `[${value.length}]` : '{object}'}`
        }
        return `${key}: ${String(value).substring(0, 20)}`
      }).join(', ')

      return keys.length > 3 ? `${summary}... (+${keys.length - 3} more)` : summary
    }

    return String(data).substring(0, 100)
  }

  const testSingleEndpoint = async (endpoint: Omit<EndpointStatus, 'status' | 'responseTime' | 'error'>) => {
    const startTime = Date.now()
    try {
      const response = await fetch(`http://localhost:3333${endpoint.path}`)
      const responseTime = Date.now() - startTime

      if (response.ok) {
        const data = await response.json()
        const summary = formatResponseForToast(data, endpoint.path)
        toast.success(`${endpoint.path} (${responseTime}ms)`, summary)
      } else {
        toast.error(`${endpoint.path} failed`, `HTTP ${response.status} (${responseTime}ms)`)
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      toast.error(`${endpoint.path} error`, `${error instanceof Error ? error.message : 'Unknown error'} (${responseTime}ms)`)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Checking system status...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center space-y-2">
            <AlertTriangle className="h-6 w-6 mx-auto text-red-500" />
            <p className="text-sm font-medium">Failed to connect to server</p>
            <p className="text-xs text-muted-foreground">
              Make sure the cntx-ui server is running on localhost:3333
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Server Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Server Status
            <CheckCircle className="w-4 h-4 text-green-600" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Uptime</div>
              <div className="font-medium">{formatUptime(serverStatus?.uptime || 0)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Memory</div>
              <div className="font-medium">{formatMemory(serverStatus?.memory?.heapUsed || 0)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total Files</div>
              <div className="font-medium">{serverStatus?.totalFiles || 0}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Bundles</div>
              <div className="font-medium">{serverStatus?.bundles?.length || 0}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant={serverStatus?.scanning ? "destructive" : "secondary"}>
              {serverStatus?.scanning ? "Scanning" : "Idle"}
            </Badge>
            <Badge variant={serverStatus?.mcp?.enabled ? "default" : "secondary"}>
              MCP: {serverStatus?.mcp?.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Tests */}
      <Tabs defaultValue="endpoints" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="endpoints" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            API Endpoints
          </TabsTrigger>
          <TabsTrigger value="mcp" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            MCP Tools
          </TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">API Endpoints</CardTitle>
                <Button
                  onClick={runEndpointTests}
                  disabled={testing}
                  size="sm"
                  variant="outline"
                >
                  <TestTube className="w-4 h-4 mr-2" />
                  {testing ? 'Testing...' : 'Test All'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {API_ENDPOINTS.map((endpoint, index) => {
                  const testResult = endpointTests.find(t => t.path === endpoint.path)
                  return (
                    <div key={endpoint.path} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {endpoint.method}
                          </Badge>
                          <code className="text-sm">{endpoint.path}</code>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {endpoint.description}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => testSingleEndpoint(endpoint)}
                          className="h-7 w-7 p-0"
                          title={`Test ${endpoint.path}`}
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                        {testResult && (
                          <>
                            <span className="text-xs text-muted-foreground">
                              {testResult.responseTime}ms
                            </span>
                            {testResult.status === 'success' ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : testResult.status === 'error' ? (
                              <AlertTriangle className="w-4 h-4 text-red-600" title={testResult.error} />
                            ) : (
                              <div className="w-4 h-4 bg-gray-300 rounded-full" />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mcp" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">MCP Tools</CardTitle>
                <div className="flex items-center gap-3">
                  <Select value={selectedMCPGroup} onValueChange={setSelectedMCPGroup}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by group" />
                    </SelectTrigger>
                    <SelectContent>
                      {getMCPGroups().map(group => (
                        <SelectItem key={group} value={group}>
                          {group} {group === 'All' ? `(${MCP_TOOLS.length})` : `(${MCP_TOOLS.filter(t => t.group === group).length})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={runMCPTests}
                    disabled={testing || !serverStatus?.mcp?.enabled}
                    size="sm"
                    variant="outline"
                  >
                    <TestTube className="w-4 h-4 mr-2" />
                    {testing ? 'Testing...' : 'Test All'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!serverStatus?.mcp?.enabled && (
                <Alert className="mb-4">
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    MCP server is not enabled. MCP tools will not be available.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                {selectedMCPGroup === 'All' ? (
                  // Show grouped when All is selected
                  Object.entries(getGroupedMCPTools()).map(([groupName, tools]) => (
                    <div key={groupName} className="space-y-2">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <h4 className="text-sm font-medium text-muted-foreground">{groupName}</h4>
                        <Badge variant="outline" className="text-xs">
                          {tools.length} tools
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {tools.map((tool) => {
                          const testResult = mcpTests.find(t => t.name === tool.name)
                          return (
                            <div key={tool.name} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                              <div className="flex-1">
                                <div className="font-medium text-sm">{tool.name}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {tool.description}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {testResult ? (
                                  testResult.status === 'available' ? (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <AlertTriangle className="w-4 h-4 text-red-600" title={testResult.error} />
                                  )
                                ) : (
                                  <div className="w-4 h-4 bg-gray-300 rounded-full" />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  // Show flat list when specific group is selected
                  <div className="space-y-2">
                    {getFilteredMCPTools().map((tool) => {
                      const testResult = mcpTests.find(t => t.name === tool.name)
                      return (
                        <div key={tool.name} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{tool.name}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {tool.description}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {testResult ? (
                              testResult.status === 'available' ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-red-600" title={testResult.error} />
                              )
                            ) : (
                              <div className="w-4 h-4 bg-gray-300 rounded-full" />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
