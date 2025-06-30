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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-warning text-sm font-medium">
          <AlertTriangle className="w-3 h-3" />
          Files Needing Bundle Assignment ({undercategorizedFiles.length})
        </CardTitle>
        <p className="text-xs text-muted-foreground font-thin">
          These files are only in the 'master' bundle and should be assigned to more specific bundles for better organization.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1 max-h-80 overflow-y-auto">
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

        <div className="flex justify-between items-center pt-3 mt-3 border-t border-warning/20">
          <span className="text-xs text-muted-foreground">
            {undercategorizedFiles.length} files need better bundle assignment
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={loadFileAnalysis}
            className="h-6 px-2 text-xs"
          >
            <RefreshCw className="w-2.5 h-2.5 mr-1" />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default FileAnalysis 
