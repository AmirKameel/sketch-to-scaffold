import { useState, useRef } from 'react';
import { Upload, Image, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface ScreenshotUploadProps {
  onImageUpload: (file: File) => void;
  image: File | null;
  onRemoveImage: () => void;
}

export const ScreenshotUpload = ({ onImageUpload, image, onRemoveImage }: ScreenshotUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleFileUpload(imageFile);
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload an image file (PNG, JPG, GIF, WebP)",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    onImageUpload(file);
    toast({
      title: "Image Uploaded",
      description: "Screenshot ready for analysis",
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  if (image) {
    return (
      <Card className="relative p-4 bg-code-bg border-accent/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Screenshot Uploaded</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemoveImage}
            className="h-8 w-8 p-0 hover:bg-destructive/20"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="aspect-video bg-code-editor rounded-lg overflow-hidden">
          <img
            src={URL.createObjectURL(image)}
            alt="Uploaded screenshot"
            className="w-full h-full object-contain"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {image.name} ({(image.size / 1024 / 1024).toFixed(2)}MB)
        </p>
      </Card>
    );
  }

  return (
    <Card 
      className={`relative p-8 border-2 border-dashed transition-all cursor-pointer ${
        isDragging 
          ? 'border-primary bg-primary/5 shadow-glow' 
          : 'border-accent/30 hover:border-accent/50 bg-code-bg/50'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={openFileDialog}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div className="text-center">
        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all ${
          isDragging ? 'bg-primary/20' : 'bg-accent/10'
        }`}>
          <Upload className={`w-8 h-8 transition-colors ${
            isDragging ? 'text-primary' : 'text-accent-blue'
          }`} />
        </div>
        
        <h3 className="text-lg font-semibold mb-2">
          {isDragging ? 'Drop your screenshot here' : 'Upload Screenshot'}
        </h3>
        
        <p className="text-sm text-muted-foreground mb-4">
          Drag and drop an image, or click to browse
        </p>
        
        <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-1 bg-accent/10 rounded">PNG</span>
          <span className="px-2 py-1 bg-accent/10 rounded">JPG</span>
          <span className="px-2 py-1 bg-accent/10 rounded">GIF</span>
          <span className="px-2 py-1 bg-accent/10 rounded">WebP</span>
        </div>
        
        <p className="text-xs text-muted-foreground mt-4">
          Max file size: 10MB
        </p>
      </div>
    </Card>
  );
};