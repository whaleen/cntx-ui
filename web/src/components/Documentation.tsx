import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Terminal, Globe, Code2, Layers, Cpu, BrainCircuit, DatabaseZap, Search } from 'lucide-react'
import { Badge } from './ui/badge'

function Onboarding() {
  return (
    <Card className="border-vesper bg-vesper-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-thin color-vesper-fg">
          <Cpu className="w-4 h-4 text-vesper-accent" />
          Repository Intelligence LANDING
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h4 className="text-[11px] font-thin uppercase tracking-widest color-vesper-muted">Philosophy</h4>
          <p className="text-xs color-vesper-fg leading-relaxed">
            cntx-ui is an autonomous interface layer between your codebase and AI agents. It transforms raw files into surgical, semantic units of knowledge stored in a persistent local brain.
          </p>
        </div>

        <div className="space-y-4">
          <h4 className="text-[11px] font-thin uppercase tracking-widest color-vesper-muted">Quick Start</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { step: '1', title: 'Initialize', desc: 'cntx-ui init - Scaffolds the persistent SQLite brain.' },
              { step: '2', title: 'Intelligence', desc: 'cntx-ui watch - Starts real-time semantic analysis.' },
              { step: '3', title: 'Connect', desc: 'cntx-ui setup-mcp - Links your agents via .mcp.json.' },
              { step: '4', title: 'Collaborate', desc: 'Agents land in the repo and read .cntx/AGENT.md.' },
            ].map((item) => (
              <div key={item.step} className="p-3 border border-vesper/50 rounded bg-black/20">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="h-4 w-4 p-0 flex items-center justify-center text-[9px] border-vesper-accent color-vesper-accent">{item.step}</Badge>
                  <span className="text-[11px] font-bold color-vesper-fg">{item.title}</span>
                </div>
                <p className="text-[10px] color-vesper-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AgentIntelligenceGuide() {
  return (
    <Card className="border-vesper bg-vesper-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-thin color-vesper-fg">
          <BrainCircuit className="w-4 h-4 text-vesper-accent" />
          Surgical Semantic Context
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 color-vesper-accent">
              <DatabaseZap className="w-3 h-3" />
              <span className="text-[11px] uppercase tracking-tighter font-bold">Persistence</span>
            </div>
            <p className="text-[10px] color-vesper-muted">Embeddings and chunks are stored in SQLite (\`.cntx/bundles.db\`). Zero re-indexing on startup.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 color-vesper-accent">
              <Search className="w-3 h-3" />
              <span className="text-[11px] uppercase tracking-tighter font-bold">RAG Engine</span>
            </div>
            <p className="text-[10px] color-vesper-muted">Local vector search powered by Transformers.js allows agents to find code by meaning.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 color-vesper-accent">
              <Layers className="w-3 h-3" />
              <span className="text-[11px] uppercase tracking-tighter font-bold">Tree-sitter</span>
            </div>
            <p className="text-[10px] color-vesper-muted">True AST parsing extracts functions, types, and components with surgical precision.</p>
          </div>
        </div>

        <div className="pt-4 border-t border-vesper/30">
          <h4 className="text-[11px] font-thin uppercase tracking-widest color-vesper-muted mb-3">Primary Agent Tools</h4>
          <div className="space-y-2">
            {[
              { tool: 'agent/discover', desc: 'Comprehensive architectural overview and health check.' },
              { tool: 'agent/query', desc: 'Stateful semantic search across the entire persistent brain.' },
              { tool: 'agent/investigate', desc: 'Impact analysis and integration planning for new features.' },
              { tool: 'agent/organize', desc: 'Autonomous audit and optimization of codebase structure.' },
            ].map((t) => (
              <div key={t.tool} className="flex items-center gap-3 py-1 border-b border-vesper/20">
                <code className="text-[10px] color-vesper-accent font-mono w-32">{t.tool}</code>
                <span className="text-[10px] color-vesper-muted">{t.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CliReference() {
  return (
    <Card className="border-vesper bg-vesper-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-thin color-vesper-fg">
          <Terminal className="w-4 h-4 text-vesper-accent" />
          Terminal Interface
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[
            { cmd: 'cntx-ui init', desc: 'Mark current directory as context-aware.' },
            { cmd: 'cntx-ui watch', desc: 'Start intelligence engine & dashboard (default: 3333).' },
            { cmd: 'cntx-ui mcp', desc: 'Direct MCP server startup on stdio.' },
            { cmd: 'cntx-ui setup-mcp', desc: 'Automatic Claude Desktop configuration.' },
            { cmd: 'cntx-ui status', desc: 'View database health and bundle coverage.' },
          ].map((item) => (
            <div key={item.cmd} className="flex justify-between items-center py-2 border-b border-vesper/30">
              <code className="text-[11px] font-mono color-vesper-accent"> {item.cmd} </code>
              <span className="text-[10px] color-vesper-muted">{item.desc}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function Documentation() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-thin tracking-tight flex items-center gap-2">
          <Globe className="w-4 h-4 text-vesper-accent" />
          System Protocol
        </h1>
        <p className="text-xs text-muted-foreground font-thin">Intelligence architecture and workflow specifications</p>
      </header>

      <Tabs defaultValue="onboarding" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-black/20 p-1 border border-vesper h-9 mb-6">
          <TabsTrigger value="onboarding" className="text-[10px] uppercase tracking-widest font-thin">Onboarding</TabsTrigger>
          <TabsTrigger value="intelligence" className="text-[10px] uppercase tracking-widest font-thin">Intelligence</TabsTrigger>
          <TabsTrigger value="cli" className="text-[10px] uppercase tracking-widest font-thin">CLI Reference</TabsTrigger>
        </TabsList>

        <TabsContent value="onboarding" className="m-0"><Onboarding /></TabsContent>
        <TabsContent value="intelligence" className="m-0"><AgentIntelligenceGuide /></TabsContent>
        <TabsContent value="cli" className="m-0"><CliReference /></TabsContent>
      </Tabs>
    </div>
  )
}
