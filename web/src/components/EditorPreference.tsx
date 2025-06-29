import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { toast } from '@/lib/toast'
import { Save, Settings } from 'lucide-react'

// API functions
const fetchConfig = async (): Promise<any> => {
  const response = await fetch('http://localhost:3333/api/config')
  if (!response.ok) throw new Error('Failed to fetch config')
  return response.json()
}

const saveConfig = async (config: any) => {
  const response = await fetch('http://localhost:3333/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  })
  if (!response.ok) throw new Error('Failed to save config')
  return response.json()
}

export function EditorPreference() {
  const queryClient = useQueryClient()
  const [editor, setEditor] = useState('code')
  const [customEditor, setCustomEditor] = useState('')

  const { data: config, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig
  })

  useEffect(() => {
    if (config?.editor) {
      if (['code', 'subl', 'system'].includes(config.editor)) {
        setEditor(config.editor)
      } else {
        setEditor('custom')
        setCustomEditor(config.editor)
      }
    }
  }, [config])

  const mutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] })
      toast.success('Editor preference saved')
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`)
    }
  })

  const handleSave = () => {
    const newEditor = editor === 'custom' ? customEditor : editor
    const newConfig = { ...config, editor: newEditor }
    mutation.mutate(newConfig)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-thin">
          <Settings className="w-4 h-4" />
          Editor Preference
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="editor-select">Select your preferred editor</Label>
          <Select value={editor} onValueChange={setEditor}>
            <SelectTrigger id="editor-select">
              <SelectValue placeholder="Select an editor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="code">Visual Studio Code</SelectItem>
              <SelectItem value="subl">Sublime Text</SelectItem>
              <SelectItem value="system">System Default</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {editor === 'custom' && (
          <div className="space-y-2">
            <Label htmlFor="custom-editor-input">Custom editor command</Label>
            <Input
              id="custom-editor-input"
              value={customEditor}
              onChange={(e) => setCustomEditor(e.target.value)}
              placeholder="e.g., atom -w"
            />
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={mutation.isPending} size="sm" className="h-7 text-xs">
            <Save className="w-3 h-3 mr-1" />
            {mutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
