import { useState } from 'react';
import { ChevronDown, Cpu, Eye, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AIModel, AI_MODELS, AIService } from '@/services/AIService';
import { useToast } from '@/hooks/use-toast';

interface ModelSelectorProps {
  selectedModel: AIModel;
  onModelChange: (model: AIModel) => void;
}

export const ModelSelector = ({ selectedModel, onModelChange }: ModelSelectorProps) => {
  const [showApiKeyDialog, setShowApiKeyDialog] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const handleApiKeySubmit = (provider: string, apiKey: string) => {
    if (!apiKey.trim()) {
      toast({
        title: "Invalid API Key",
        description: "Please enter a valid API key",
        variant: "destructive",
      });
      return;
    }

    AIService.setApiKey(provider, apiKey);
    setApiKeys(prev => ({ ...prev, [provider]: apiKey }));
    setShowApiKeyDialog(null);
    
    toast({
      title: "API Key Saved",
      description: `${provider.toUpperCase()} API key has been configured`,
    });
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'gemini':
        return '🤖';
      case 'openai':
        return '🔥';
      case 'claude':
        return '⚡';
      default:
        return '🤖';
    }
  };

  const hasApiKey = (provider: string) => {
    return !!AIService.getApiKey(provider) || !!apiKeys[provider];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">AI Model</Label>
        <Badge variant="secondary" className="text-xs">
          {selectedModel.provider.toUpperCase()}
        </Badge>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between bg-code-bg border-accent/20 hover:border-accent/40"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{getProviderIcon(selectedModel.provider)}</span>
              <span className="font-medium">{selectedModel.name}</span>
              {selectedModel.supportsVision && (
                <Eye className="w-4 h-4 text-accent-blue" />
              )}
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-80 p-2 bg-code-bg border-accent/20">
          <div className="space-y-1">
            {AI_MODELS.map((model) => (
              <Button
                key={model.id}
                variant={selectedModel.id === model.id ? "secondary" : "ghost"}
                className="w-full justify-between h-auto p-3"
                onClick={() => onModelChange(model)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getProviderIcon(model.provider)}</span>
                  <div className="text-left">
                    <div className="font-medium">{model.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {model.maxTokens.toLocaleString()} tokens
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {model.supportsVision && (
                    <Eye className="w-3 h-3 text-accent-blue" />
                  )}
                  <Cpu className="w-3 h-3 text-muted-foreground" />
                </div>
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* API Key Management */}
      <Card className="p-4 bg-code-editor border-accent/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-accent-purple" />
            <span className="text-sm font-medium">API Keys</span>
          </div>
        </div>

        <div className="space-y-2">
          {['gemini', 'openai', 'claude'].map((provider) => (
            <div key={provider} className="flex items-center justify-between p-2 rounded-lg bg-code-bg">
              <div className="flex items-center gap-2">
                <span className="text-sm">{getProviderIcon(provider)}</span>
                <span className="text-sm font-medium capitalize">{provider}</span>
              </div>
              <Button
                variant={hasApiKey(provider) ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowApiKeyDialog(provider)}
                className="h-7 text-xs"
              >
                {hasApiKey(provider) ? 'Configured' : 'Set Key'}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* API Key Dialog */}
      {showApiKeyDialog && (
        <Card className="p-4 bg-code-editor border-accent/20">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Configure {showApiKeyDialog.toUpperCase()} API Key</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowApiKeyDialog(null)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
            
            <div className="space-y-2">
              <Input
                type="password"
                placeholder={`Enter your ${showApiKeyDialog.toUpperCase()} API key`}
                className="bg-code-bg border-accent/20"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleApiKeySubmit(showApiKeyDialog, e.currentTarget.value);
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={(e) => {
                    const input = (e.currentTarget.parentElement?.previousElementSibling as HTMLInputElement);
                    handleApiKeySubmit(showApiKeyDialog, input.value);
                  }}
                  className="flex-1"
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApiKeyDialog(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};