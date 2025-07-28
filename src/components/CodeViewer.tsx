import { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface FileNode {
  path: string;
  content: string;
  type: 'html' | 'css' | 'js' | 'json';
}

interface CodeViewerProps {
  files: FileNode[];
  selectedFile?: string;
  onFileSelect: (path: string) => void;
}

export const CodeViewer = ({ files, selectedFile, onFileSelect }: CodeViewerProps) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const { toast } = useToast();

  const selectedFileContent = files.find(f => f.path === selectedFile)?.content || '';

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'html':
        return '🌐';
      case 'css':
        return '🎨';
      case 'js':
        return '⚡';
      case 'json':
        return '📋';
      default:
        return '📄';
    }
  };

  const getFileTypeColor = (type: string) => {
    switch (type) {
      case 'html':
        return 'text-orange-400';
      case 'css':
        return 'text-blue-400';
      case 'js':
        return 'text-yellow-400';
      case 'json':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "Copied!",
        description: "Code copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy code to clipboard",
        variant: "destructive",
      });
    }
  };

  const downloadFile = (file: FileNode) => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.path;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded",
      description: `${file.path} has been downloaded`,
    });
  };

  const downloadAllFiles = () => {
    files.forEach(file => {
      setTimeout(() => downloadFile(file), 100 * files.indexOf(file));
    });
  };

  if (files.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center bg-code-bg border-accent/20">
        <div className="text-center text-muted-foreground">
          <File className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No files generated yet</p>
          <p className="text-sm">Upload a screenshot or enter a prompt to get started</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="h-full flex">
      {/* File Explorer */}
      <div className="w-64 bg-code-panel border-r border-accent/20 flex flex-col">
        <div className="p-3 border-b border-accent/20">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Project Files</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadAllFiles}
              className="h-6 w-6 p-0"
            >
              <Download className="w-3 h-3" />
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <div className="p-2 space-y-1">
            {files.map((file) => (
              <Button
                key={file.path}
                variant={selectedFile === file.path ? "secondary" : "ghost"}
                className="w-full justify-start h-8 px-2 text-xs"
                onClick={() => onFileSelect(file.path)}
              >
                <span className="mr-2">{getFileIcon(file.type)}</span>
                <span className="truncate">{file.path}</span>
                <Badge 
                  variant="outline" 
                  className={`ml-auto h-4 text-xs ${getFileTypeColor(file.type)} border-current`}
                >
                  {file.type.toUpperCase()}
                </Badge>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Code Editor */}
      <div className="flex-1 bg-code-editor">
        {selectedFile ? (
          <div className="h-full flex flex-col">
            {/* File Header */}
            <div className="flex items-center justify-between p-3 border-b border-accent/20">
              <div className="flex items-center gap-2">
                <span>{getFileIcon(files.find(f => f.path === selectedFile)?.type || '')}</span>
                <span className="font-medium text-sm">{selectedFile}</span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(selectedFileContent)}
                  className="h-7 px-2"
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const file = files.find(f => f.path === selectedFile);
                    if (file) downloadFile(file);
                  }}
                  className="h-7 px-2"
                >
                  <Download className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Code Content */}
            <div className="flex-1 overflow-auto">
              <pre className="p-4 text-sm font-mono leading-relaxed">
                <code className="text-foreground">{selectedFileContent}</code>
              </pre>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <File className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a file to view its contents</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};