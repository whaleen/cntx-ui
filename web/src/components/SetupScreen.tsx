import { useState } from 'react'
import { CheckCircle, Circle, Copy, Monitor, FolderOpen, Settings, ArrowRight, ExternalLink, AlertTriangle, Play, Sparkles, Eye, Zap, Download } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface SetupStep {
  id: string
  title: string
  description: string
  completed: boolean
  required: boolean
}

export default function SetupScreen() {
  const [currentStep, setCurrentStep] = useState(0)
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>([
    {
      id: 'welcome',
      title: 'Welcome to cntx-ui',
      description: 'Organize your code into focused bundles for AI assistance',
      completed: false,
      required: true
    },
    {
      id: 'bundles',
      title: 'Create Your First Bundles',
      description: 'Set up focused file collections and learn the basics',
      completed: false,
      required: true
    },
    {
      id: 'ai-analysis',
      title: 'AI Bundle Analysis (Optional)',
      description: 'Let AI analyze your code and suggest optimal bundles',
      completed: false,
      required: false
    },
    {
      id: 'mcp-integration',
      title: 'MCP Integration (Enhanced)',
      description: 'Set up seamless AI integration with Claude Desktop',
      completed: false,
      required: false
    },
    {
      id: 'workflows',
      title: 'Choose Your Workflow',
      description: 'Manual copy/paste or seamless MCP integration',
      completed: false,
      required: false
    }
  ])

  const [aiPromptCopied, setAiPromptCopied] = useState(false)
  const [masterBundleCopied, setMasterBundleCopied] = useState(false)

  const copyAiPrompt = async () => {
    const prompt = `Analyze this codebase bundle and suggest an optimal bundle configuration for cntx-ui.

Based on the file structure and content, recommend 3-6 meaningful bundles with glob patterns that group related files logically.

Consider these common bundle types:
- Frontend/UI components and pages
- Backend API routes and controllers  
- Configuration files
- Documentation
- Tests
- Utilities/helpers
- Styles/assets

Return ONLY a JSON configuration in this exact format:
{
  "bundles": {
    "master": ["**/*"],
    "frontend": ["src/components/**/*", "src/pages/**/*", "src/hooks/**/*"],
    "api": ["src/api/**/*", "routes/**/*", "controllers/**/*"],
    "config": ["*.config.*", "package.json", "tsconfig.json"],
    "docs": ["README.md", "docs/**/*", "*.md"],
    "tests": ["**/*.test.*", "**/*.spec.*", "__tests__/**/*"]
  }
}

Please analyze the following master bundle and suggest appropriate bundles:

[PASTE YOUR MASTER BUNDLE XML CONTENT HERE]`

    try {
      await navigator.clipboard.writeText(prompt)
      setAiPromptCopied(true)
      setTimeout(() => setAiPromptCopied(false), 3000)
    } catch (err) {
      console.error('Failed to copy AI prompt:', err)
    }
  }

  const copyMasterBundle = async () => {
    try {
      const response = await fetch('http://localhost:3333/api/bundles/master')
      if (!response.ok) throw new Error('Failed to fetch master bundle')

      const xmlContent = await response.text()
      await navigator.clipboard.writeText(xmlContent)
      setMasterBundleCopied(true)
      setTimeout(() => setMasterBundleCopied(false), 3000)
    } catch (err) {
      console.error('Failed to copy master bundle:', err)
    }
  }

  const downloadMasterBundle = async () => {
    try {
      const response = await fetch('http://localhost:3333/api/bundles/master')
      if (!response.ok) throw new Error('Failed to fetch master bundle')

      const xmlContent = await response.text()
      const blob = new Blob([xmlContent], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'master-bundle.xml'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download master bundle:', err)
    }
  }

  const markStepComplete = (stepId: string) => {
    setSetupSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, completed: true } : step
    ))
  }

  const StepIndicator = ({ step, isActive }: { step: SetupStep, isActive: boolean }) => (
    <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive ? 'bg-accent border border-border' : 'hover:bg-muted/50'
      }`}>
      <div className="flex-shrink-0">
        {step.completed ? (
          <CheckCircle className="w-6 h-6 text-green-500" />
        ) : (
          <Circle className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className={`font-medium ${isActive ? 'text-foreground' : 'text-foreground'}`}>
            {step.title}
          </h3>
          {step.required && (
            <Badge variant="outline" className="text-xs">Required</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{step.description}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-thin text-foreground mb-2">Welcome to cntx-ui</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            You're already up and running! Let's explore what you can do with the web interface.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* Steps Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Quick Tour
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {setupSteps.map((step, index) => (
                  <div
                    key={step.id}
                    onClick={() => setCurrentStep(index)}
                    className="cursor-pointer"
                  >
                    <StepIndicator step={step} isActive={currentStep === index} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Welcome */}
            {currentStep === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Welcome to cntx-ui
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="w-4 h-4" />
                    <AlertDescription>
                      <strong>You're all set!</strong> cntx-ui is running and ready to organize your code for AI assistance.
                      Start with basic bundle management, then optionally enhance with seamless AI integration.
                    </AlertDescription>
                  </Alert>

                  <div className="bg-accent/50 p-4 rounded-lg border">
                    <h4 className="font-medium text-foreground mb-2">What is cntx-ui?</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      cntx-ui organizes your codebase into focused bundles for AI development.
                      Create meaningful file collections, copy them to AI tools, or use advanced MCP integration for seamless workflows.
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>• Bundle files by purpose or feature</div>
                      <div>• Hide irrelevant files from AI context</div>
                      <div>• Copy bundles to any AI tool</div>
                      <div>• Optional seamless AI integration</div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <Card className="border-border">
                      <CardContent className="pt-6">
                        <Monitor className="w-8 h-8 text-primary mb-3" />
                        <h3 className="font-medium mb-2">Core Experience</h3>
                        <p className="text-sm text-muted-foreground">
                          Organize bundles in the web interface, copy XML to Claude, ChatGPT, or any AI tool.
                        </p>
                        <Badge variant="outline" className="mt-2">Works everywhere</Badge>
                      </CardContent>
                    </Card>

                    <Card className="border-border">
                      <CardContent className="pt-6">
                        <Zap className="w-8 h-8 text-primary mb-3" />
                        <h3 className="font-medium mb-2">Enhanced Experience</h3>
                        <p className="text-sm text-muted-foreground">
                          Optional MCP server integration for seamless access in Claude Desktop and other MCP clients.
                        </p>
                        <Badge variant="outline" className="mt-2">Progressive enhancement</Badge>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" disabled>Previous</Button>
                    <Button onClick={() => { markStepComplete('welcome'); setCurrentStep(1); }}>
                      Create Your First Bundles <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Create Bundles */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="w-5 h-5" />
                    Create Your First Bundles
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <p className="text-muted-foreground mb-4">
                      cntx-ui starts with a "master" bundle containing all your files. Let's explore the basics
                      and learn how to create focused bundles for better AI assistance.
                    </p>

                    <Alert className="border-border bg-accent/50">
                      <FolderOpen className="w-4 h-4" />
                      <AlertDescription>
                        <strong>✅ You're ready to go!</strong> cntx-ui has already created a master bundle with all your project files.
                        Now let's organize them into meaningful collections.
                      </AlertDescription>
                    </Alert>
                  </div>

                  <div className="bg-accent/50 p-4 rounded-lg border">
                    <h4 className="font-medium text-foreground mb-3">Here's the workflow:</h4>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                      <li><strong>Copy the AI analysis prompt</strong> (button below)</li>
                      <li><strong>Go to Bundles tab</strong> → Copy the "master" bundle XML</li>
                      <li><strong>Open Claude/ChatGPT</strong> → Paste the prompt</li>
                      <li><strong>Paste your master bundle XML</strong> after the prompt</li>
                      <li><strong>AI returns perfect bundle JSON</strong> tailored to your code!</li>
                      <li><strong>Go to Config tab</strong> → Paste the JSON → Apply!</li>
                    </ol>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Step 1: Copy AI Prompt & Master Bundle</h4>
                    <div className="space-y-3">
                      <div className="bg-card border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-primary text-sm">🤖 Smart Bundle Analysis Prompt</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={copyAiPrompt}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {aiPromptCopied ? (
                              <>
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4 mr-1" />
                                Copy Prompt
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="text-muted-foreground text-sm">
                          Intelligent prompt that guides AI to analyze your code structure
                        </div>
                      </div>

                      <div className="bg-card border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-primary text-sm">📦 Master Bundle XML</span>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={copyMasterBundle}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {masterBundleCopied ? (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4 mr-1" />
                                  Copy XML
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={downloadMasterBundle}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>
                        <div className="text-muted-foreground text-sm">
                          Your complete codebase bundle for AI analysis
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-accent/50 p-4 rounded-lg border">
                    <h4 className="font-medium text-foreground mb-2">🚀 Complete AI Workflow:</h4>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li><strong>Copy the prompt above</strong> → Paste into Claude/ChatGPT</li>
                      <li><strong>Copy/download master bundle</strong> → Add to your AI conversation</li>
                      <li><strong>AI analyzes your code</strong> → Returns perfect bundle configuration</li>
                      <li><strong>Go to Config tab</strong> → Paste AI's JSON → Apply configuration</li>
                      <li><strong>🎉 Optimized bundles ready!</strong> → Tailored to your project structure</li>
                    </ol>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="font-medium">What AI Analyzes:</h4>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <div>🗂️ <strong>File organization patterns</strong></div>
                        <div>🔗 <strong>Import/dependency relationships</strong></div>
                        <div>⚙️ <strong>Technology stack detection</strong></div>
                        <div>📁 <strong>Logical grouping opportunities</strong></div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-medium">AI Suggests Bundles Like:</h4>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <div>🎨 <strong>frontend</strong> - Components, pages, styles</div>
                        <div>🔌 <strong>api</strong> - Routes, controllers, models</div>
                        <div>🧪 <strong>tests</strong> - All test files</div>
                        <div>⚙️ <strong>config</strong> - Configuration files</div>
                      </div>
                    </div>
                  </div>

                  <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      <strong>Why this works so well:</strong> AI understands code patterns and can see relationships
                      between files that aren't obvious. It creates bundles that actually make sense for your specific project.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep(0)}>Previous</Button>
                    <Button onClick={() => { markStepComplete('ai-analysis'); setCurrentStep(2); }}>
                      Continue to Bundle Management <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Create/Manage Bundles */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="w-5 h-5" />
                    Create & Manage Your Bundles
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <p className="text-muted-foreground mb-4">
                      Whether you used AI suggestions or want to create bundles manually,
                      here's how to manage your bundle collection.
                    </p>

                    <div className="bg-accent/50 p-4 rounded-lg border mb-4">
                      <h4 className="font-medium text-foreground mb-2">If you used AI analysis:</h4>
                      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Go to the <strong>Config</strong> tab above</li>
                        <li>Scroll to <strong>"Paste Bundle Configuration"</strong></li>
                        <li>Paste the AI-generated JSON</li>
                        <li>Click <strong>"Apply Configuration"</strong></li>
                        <li>🎉 Your optimized bundles are ready!</li>
                      </ol>
                    </div>

                    <div className="bg-accent/50 p-4 rounded-lg border mb-4">
                      <h4 className="font-medium text-foreground mb-2">To create bundles manually:</h4>
                      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Go to the <strong>Config</strong> tab above</li>
                        <li>Click <strong>"Add New Bundle"</strong> at the bottom</li>
                        <li>Name it something meaningful (e.g., "frontend", "api", "core")</li>
                        <li>Add patterns like <code className="bg-muted px-1 rounded">src/components/**/*</code></li>
                        <li>Click <strong>"Create Bundle"</strong></li>
                      </ol>
                    </div>

                    <Alert>
                      <Sparkles className="w-4 h-4" />
                      <AlertDescription>
                        <strong>Pro tip:</strong> You can test patterns before adding them!
                        Use the "Pattern Tester" in the Config tab to see which files match.
                      </AlertDescription>
                    </Alert>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium">Popular Manual Bundle Examples:</h4>
                    <div className="grid gap-3">
                      <div className="bg-muted/50 p-3 rounded-md border">
                        <div className="font-medium text-sm">Frontend Bundle</div>
                        <code className="text-xs text-muted-foreground">src/components/**/* • src/pages/**/* • *.css</code>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-md border">
                        <div className="font-medium text-sm">API Bundle</div>
                        <code className="text-xs text-muted-foreground">src/api/**/* • src/routes/**/* • src/models/**/*</code>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-md border">
                        <div className="font-medium text-sm">Tests Bundle</div>
                        <code className="text-xs text-muted-foreground">**/*.test.* • **/*.spec.* • __tests__/**/*</code>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep(1)}>Previous</Button>
                    <Button onClick={() => { markStepComplete('bundles'); setCurrentStep(3); }}>
                      Continue to Optimization <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Optimization */}
            {currentStep === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Optimize for AI Development
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <p className="text-muted-foreground mb-4">
                      Now let's make your bundles perfect for AI assistants by controlling what they see.
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                      <Card className="border-border">
                        <CardContent className="pt-6">
                          <Eye className="w-8 h-8 text-primary mb-3" />
                          <h3 className="font-medium mb-2">Hidden Files Tab</h3>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>• Hide debug files from AI context</div>
                            <div>• Remove temp/generated files</div>
                            <div>• Create clean, focused bundles</div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-border">
                        <CardContent className="pt-6">
                          <Sparkles className="w-8 h-8 text-primary mb-3" />
                          <h3 className="font-medium mb-2">Cursor Rules Tab</h3>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>• Set coding standards</div>
                            <div>• Define project context</div>
                            <div>• Guide AI assistant behavior</div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  <div className="bg-accent/50 p-4 rounded-lg border">
                    <h4 className="font-medium text-foreground mb-2">Try this workflow:</h4>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Go to <strong>Hidden Files</strong> tab</li>
                      <li>Search for "debug" or "test" files</li>
                      <li>Hide them from your main bundles</li>
                      <li>Go to <strong>Cursor Rules</strong> tab</li>
                      <li>Choose a template that matches your project</li>
                      <li>Customize the rules for your team's preferences</li>
                    </ol>
                  </div>

                  <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      <strong>Why this matters:</strong> Clean bundles = better AI responses.
                      Removing noise helps AI focus on what's actually important in your code.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep(2)}>Previous</Button>
                    <Button onClick={() => { markStepComplete('optimization'); setCurrentStep(4); }}>
                      Continue <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 5: Workflows */}
            {currentStep === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="w-5 h-5" />
                    Common Workflows & Next Steps
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4">
                    <div className="bg-accent/50 p-4 rounded-lg border">
                      <h4 className="font-medium text-foreground mb-2">🤖 Using with AI Assistants</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>1. Create a focused bundle for your current task</div>
                        <div>2. Copy the XML from the <strong>Bundles</strong> tab</div>
                        <div>3. Paste into Claude, ChatGPT, or other AI tools</div>
                        <div>4. Get more accurate, context-aware responses</div>
                      </div>
                    </div>

                    <div className="bg-accent/50 p-4 rounded-lg border">
                      <h4 className="font-medium text-foreground mb-2">📁 Organizing Large Projects</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>1. Create bundles by feature or team responsibility</div>
                        <div>2. Use hidden files to exclude work-in-progress code</div>
                        <div>3. Monitor bundle sizes in the web interface</div>
                        <div>4. Share specific bundles with team members</div>
                      </div>
                    </div>

                    <div className="bg-accent/50 p-4 rounded-lg border">
                      <h4 className="font-medium text-foreground mb-2">⚡ Advanced Tips</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>• Bundle-specific hiding: Hide files from specific bundles only</div>
                        <div>• Pattern testing: Use the pattern tester in Config tab</div>
                        <div>• Real-time updates: Changes appear immediately</div>
                        <div>• CLI integration: Use commands for automation</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-accent/50 p-4 rounded-lg border">
                    <h4 className="font-medium text-foreground mb-2">🎯 Quick Start Checklist</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>✅ Create 2-3 focused bundles</div>
                      <div>✅ Hide debug/temp files</div>
                      <div>✅ Set up cursor rules</div>
                      <div>✅ Copy a bundle and try it with an AI assistant</div>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep(3)}>Previous</Button>
                    <Button onClick={() => markStepComplete('workflows')} className="bg-primary hover:bg-primary/90">
                      Get Started! <ExternalLink className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Reference Card */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Reference</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-2">Web Interface Tabs</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li><strong>Bundles</strong> - View and copy bundle content</li>
                      <li><strong>Files</strong> - Browse your project files</li>
                      <li><strong>Config</strong> - Create and edit bundles</li>
                      <li><strong>Hidden</strong> - Control file visibility</li>
                      <li><strong>Cursor</strong> - Manage AI assistant rules</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Key Features</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>Real-time file watching and updates</li>
                      <li>Bundle-specific file hiding</li>
                      <li>Pattern testing and validation</li>
                      <li>AI assistant context management</li>
                      <li>XML export for AI tools</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
