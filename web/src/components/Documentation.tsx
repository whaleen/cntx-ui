// web/src/components/Documentation.tsx
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Alert, AlertDescription } from './ui/alert'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Terminal, Globe, Code, Layers, Filter, Zap } from 'lucide-react'

// For React developers using MCP with AI tools
function UsageGuidance() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-thin">
          <Code className="w-4 h-4" />
          Context Management for React Developers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-accent">
          <Zap className="w-4 h-4" />
          <AlertDescription>
            <strong>Target Audience:</strong> React developers who want AI context management as trivial to run as a linter.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-thin mb-2">What This Tool Does</h4>
            <div className="text-xs text-muted-foreground space-y-2">
              <div>• Creates focused code bundles for AI consumption (not copy-paste chaos)</div>
              <div>• Provides function-level semantic chunking with surgical precision</div>
              <div>• Acts as MCP server so AI agents access your codebase through APIs</div>
              <div>• Automatically organizes code by bundle membership and complexity</div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-thin mb-2">Quick Start</h4>
            <div className="text-xs text-muted-foreground space-y-2">
              <div>1. <strong>MCP Setup:</strong> <code className="bg-muted px-1 rounded">cntx-ui setup-mcp</code></div>
              <div>2. <strong>Create Bundles:</strong> Use Bundle Config tab to organize your code</div>
              <div>3. <strong>AI Access:</strong> Claude/Cursor connects via MCP automatically</div>
              <div>4. <strong>Semantic Analysis:</strong> View function-level chunks in Semantic Chunks tab</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Semantic chunking guide for power users
function SemanticFeaturesGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-thin">
          <Filter className="w-4 h-4" />
          Function-Level Semantic Chunking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-thin mb-2">Why Function-Level Chunks Matter</h4>
          <div className="text-xs text-muted-foreground space-y-2">
            <div>• <strong>Surgical precision:</strong> AI gets exactly the function it needs, not entire files</div>
            <div>• <strong>Context inclusion:</strong> Each chunk includes necessary imports and types</div>
            <div>• <strong>Bundle inheritance:</strong> Functions automatically grouped by bundle membership</div>
            <div>• <strong>Complexity analysis:</strong> Identify refactoring candidates with complexity scoring</div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-thin mb-2">Filtering & Organization</h4>
          <div className="text-xs text-muted-foreground space-y-2">
            <div>• <strong>By Bundle:</strong> See all frontend vs server functions</div>
            <div>• <strong>By Type:</strong> React components, hooks, arrow functions, methods</div>
            <div>• <strong>By Complexity:</strong> Find high-complexity functions needing refactoring</div>
            <div>• <strong>By Purpose:</strong> API handlers, validation, data processing</div>
          </div>
        </div>

        <div className="p-3 rounded border border-accent">
          <div className="text-xs">
            <strong>💡 Pro Tip:</strong> Large functions that don't fit in chunks signal refactoring opportunities.
            The tool nudges better code practices rather than working around bad ones.
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// MCP integration for AI tools
function MCPFeaturesGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-thin">
          <Globe className="w-4 h-4" />
          MCP Server Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-xs font-thin mb-2">How AI Agents Access Your Code</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>• <strong>Gated access:</strong> AI doesn't dump entire codebase, uses API navigation</div>
            <div>• <strong>Bundle-first approach:</strong> AI sees organized bundles before master bundle</div>
            <div>• <strong>Real-time updates:</strong> Changes immediately available to connected AI</div>
            <div>• <strong>Function-level precision:</strong> AI can request specific functions via semantic chunks</div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-thin mb-2">Available MCP Tools</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>• <code>list_bundles</code> - Show available bundle organization</div>
            <div>• <code>get_bundle</code> - Retrieve focused code bundles</div>
            <div>• <code>get_semantic_chunks</code> - Access function-level chunks</div>
            <div>• <code>get_file_tree</code> - Navigate project structure</div>
          </div>
        </div>

        <div className="bg-green-50 p-3 rounded border border-green-200">
          <div className="text-xs">
            <strong>🎯 Setup:</strong> Run <code className="bg-muted px-1 rounded">cntx-ui setup-mcp</code>
            and your AI tools (Claude Desktop, Cursor) will automatically connect.
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// AI-first workflow for React developers
function AIAssistedWorkflow() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-thin">
          <Layers className="w-4 h-4" />
          AI-Assisted Context Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-xs font-thin mb-2">How AI Navigates Your Code</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>• <strong>Gated access:</strong> AI doesn't see master bundle first - uses API navigation</div>
            <div>• <strong>Function-level precision:</strong> Requests specific functions via semantic chunks</div>
            <div>• <strong>Bundle discovery:</strong> Explores organized bundles before diving deep</div>
            <div>• <strong>Context control:</strong> You control what AI sees through bundle organization</div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-thin mb-2">AI Bundle Creation (Coming Soon)</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>• <strong>"Find all API stuff":</strong> AI analyzes semantic chunks and creates focused bundles</div>
            <div>• <strong>"Group React hooks":</strong> Intelligent pattern detection and organization</div>
            <div>• <strong>"Optimize bundles":</strong> AI suggests better organization based on code relationships</div>
            <div>• <strong>Smart maintenance:</strong> AI updates bundles as your code evolves</div>
          </div>
        </div>

        <div className="bg-green-50 p-3 rounded border border-green-200">
          <div className="text-xs">
            <strong>🎯 Philosophy:</strong> Context management as trivial as running a linter.
            AI handles the heavy lifting, you focus on building features.
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Simple CLI reference without overwhelming detail
function QuickCliReference() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-thin">
          <Terminal className="w-4 h-4" />
          Essential CLI Commands
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-thin mb-2">Most Used Commands</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <code className="bg-muted px-2 py-1 rounded text-xs font-mono">cntx-ui setup-mcp</code>
                <span className="text-xs text-muted-foreground">Setup MCP for AI tools</span>
              </div>
              <div className="flex items-center gap-3">
                <code className="bg-muted px-2 py-1 rounded text-xs font-mono">cntx-ui watch</code>
                <span className="text-xs text-muted-foreground">Start server (use web interface)</span>
              </div>
              <div className="flex items-center gap-3">
                <code className="bg-muted px-2 py-1 rounded text-xs font-mono">cntx-ui mcp</code>
                <span className="text-xs text-muted-foreground">Start MCP server only</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded border">
            <div className="text-xs text-muted-foreground">
              <strong>Recommendation:</strong> Use the web interface for bundle management.
              CLI is mainly for automation and MCP server startup.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function Documentation() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-thin tracking-tight">Help & Documentation</h1>
        <p className="text-xs text-muted-foreground font-thin">Usage guides and workflow instructions</p>
      </div>
      <Tabs defaultValue="usage-guidance" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-8">
          <TabsTrigger value="usage-guidance" className="text-xs">Usage Guidance</TabsTrigger>
          <TabsTrigger value="semantic-features" className="text-xs">Semantic Features</TabsTrigger>
          <TabsTrigger value="mcp-features" className="text-xs">MCP Features</TabsTrigger>
          <TabsTrigger value="ai-workflow" className="text-xs">AI Workflow</TabsTrigger>
          <TabsTrigger value="cli-reference" className="text-xs">CLI Reference</TabsTrigger>
        </TabsList>

        <TabsContent value="usage-guidance" className="mt-2">
          <UsageGuidance />
        </TabsContent>
        <TabsContent value="semantic-features" className="mt-2">
          <SemanticFeaturesGuide />
        </TabsContent>
        <TabsContent value="mcp-features" className="mt-2">
          <MCPFeaturesGuide />
        </TabsContent>
        <TabsContent value="ai-workflow" className="mt-2">
          <AIAssistedWorkflow />
        </TabsContent>
        <TabsContent value="cli-reference" className="mt-2">
          <QuickCliReference />
        </TabsContent>
      </Tabs>
    </div>
  )
}
