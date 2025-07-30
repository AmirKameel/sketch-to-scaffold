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

    // Retry logic for API overload
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${request.model.id}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errorText = await response.text();
          const errorData = JSON.parse(errorText);
          
          // If overloaded (503), wait and retry
          if (response.status === 503) {
            console.log(`Gemini API overloaded, attempt ${attempt}/3. Retrying in ${attempt * 2} seconds...`);
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, attempt * 2000));
              continue;
            }
          }
          
          throw new Error(`Gemini API error (${response.status}): ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!content) {
          throw new Error('No content generated from Gemini');
        }

        return await this.enhanceWithImages(content, request);
        
      } catch (error) {
        lastError = error;
        if (attempt === 3) {
          throw error;
        }
      }
    }
    
    throw lastError;
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

    return `You are an expert web developer and UI/UX designer. ${isScreenshot ? 'Analyze the provided screenshot and' : ''} create a ${isMultiPage ? 'professional multi-page website' : 'stunning single-page landing page'} based on the following requirements:

${request.prompt}

${isScreenshot ? `
SCREENSHOT ANALYSIS INSTRUCTIONS:
- Carefully analyze the layout, design, colors, typography, and components
- Recreate the exact visual design with modern web standards
- Pay attention to spacing, alignment, and visual hierarchy
- Extract any text content visible in the image
- Identify interactive elements (buttons, forms, navigation)
` : ''}

${!isMultiPage ? `
SINGLE-PAGE LANDING PAGE STRUCTURE (MANDATORY):
Create a professional landing page with these exact sections in order:

1. HEADER SECTION:
   - Fixed/sticky navigation bar with logo and menu items
   - Clean, modern design with smooth scrolling navigation
   - Mobile hamburger menu for responsive design

2. HERO SECTION:
   - Full-screen height with background image [IMAGE:hero]
   - Compelling headline and subheadline
   - Call-to-action button
   - Modern overlay effects and typography

3. ABOUT SECTION:
   - Two-column layout: image [IMAGE:about] on left, content on right
   - Company/service description with engaging copy
   - Professional styling with proper spacing

4. SERVICES/FEATURES SECTION:
   - Grid layout with service cards (3-4 items)
   - Each card: image [IMAGE:service1], [IMAGE:service2], [IMAGE:service3], title, description
   - Hover effects and modern card design
   - Icons or images for each service

5. TESTIMONIALS/REVIEWS SECTION:
   - Customer testimonials or reviews
   - Profile images [IMAGE:testimonial1], [IMAGE:testimonial2] 
   - Star ratings and quote styling
   - Carousel or grid layout

6. GALLERY/PORTFOLIO SECTION (if relevant):
   - Image gallery [IMAGE:gallery1], [IMAGE:gallery2], [IMAGE:gallery3], [IMAGE:gallery4]
   - Masonry or grid layout with hover effects
   - Lightbox functionality

7. CONTACT SECTION:
   - Contact form with validation
   - Company information and location
   - Background image [IMAGE:contact] or map integration

8. FOOTER:
   - Company info, links, social media
   - Copyright and additional navigation
   - Clean, organized layout

DESIGN REQUIREMENTS:
- Use modern CSS Grid and Flexbox for layouts
- Implement smooth scrolling and scroll-triggered animations
- Add CSS transitions and hover effects throughout
- Use CSS variables for consistent theming
- Implement parallax effects for background images
- Add loading animations and micro-interactions
- Use box-shadows, gradients, and modern visual effects
- Ensure perfect responsive design for all screen sizes
` : ''}

IMAGE INTEGRATION INSTRUCTIONS:
- Use placeholder image markers in format [IMAGE:section_name]
- For hero sections: [IMAGE:hero] for main background
- For about sections: [IMAGE:about] for company/team images  
- For services: [IMAGE:service1], [IMAGE:service2], [IMAGE:service3], etc.
- For testimonials: [IMAGE:testimonial1], [IMAGE:testimonial2], etc.
- For gallery/portfolio: [IMAGE:gallery1], [IMAGE:gallery2], [IMAGE:gallery3], etc.
- For contact: [IMAGE:contact] for background or team images
- Size images appropriately with CSS classes and proper aspect ratios

ADVANCED STYLING REQUIREMENTS:
- Implement CSS animations (fade-in, slide-up, etc.)
- Use modern color schemes with gradients and shadows
- Add particle effects or subtle background animations
- Implement smooth scrolling and section reveal animations
- Use advanced typography with multiple font weights
- Add CSS transforms for interactive elements
- Implement modern button designs with hover states
- Use CSS backdrop-filter for modern glass effects

TECHNICAL REQUIREMENTS:
- Use semantic HTML5 elements (header, nav, main, section, article, footer)
- Implement proper accessibility (ARIA labels, alt texts, keyboard navigation)
- Add meta tags for SEO optimization
- Include responsive breakpoints for mobile, tablet, desktop
- Use modern CSS features (CSS Grid, Flexbox, CSS Variables, calc())
- Add smooth JavaScript interactions without heavy frameworks
- Implement form validation and interactive elements
- Ensure fast loading and optimized performance

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
      "content": "/* Advanced CSS with animations and modern design */",
      "type": "css"
    },
    {
      "path": "script.js",
      "content": "// Interactive JavaScript for animations and functionality",
      "type": "js"
    }
  ],
  "pages": ["index.html"]
}

CRITICAL: Create visually stunning, modern websites that look professional and engaging. Use the latest web design trends, smooth animations, and beautiful visual effects. Every section should be carefully crafted with attention to spacing, typography, and visual hierarchy.

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
      const sectionsMap: Record<string, string[]> = {};
      
      htmlFiles.forEach(file => {
        const imageMatches = file.content.match(/\[IMAGE:(\w+\d*)\]/g);
        if (imageMatches) {
          imageMatches.forEach(match => {
            const fullSection = match.replace(/\[IMAGE:|\]/g, '');
            // Extract base section name (e.g., 'gallery' from 'gallery1')
            const baseSection = fullSection.replace(/\d+$/, '');
            
            if (!sectionsMap[baseSection]) {
              sectionsMap[baseSection] = [];
            }
            if (!sectionsMap[baseSection].includes(fullSection)) {
              sectionsMap[baseSection].push(fullSection);
            }
          });
        }
      });

      // Get contextual images if any sections need them
      if (Object.keys(sectionsMap).length > 0) {
        const baseSections = Object.keys(sectionsMap);
        const imageMap = await UnsplashService.getContextualImages(request.prompt, baseSections);
        
        // Replace image placeholders with actual images
        response.files = response.files.map(file => {
          if (file.type === 'html') {
            let updatedContent = file.content;
            
            // Process each base section and its variants
            Object.entries(sectionsMap).forEach(([baseSection, variants]) => {
              const images = imageMap[baseSection];
              if (images && images.length > 0) {
                variants.forEach((variant, index) => {
                  // Use different images for variants, or cycle through available images
                  const imageIndex = index % images.length;
                  const image = images[imageIndex];
                  
                  const imageHtml = UnsplashService.getImageMarkup(
                    image,
                    `${variant} image`,
                    'w-full h-auto object-cover'
                  );
                  
                  updatedContent = updatedContent.replace(
                    `[IMAGE:${variant}]`,
                    imageHtml
                  );
                });
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