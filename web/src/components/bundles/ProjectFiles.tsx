import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { TreePine } from 'lucide-react'
import { FileTree } from '../FileTree'

const ProjectFiles: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TreePine className="w-4 h-4" />
          Project Files
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Browse and explore all files in your project with bundle information.
        </p>
      </CardHeader>
      <CardContent>
        <FileTree />
      </CardContent>
    </Card>
  )
}

export default ProjectFiles 
