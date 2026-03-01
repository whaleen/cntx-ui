import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Database, Play, RefreshCw, Table, Fingerprint, BrainCircuit } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { useTheme } from 'next-themes';

interface QueryResult {
  error?: string;
  results?: any[];
}

interface DatabaseInfo {
  path?: string;
  bundleCount?: number;
  chunkCount?: number;
  embeddingCount?: number;
  sessionCount?: number;
  sizeFormatted?: string;
  error?: string;
}

export function DatabaseViewer() {
  const [query, setQuery] = useState('SELECT name, purpose, complexity_score FROM semantic_chunks ORDER BY complexity_score DESC LIMIT 10;');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const { theme } = useTheme();

  const sampleQueries = [
    {
      name: 'Top Chunks by Complexity',
      sql: 'SELECT name, purpose, complexity_score, file_path FROM semantic_chunks ORDER BY complexity_score DESC LIMIT 10;'
    },
    {
      name: 'Chunks by Purpose',
      sql: 'SELECT purpose, COUNT(*) as count FROM semantic_chunks GROUP BY purpose ORDER BY count DESC;'
    },
    {
      name: 'Agent Interaction History',
      sql: 'SELECT role, content, timestamp FROM agent_memory ORDER BY timestamp DESC LIMIT 20;'
    },
    {
      name: 'Vector Embedding Stats',
      sql: 'SELECT model_name, COUNT(*) as count FROM vector_embeddings GROUP BY model_name;'
    },
    {
      name: 'Unassigned Chunks',
      sql: "SELECT name, file_path FROM semantic_chunks WHERE purpose = 'Utility function' LIMIT 10;"
    }
  ];

  useEffect(() => {
    fetchDatabaseInfo();
  }, []);

  const fetchDatabaseInfo = async () => {
    try {
      const response = await fetch('/api/database/info');
      const info = await response.json();
      setDbInfo(info);
    } catch (error) {
      setDbInfo({ error: 'Failed to load database info' });
    }
  };

  const executeQuery = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/database/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      const result = await response.json();
      setQueryResult(result);
    } catch (error) {
      setQueryResult({ error: 'Failed to execute query' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg  tracking-tight flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            Persistent Intelligence Explorer
          </h1>
          <p className="text-xs text-muted-foreground ">Querying the project's persistent brain</p>
        </div>
        {dbInfo && (
          <div className="flex gap-2">
            <Badge variant="outline" className="border-border  text-[9px] uppercase tracking-widest">
              {dbInfo.chunkCount} Chunks
            </Badge>
            <Badge variant="outline" className="border-border  text-[9px] uppercase tracking-widest">
              {dbInfo.embeddingCount} Vectors
            </Badge>
            <Badge variant="outline" className="border-border  text-[9px] uppercase tracking-widest">
              {dbInfo.sizeFormatted}
            </Badge>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs  uppercase tracking-widest text-muted-foreground">SQL Interface</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div 
                className="rounded-md border border-input overflow-hidden text-xs"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    executeQuery();
                  }
                }}
              >
                <CodeMirror
                  value={query}
                  height="200px"
                  theme={theme === 'dark' ? 'dark' : 'light'}
                  extensions={[sql()]}
                  onChange={(value) => setQuery(value)}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    dropCursor: true,
                    allowMultipleSelections: false,
                    indentOnInput: true,
                  }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground italic">⌘ + Enter to execute</span>
                <Button onClick={executeQuery} disabled={isLoading} size="sm" className="h-8">
                  {isLoading ? <RefreshCw className="w-3 h-3 animate-spin mr-2" /> : <Play className="w-3 h-3 mr-2" />}
                  Execute Query
                </Button>
              </div>
            </CardContent>
          </Card>

          {queryResult && (
            <Card className="border-border bg-card overflow-hidden">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs  uppercase tracking-widest text-muted-foreground">Results</CardTitle>
                  {queryResult.results && (
                    <Badge variant="outline" className="text-[9px] border-border">{queryResult.results.length} rows</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {queryResult.error ? (
                  <div className="p-4 text-xs font-mono text-red-400 bg-red-950/10">{queryResult.error}</div>
                ) : queryResult.results && queryResult.results.length > 0 ? (
                  <div className="overflow-auto max-h-[400px]">
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-black/40 text-left text-muted-foreground border-b border-border">
                          {Object.keys(queryResult.results[0]).map((key) => (
                            <th key={key} className="p-2  uppercase tracking-tighter">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.results.map((row, i) => (
                          <tr key={i} className="border-b border-border/30 hover:bg-white/5">
                            {Object.values(row).map((val: any, j) => (
                              <td key={j} className="p-2 text-foreground font-mono max-w-[200px] truncate">
                                {val === null ? <span className="opacity-30">null</span> : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground italic">No results returned</div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-xs  uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Table className="w-3 h-3" />
                Schema Explorer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {['semantic_chunks', 'vector_embeddings', 'agent_memory', 'agent_sessions', 'bundles'].map(table => (
                <div key={table} className="flex items-center justify-between p-2 rounded bg-black/20 border border-border/50 group hover:border-border-accent cursor-pointer"
                     onClick={() => setQuery(`SELECT * FROM ${table} LIMIT 10;`)}>
                  <span className="text-[11px] font-mono text-foreground">{table}</span>
                  <Badge variant="outline" className="text-[8px] opacity-0 group-hover:opacity-100 transition-opacity">Select</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-xs  uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <BrainCircuit className="w-3 h-3" />
                Intelligence Queries
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sampleQueries.map((sample, i) => (
                <Button key={i} variant="ghost" className="w-full justify-start text-left h-auto p-2 hover:bg-white/5 border border-transparent hover:border-border"
                        onClick={() => { setQuery(sample.sql); executeQuery(); }}>
                  <div>
                    <div className="text-[11px] text-primary font-bold">{sample.name}</div>
                    <div className="text-[9px] text-muted-foreground truncate max-w-[180px]">{sample.sql}</div>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
