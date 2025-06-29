import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { FileAnalysisProps } from './types'
import { UndercategorizedFileRow } from './UndercategorizedFileRow'

const FileAnalysis: React.FC<FileAnalysisProps> = ({
  undercategorizedFiles,
  bundles,
  addFileToBundle,
  loadFileAnalysis,
  loadingButtons,
  setButtonState,
  onRemoveFile,
  fileSizes
}) => {
  if (undercategorizedFiles.length === 0) {
    return null
  }

  return (
    <Card className="border-warning/20 bg-warning/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning">
          <AlertTriangle className="w-4 h-4" />
          Files Needing Bundle Assignment ({undercategorizedFiles.length})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          These files are only in the 'master' bundle and should be assigned to more specific bundles for better organization.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {undercategorizedFiles.map((fileInfo) => (
            <UndercategorizedFileRow
              key={fileInfo.path}
              fileInfo={fileInfo}
              bundles={bundles}
              addFileToBundle={addFileToBundle}
              loadFileAnalysis={loadFileAnalysis}
              loadingButtons={loadingButtons}
              setButtonState={setButtonState}
              onRemove={onRemoveFile}
              fileSizes={fileSizes}
            />
          ))}
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-warning/20">
          <span className="text-sm text-muted-foreground">
            {undercategorizedFiles.length} files need better bundle assignment
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={loadFileAnalysis}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh Analysis
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default FileAnalysis 
