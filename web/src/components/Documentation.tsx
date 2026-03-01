import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Terminal, Globe, Layers, Cpu, DatabaseZap, Search } from 'lucide-react'

function Onboarding() {
  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm  text-foreground">
          <Cpu className="w-4 h-4 text-primary" />
          Getting Started
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h4 className="text-[11px]  uppercase tracking-widest text-muted-foreground">What is cntx-ui?</h4>
          <p className="text-xs text-foreground leading-relaxed">
            cntx-ui bundles your project files into organized context packages for LLMs. It parses code with tree-sitter, generates semantic embeddings, and exposes everything via MCP so AI tools can understand your codebase.
          </p>
        </div>

        <div className="space-y-4">
          <h4 className="text-[11px]  uppercase tracking-widest text-muted-foreground">Quick Start</h4>
          <div className="p-3 border border-border/50 rounded bg-black/20">
            <p className="text-[11px] text-foreground font-mono mb-2">$ cntx-ui</p>
            <p className="text-[10px] text-muted-foreground">
              That's it. Run <code className="text-primary">cntx-ui</code> in your project directory. It auto-initializes if needed and starts the web server at <code className="text-primary">http://localhost:3333</code>.
            </p>
          </div>
          <div className="p-3 border border-border/50 rounded bg-black/20">
            <p className="text-[10px] text-muted-foreground">
              A <code className="text-primary">.mcp.json</code> file is created automatically so Claude Code can discover the MCP server. No extra setup needed.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function IntelligenceGuide() {
  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm  text-foreground">
          <DatabaseZap className="w-4 h-4 text-primary" />
          How It Works
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <DatabaseZap className="w-3 h-3" />
              <span className="text-[11px] uppercase tracking-tighter font-bold">Persistence</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Embeddings and chunks are stored in SQLite (<code>.cntx/bundles.db</code>). Zero re-indexing on startup.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <Search className="w-3 h-3" />
              <span className="text-[11px] uppercase tracking-tighter font-bold">RAG Engine</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Local vector search powered by Transformers.js. MCP tools can search your code by meaning, not just keywords.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <Layers className="w-3 h-3" />
              <span className="text-[11px] uppercase tracking-tighter font-bold">Tree-sitter</span>
            </div>
            <p className="text-[10px] text-muted-foreground">AST parsing extracts functions, types, and components at the syntax level for precise code understanding.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CliReference() {
  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm  text-foreground">
          <Terminal className="w-4 h-4 text-primary" />
          CLI Reference
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[
            { cmd: 'cntx-ui', desc: 'Auto-init if needed, then start the web server (default: 3333).' },
            { cmd: 'cntx-ui init', desc: 'Initialize configuration in the current directory.' },
            { cmd: 'cntx-ui mcp', desc: 'Start MCP server on stdio for agent integrations.' },
            { cmd: 'cntx-ui bundle [name]', desc: 'Generate a specific bundle (default: master).' },
            { cmd: 'cntx-ui status', desc: 'Show project status and bundle info.' },
          ].map((item) => (
            <div key={item.cmd} className="flex justify-between items-center py-2 border-b border-border/30">
              <code className="text-[11px] font-mono text-primary"> {item.cmd} </code>
              <span className="text-[10px] text-muted-foreground">{item.desc}</span>
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
        <h1 className="text-lg  tracking-tight flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          Help & Documentation
        </h1>
        <p className="text-xs text-muted-foreground ">How cntx-ui works and CLI reference</p>
      </header>

      <Tabs defaultValue="onboarding" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-black/20 p-1 border border-border h-9 mb-6">
          <TabsTrigger value="onboarding" className="text-[10px] uppercase tracking-widest ">Onboarding</TabsTrigger>
          <TabsTrigger value="intelligence" className="text-[10px] uppercase tracking-widest ">How It Works</TabsTrigger>
          <TabsTrigger value="cli" className="text-[10px] uppercase tracking-widest ">CLI Reference</TabsTrigger>
        </TabsList>

        <TabsContent value="onboarding" className="m-0"><Onboarding /></TabsContent>
        <TabsContent value="intelligence" className="m-0"><IntelligenceGuide /></TabsContent>
        <TabsContent value="cli" className="m-0"><CliReference /></TabsContent>
      </Tabs>
    </div>
  )
}
