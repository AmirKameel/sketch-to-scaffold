import { useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone, Tablet, RefreshCw, ExternalLink, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface FileNode {
  path: string;
  content: string;
  type: 'html' | 'css' | 'js' | 'json';
}

interface LivePreviewProps {
  files: FileNode[];
  currentPage?: string;
  onPageChange?: (page: string) => void;
  pages?: string[];
}

type ViewportSize = 'desktop' | 'tablet' | 'mobile';

export const LivePreview = ({ files, currentPage = 'index.html', onPageChange, pages = [] }: LivePreviewProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getViewportDimensions = (size: ViewportSize) => {
    switch (size) {
      case 'mobile':
        return { width: '375px', height: '667px' };
      case 'tablet':
        return { width: '768px', height: '1024px' };
      case 'desktop':
        return { width: '100%', height: '100%' };
    }
  };

  const generatePreviewHTML = () => {
    const htmlFile = files.find(f => f.path === currentPage);
    const cssFile = files.find(f => f.type === 'css');
    const jsFile = files.find(f => f.type === 'js');

    if (!htmlFile) {
      return `
        <html>
          <body style="display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: system-ui; background: #0f0f23; color: #a0a0a0;">
            <div style="text-align: center;">
              <h2>No Preview Available</h2>
              <p>Generate a website to see the preview</p>
            </div>
          </body>
        </html>
      `;
    }

    let html = htmlFile.content;

    // Inject CSS
    if (cssFile) {
      html = html.replace(
        '</head>',
        `<style>${cssFile.content}</style></head>`
      );
    }

    // Inject JavaScript
    if (jsFile) {
      html = html.replace(
        '</body>',
        `<script>${jsFile.content}</script></body>`
      );
    }

    return html;
  };

  const updatePreview = () => {
    if (!iframeRef.current) return;

    setIsLoading(true);
    const htmlContent = generatePreviewHTML();
    
    try {
      const iframe = iframeRef.current;
      iframe.srcdoc = htmlContent;
      
      iframe.onload = () => {
        setIsLoading(false);
      };
    } catch (error) {
      console.error('Error updating preview:', error);
      setIsLoading(false);
      toast({
        title: "Preview Error",
        description: "Failed to update preview",
        variant: "destructive",
      });
    }
  };

  const openInNewTab = () => {
    const htmlContent = generatePreviewHTML();
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadHTML = () => {
    const htmlContent = generatePreviewHTML();
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentPage;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: `${currentPage} has been downloaded`,
    });
  };

  useEffect(() => {
    updatePreview();
  }, [files, currentPage]);

  const viewportDimensions = getViewportDimensions(viewport);

  return (
    <div className="h-full flex flex-col bg-code-bg">
      {/* Preview Header */}
      <div className="flex items-center justify-between p-3 border-b border-accent/20">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm">Live Preview</h3>
          {pages.length > 1 && (
            <div className="flex gap-1">
              {pages.map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => onPageChange?.(page)}
                  className="h-6 px-2 text-xs"
                >
                  {page.replace('.html', '')}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Viewport Controls */}
          <div className="flex border border-accent/20 rounded-lg overflow-hidden">
            <Button
              variant={viewport === 'desktop' ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewport('desktop')}
              className="h-7 px-2 rounded-none border-0"
            >
              <Monitor className="w-3 h-3" />
            </Button>
            <Button
              variant={viewport === 'tablet' ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewport('tablet')}
              className="h-7 px-2 rounded-none border-0"
            >
              <Tablet className="w-3 h-3" />
            </Button>
            <Button
              variant={viewport === 'mobile' ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewport('mobile')}
              className="h-7 px-2 rounded-none border-0"
            >
              <Smartphone className="w-3 h-3" />
            </Button>
          </div>

          {/* Actions */}
          <Button
            variant="ghost"
            size="sm"
            onClick={updatePreview}
            disabled={isLoading}
            className="h-7 px-2"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={openInNewTab}
            className="h-7 px-2"
          >
            <ExternalLink className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadHTML}
            className="h-7 px-2"
          >
            <Download className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Preview Container */}
      <div className="flex-1 flex items-center justify-center p-4 bg-gradient-to-br from-code-bg to-code-editor">
        <div 
          className="bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300"
          style={viewportDimensions}
        >
          {viewport !== 'desktop' && (
            <div className="bg-gray-100 px-4 py-2 border-b">
              <div className="flex items-center justify-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {viewport === 'tablet' ? 'Tablet' : 'Mobile'} Preview
                </Badge>
              </div>
            </div>
          )}
          
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title="Website Preview"
          />
          
          {isLoading && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading preview...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};