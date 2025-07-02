import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Database, Play, RefreshCw } from 'lucide-react';

interface QueryResult {
  error?: string;
  results?: any[];
}

interface DatabaseInfo {
  path?: string;
  bundleCount?: number;
  sizeFormatted?: string;
  error?: string;
}

export function DatabaseViewer() {
  const [query, setQuery] = useState('SELECT name, file_count, size, generated_at FROM bundles ORDER BY name;');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);

  // Predefined useful queries
  const sampleQueries = [
    {
      name: 'All Bundles',
      sql: 'SELECT name, file_count, size, generated_at FROM bundles ORDER BY name;'
    },
    {
      name: 'Large Bundles',
      sql: 'SELECT name, file_count, size FROM bundles WHERE file_count > 5 ORDER BY size DESC;'
    },
    {
      name: 'Recent Activity',
      sql: 'SELECT name, generated_at FROM bundles WHERE generated_at IS NOT NULL ORDER BY generated_at DESC LIMIT 10;'
    },
    {
      name: 'Bundle Statistics',
      sql: 'SELECT COUNT(*) as total_bundles, SUM(file_count) as total_files, SUM(size) as total_size FROM bundles;'
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
      console.error('Failed to fetch database info:', error);
      setDbInfo({ error: 'Failed to load database info' });
    }
  };

  const executeQuery = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/database/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      executeQuery();
    }
  };

  return (
    <div className="space-y-6">
      {/* Database Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            SQLite Database
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dbInfo ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Bundles:</span> {dbInfo.bundleCount || 0}
              </div>
              <div>
                <span className="font-medium">Size:</span> {dbInfo.sizeFormatted || 'Unknown'}
              </div>
              <div className="col-span-2">
                <span className="font-medium">Path:</span> 
                <span className="font-mono text-xs ml-2">{dbInfo.path || 'Unknown'}</span>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">Loading database info...</div>
          )}
        </CardContent>
      </Card>

      {/* Query Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>SQL Query</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your SQL query..."
                className="font-mono text-sm min-h-[120px]"
              />
              <div className="flex justify-between items-center">
                <div className="text-xs text-muted-foreground">
                  Press Ctrl/Cmd + Enter to execute
                </div>
                <Button 
                  onClick={executeQuery} 
                  disabled={isLoading || !query.trim()}
                  className="flex items-center gap-2"
                >
                  {isLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Execute
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Sample Queries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sampleQueries.map((sample, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-left h-auto p-3"
                  onClick={() => setQuery(sample.sql)}
                >
                  <div>
                    <div className="font-medium">{sample.name}</div>
                    <div className="text-xs text-muted-foreground mt-1 font-mono">
                      {sample.sql.substring(0, 40)}...
                    </div>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Query Results */}
      {queryResult && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            {queryResult.error ? (
              <div className="text-red-500 font-mono text-sm bg-red-50 dark:bg-red-950/20 p-4 rounded">
                Error: {queryResult.error}
              </div>
            ) : queryResult.results ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {queryResult.results.length} rows
                  </Badge>
                </div>
                
                {queryResult.results.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-border text-sm">
                      <thead>
                        <tr className="bg-muted">
                          {Object.keys(queryResult.results[0]).map((key) => (
                            <th key={key} className="border border-border p-2 text-left font-medium">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.results.map((row, index) => (
                          <tr key={index} className="hover:bg-muted/50">
                            {Object.values(row).map((value, cellIndex) => (
                              <td key={cellIndex} className="border border-border p-2 font-mono text-xs">
                                {value === null ? (
                                  <span className="text-muted-foreground italic">null</span>
                                ) : typeof value === 'string' && value.length > 50 ? (
                                  <span title={value}>{value.substring(0, 47)}...</span>
                                ) : (
                                  String(value)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-center py-8">
                    Query executed successfully, but returned no results.
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}