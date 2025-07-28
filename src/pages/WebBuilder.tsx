import { useState } from 'react';
import { Wand2, Code, Monitor, Settings, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScreenshotUpload } from '@/components/ScreenshotUpload';
import { ModelSelector } from '@/components/ModelSelector';
import { CodeViewer } from '@/components/CodeViewer';
import { LivePreview } from '@/components/LivePreview';
import { AIService, AI_MODELS, GenerationRequest } from '@/services/AIService';
import { useToast } from '@/hooks/use-toast';

interface FileNode {
  path: string;
  content: string;
  type: 'html' | 'css' | 'js' | 'json';
}

export const WebBuilder = () => {
  const [prompt, setPrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0]);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [currentPage, setCurrentPage] = useState('index.html');
  const [pages, setPages] = useState<string[]>(['index.html']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [projectType, setProjectType] = useState<'single-page' | 'multi-page'>('single-page');
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!prompt.trim() && !uploadedImage) {
      toast({
        title: "Input Required",
        description: "Please provide a prompt or upload a screenshot",
        variant: "destructive",
      });
      return;
    }

    if (!AIService.getApiKey(selectedModel.provider)) {
      toast({
        title: "API Key Required",
        description: `Please configure your ${selectedModel.provider.toUpperCase()} API key`,
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const request: GenerationRequest = {
        prompt,
        model: selectedModel,
        image: uploadedImage || undefined,
        projectType,
      };

      const response = await AIService.generateWebsite(request);

      if (response.success) {
        setFiles(response.files);
        setPages(response.pages || ['index.html']);
        setCurrentPage(response.pages?.[0] || 'index.html');
        setSelectedFile(response.files[0]?.path || '');
        
        toast({
          title: "Website Generated!",
          description: `Successfully created ${response.files.length} files`,
        });
      } else {
        toast({
          title: "Generation Failed",
          description: response.error || "Failed to generate website",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageUpload = (file: File) => {
    setUploadedImage(file);
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-accent/20 bg-code-bg/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Wand2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">AI Web Builder</h1>
                <p className="text-sm text-muted-foreground">Screenshot to Website • Multi-Model AI • Live Preview</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-primary/20 text-primary">
                Beta v1.0
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)]">
          {/* Left Panel - Controls */}
          <div className="col-span-3 space-y-6">
            {/* Project Type */}
            <Card className="p-4 bg-code-bg border-accent/20">
              <h3 className="font-medium mb-3">Project Type</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={projectType === 'single-page' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setProjectType('single-page')}
                  className="text-xs"
                >
                  Single Page
                </Button>
                <Button
                  variant={projectType === 'multi-page' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setProjectType('multi-page')}
                  className="text-xs"
                >
                  Multi Page
                </Button>
              </div>
            </Card>

            {/* Model Selection */}
            <Card className="p-4 bg-code-bg border-accent/20">
              <ModelSelector
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
              />
            </Card>

            {/* Input Methods */}
            <Card className="p-4 bg-code-bg border-accent/20">
              <h3 className="font-medium mb-3">Input Method</h3>
              <Tabs defaultValue="prompt" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-code-editor">
                  <TabsTrigger value="prompt">Text Prompt</TabsTrigger>
                  <TabsTrigger value="screenshot">Screenshot</TabsTrigger>
                </TabsList>
                
                <TabsContent value="prompt" className="mt-4">
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Describe the website you want to create..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="min-h-[120px] bg-code-editor border-accent/20 resize-none"
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="screenshot" className="mt-4">
                  <ScreenshotUpload
                    onImageUpload={handleImageUpload}
                    image={uploadedImage}
                    onRemoveImage={handleRemoveImage}
                  />
                </TabsContent>
              </Tabs>
            </Card>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || (!prompt.trim() && !uploadedImage)}
              className="w-full bg-gradient-primary hover:shadow-glow transition-all"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Generate Website
                </>
              )}
            </Button>
          </div>

          {/* Right Panel - Output */}
          <div className="col-span-9">
            <Card className="h-full bg-code-bg border-accent/20 overflow-hidden">
              <Tabs defaultValue="preview" className="h-full flex flex-col">
                <div className="border-b border-accent/20 p-3">
                  <TabsList className="bg-code-editor">
                    <TabsTrigger value="preview" className="flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      Live Preview
                    </TabsTrigger>
                    <TabsTrigger value="code" className="flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      Source Code
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="preview" className="flex-1 m-0">
                  <LivePreview
                    files={files}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    pages={pages}
                  />
                </TabsContent>
                
                <TabsContent value="code" className="flex-1 m-0">
                  <CodeViewer
                    files={files}
                    selectedFile={selectedFile}
                    onFileSelect={setSelectedFile}
                  />
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};