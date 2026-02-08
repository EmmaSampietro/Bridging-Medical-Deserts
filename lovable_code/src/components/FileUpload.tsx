import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (content: string) => void;
  isLoading?: boolean;
  error?: string;
  className?: string;
}

export function FileUpload({ onFileSelect, isLoading, error, className }: FileUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      onFileSelect(content);
    };
    
    reader.readAsText(file);
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    multiple: false,
    disabled: isLoading,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'relative cursor-pointer rounded-xl border-2 border-dashed p-8 transition-all duration-300',
        'hover:border-accent/50 hover:bg-accent/5',
        isDragActive && 'border-accent bg-accent/10',
        isDragAccept && 'border-success bg-success/10',
        isDragReject && 'border-destructive bg-destructive/10',
        error && 'border-destructive/50',
        isLoading && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <input {...getInputProps()} />
      
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className={cn(
          'p-4 rounded-full transition-colors',
          isDragActive ? 'bg-accent/20' : 'bg-secondary'
        )}>
          {error ? (
            <AlertCircle className="w-8 h-8 text-destructive" />
          ) : isDragActive ? (
            <Upload className="w-8 h-8 text-accent animate-bounce" />
          ) : (
            <FileText className="w-8 h-8 text-muted-foreground" />
          )}
        </div>
        
        <div className="space-y-2">
          <p className="text-lg font-medium text-foreground">
            {isDragActive
              ? 'Drop your CSV file here'
              : 'Drag & drop your hospital data CSV'}
          </p>
          <p className="text-sm text-muted-foreground">
            or click to browse files
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive font-medium">{error}</p>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="w-4 h-4" />
          <span>Accepts .csv files with hospital capability data</span>
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
}
