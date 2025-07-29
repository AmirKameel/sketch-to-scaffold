import { UnsplashService } from './UnsplashService';

export interface AIModel {
  id: string;
  name: string;
  provider: 'gemini' | 'openai' | 'claude';
  maxTokens: number;
  supportsVision: boolean;
}

export interface GenerationRequest {
  prompt: string;
  model: AIModel;
  image?: File;
  context?: string;
  projectType: 'single-page' | 'multi-page';
}

export interface GenerationResponse {
  success: boolean;
  files: {
    path: string;
    content: string;
    type: 'html' | 'css' | 'js' | 'json';
  }[];
  pages?: string[];
  error?: string;
}

export const AI_MODELS: AIModel[] = [
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash (Experimental)',
    provider: 'gemini',
    maxTokens: 8192,
    supportsVision: true
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    maxTokens: 8192,
    supportsVision: true
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    maxTokens: 4096,
    supportsVision: true
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'claude',
    maxTokens: 4096,
    supportsVision: true
  }
];

export class AIService {
  private static apiKeys: Record<string, string> = {
    'gemini': 'AIzaSyCdN7JK1hpDaziMTfqY8V6GcYq00ufd-UI'
  };

  static setApiKey(provider: string, apiKey: string) {
    this.apiKeys[provider] = apiKey;
    localStorage.setItem(`ai_${provider}_key`, apiKey);
  }

  static getApiKey(provider: string): string | null {
    if (this.apiKeys[provider]) {
      return this.apiKeys[provider];
    }
    return localStorage.getItem(`ai_${provider}_key`);
  }

  static async generateWebsite(request: GenerationRequest): Promise<GenerationResponse> {
    try {
      const apiKey = this.getApiKey(request.model.provider);
      if (!apiKey) {
        throw new Error(`API key not found for ${request.model.provider}`);
      }

      switch (request.model.provider) {
        case 'gemini':
          return await this.generateWithGemini(request, apiKey);
        case 'openai':
          return await this.generateWithOpenAI(request, apiKey);
        case 'claude':
          return await this.generateWithClaude(request, apiKey);
        default:
          throw new Error(`Unsupported provider: ${request.model.provider}`);
      }
    } catch (error) {
      console.error('AI Generation Error:', error);
      return {
        success: false,
        files: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private static async generateWithGemini(request: GenerationRequest, apiKey: string): Promise<GenerationResponse> {
    const prompt = this.buildSystemPrompt(request);
    
    const body: any = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: request.model.maxTokens,
      }
    };

    // Add image if provided
    if (request.image && request.model.supportsVision) {
      const imageData = await this.fileToBase64(request.image);
      body.contents[0].parts.unshift({
        inlineData: {
          mimeType: request.image.type,
          data: imageData
        }
      });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${request.model.id}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content generated from Gemini');
    }

    return await this.enhanceWithImages(content, request);
  }

  private static async generateWithOpenAI(request: GenerationRequest, apiKey: string): Promise<GenerationResponse> {
    // OpenAI implementation placeholder
    throw new Error('OpenAI integration coming soon');
  }

  private static async generateWithClaude(request: GenerationRequest, apiKey: string): Promise<GenerationResponse> {
    // Claude implementation placeholder
    throw new Error('Claude integration coming soon');
  }

  private static buildSystemPrompt(request: GenerationRequest): string {
    const isScreenshot = !!request.image;
    const isMultiPage = request.projectType === 'multi-page';

    return `You are an expert web developer. ${isScreenshot ? 'Analyze the provided screenshot and' : ''} create a ${isMultiPage ? 'multi-page website' : 'single-page website'} based on the following requirements:

${request.prompt}

${isScreenshot ? `
SCREENSHOT ANALYSIS INSTRUCTIONS:
- Carefully analyze the layout, design, colors, typography, and components
- Recreate the exact visual design with modern web standards
- Pay attention to spacing, alignment, and visual hierarchy
- Extract any text content visible in the image
- Identify interactive elements (buttons, forms, navigation)
` : ''}

IMAGE INTEGRATION INSTRUCTIONS:
- Use placeholder image markers like [IMAGE:hero], [IMAGE:about], [IMAGE:gallery] in your HTML
- Place these markers where images should appear
- Common sections that need images: hero, about, services, gallery, team, testimonials
- Use semantic class names for image containers

GENERATION REQUIREMENTS:
- Use modern HTML5, CSS3, and vanilla JavaScript
- Create responsive design that works on all devices
- Use semantic HTML elements
- Implement clean, maintainable code structure
- Add proper accessibility features
- Include modern CSS features (Grid, Flexbox, CSS Variables)
- Add image placeholders with [IMAGE:section_name] format
${isMultiPage ? '- Create navigation between pages\n- Generate separate HTML files for each page' : ''}

OUTPUT FORMAT:
Return your response in the following JSON structure:
{
  "files": [
    {
      "path": "index.html",
      "content": "<!DOCTYPE html>...",
      "type": "html"
    },
    {
      "path": "styles.css", 
      "content": "/* CSS content */",
      "type": "css"
    },
    {
      "path": "script.js",
      "content": "// JavaScript content",
      "type": "js"
    }
  ],
  "pages": ["index.html", "about.html", "contact.html"]
}

IMPORTANT: Return ONLY the JSON response, no additional text or explanations.`;
  }

  private static async enhanceWithImages(content: string, request: GenerationRequest): Promise<GenerationResponse> {
    try {
      const response = this.parseGeneratedContent(content);
      
      if (!response.success) {
        return response;
      }

      // Extract sections that need images from the HTML content
      const htmlFiles = response.files.filter(f => f.type === 'html');
      const sectionsNeeded: string[] = [];
      
      htmlFiles.forEach(file => {
        const imageMatches = file.content.match(/\[IMAGE:(\w+)\]/g);
        if (imageMatches) {
          imageMatches.forEach(match => {
            const section = match.replace(/\[IMAGE:|\]/g, '');
            if (!sectionsNeeded.includes(section)) {
              sectionsNeeded.push(section);
            }
          });
        }
      });

      // Get contextual images if any sections need them
      if (sectionsNeeded.length > 0) {
        const imageMap = await UnsplashService.getContextualImages(request.prompt, sectionsNeeded);
        
        // Replace image placeholders with actual images
        response.files = response.files.map(file => {
          if (file.type === 'html') {
            let updatedContent = file.content;
            
            sectionsNeeded.forEach(section => {
              const images = imageMap[section];
              if (images && images.length > 0) {
                const image = images[0];
                const imageHtml = UnsplashService.getImageMarkup(
                  image,
                  `${section} section image`,
                  'w-full h-auto object-cover'
                );
                
                updatedContent = updatedContent.replace(
                  `[IMAGE:${section}]`,
                  imageHtml
                );
              }
            });
            
            return { ...file, content: updatedContent };
          }
          return file;
        });
      }

      return response;
    } catch (error) {
      console.error('Error enhancing with images:', error);
      // Return original response if image enhancement fails
      return this.parseGeneratedContent(content);
    }
  }

  private static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private static parseGeneratedContent(content: string): GenerationResponse {
    try {
      // Extract JSON from the response (remove any markdown formatting)
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const jsonStr = jsonMatch[1];
      const parsed = JSON.parse(jsonStr);

      return {
        success: true,
        files: parsed.files || [],
        pages: parsed.pages || ['index.html']
      };
    } catch (error) {
      console.error('Error parsing generated content:', error);
      return {
        success: false,
        files: [],
        error: 'Failed to parse generated content'
      };
    }
  }
}