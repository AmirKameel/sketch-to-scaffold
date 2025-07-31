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
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    maxTokens: 8192,
    supportsVision: true
  },
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
Create a stunning, professional landing page with these exact sections in perfect order:

1. HEADER/NAVIGATION SECTION:
   - Sleek fixed/sticky navigation bar with elegant logo and smooth menu transitions
   - Glass morphism effects with backdrop blur
   - Mobile-first responsive hamburger menu with smooth animations
   - Gradient background with subtle animations
   - Modern typography with perfect spacing

2. HERO SECTION:
   - Full viewport height with stunning background image [IMAGE:hero]
   - Bold, attention-grabbing headline with animated text reveal
   - Compelling subheadline with perfect typography hierarchy
   - Prominent gradient call-to-action button with hover animations
   - Floating particles or subtle background animations
   - Perfect overlay with gradient effects for text readability

3. ABOUT/COMPANY SECTION:
   - Elegant two-column responsive layout
   - Left: High-quality image [IMAGE:about] with modern border radius and shadows
   - Right: Engaging company story with beautiful typography
   - Animated counters or statistics if relevant
   - Smooth scroll-triggered animations
   - Professional spacing and visual hierarchy

4. SERVICES/FEATURES SECTION:
   - Modern CSS Grid layout with 3-4 stunning service cards
   - Each card: Beautiful image [IMAGE:service1], [IMAGE:service2], [IMAGE:service3], [IMAGE:service4]
   - Card titles with perfect typography
   - Descriptive text with optimal line height
   - Hover effects with scale, shadow, and color transitions
   - Icons with gradient effects
   - Responsive masonry layout

5. TESTIMONIALS/REVIEWS SECTION:
   - Customer testimonials with professional styling
   - Profile images [IMAGE:testimonial1], [IMAGE:testimonial2], [IMAGE:testimonial3]
   - 5-star rating systems with golden stars
   - Quote styling with elegant typography
   - Carousel with smooth transitions or beautiful grid
   - Company logos or badges for credibility

6. GALLERY/PORTFOLIO SECTION:
   - Stunning image gallery [IMAGE:gallery1], [IMAGE:gallery2], [IMAGE:gallery3], [IMAGE:gallery4], [IMAGE:gallery5], [IMAGE:gallery6]
   - Masonry or grid layout with perfect spacing
   - Hover effects with zoom and overlay animations
   - Lightbox modal functionality with smooth transitions
   - Filter/category buttons if relevant

7. STATS/ACHIEVEMENTS SECTION (if relevant):
   - Animated counters with scroll-triggered animations
   - Background image [IMAGE:stats] with overlay
   - Achievement badges or awards
   - Visual progress bars or charts

8. CONTACT SECTION:
   - Professional contact form with modern styling
   - Form validation with beautiful error states
   - Company information with icons
   - Background image [IMAGE:contact] or subtle patterns
   - Maps integration or location details
   - Social media links with hover animations

9. FOOTER:
   - Multi-column layout with organized links
   - Company information and social media
   - Newsletter signup with modern styling
   - Copyright with elegant typography
   - Back-to-top button with smooth scroll

DESIGN REQUIREMENTS:
- Use modern CSS Grid and Flexbox for perfect layouts
- Implement smooth scrolling and scroll-triggered reveal animations
- Add CSS transitions, transforms, and hover effects throughout
- Use CSS variables for consistent color theming and spacing
- Implement parallax effects and background attachments
- Add loading animations, micro-interactions, and button effects
- Use modern box-shadows, gradients, and glassmorphism effects
- Implement dark/light mode with CSS variables
- Perfect responsive design for mobile, tablet, and desktop
- Use modern typography with perfect font weights and spacing
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
- Implement stunning CSS animations (fade-in, slide-up, rotate, scale)
- Use modern color schemes with beautiful gradients and realistic shadows
- Add subtle particle effects or floating animations
- Implement smooth AOS (Animate On Scroll) reveal animations
- Use premium typography with multiple font weights and perfect spacing
- Add CSS transforms for all interactive elements
- Implement modern button designs with multiple hover states
- Use CSS backdrop-filter for glassmorphism effects
- Add loading spinners and skeleton screens
- Implement modern card designs with elevation shadows
- Use CSS clip-path for unique shapes and designs
- Add smooth page transitions and element morphing

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
      // First, try to extract JSON from markdown code blocks
      let jsonStr = this.extractJsonFromContent(content);
      
      if (!jsonStr) {
        throw new Error('No valid JSON structure found in response');
      }

      let parsed;
      
      // Try progressive fixing strategies
      const strategies = [
        () => JSON.parse(jsonStr), // Try as-is first
        () => JSON.parse(this.sanitizeJsonString(jsonStr)), // Basic sanitization
        () => JSON.parse(this.fixContentFields(jsonStr)), // Fix content fields specifically
        () => this.parseWithRegex(content) // Fallback to regex extraction
      ];

      for (const strategy of strategies) {
        try {
          parsed = strategy();
          if (parsed && parsed.files) {
            break;
          }
        } catch (error) {
          console.log('Strategy failed:', error.message);
          continue;
        }
      }

      if (!parsed || !parsed.files) {
        throw new Error('Could not parse valid file structure from response');
      }

      return {
        success: true,
        files: parsed.files || [],
        pages: parsed.pages || ['index.html']
      };
    } catch (error) {
      console.error('Error parsing generated content:', error);
      console.log('Content length:', content.length);
      console.log('Content preview:', content.substring(0, 1000));
      
      return {
        success: false,
        files: [],
        error: `Failed to parse generated content: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private static extractJsonFromContent(content: string): string | null {
    // Try different patterns to extract JSON
    const patterns = [
      /```(?:json)?\s*(\{[\s\S]*\})\s*```/i,
      /(\{[\s\S]*"files"[\s\S]*\})/i,
      /(\{[\s\S]*\})/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  private static sanitizeJsonString(jsonStr: string): string {
    // Remove any leading/trailing whitespace and ensure proper braces
    jsonStr = jsonStr.trim();
    
    if (!jsonStr.startsWith('{')) {
      const openBrace = jsonStr.indexOf('{');
      if (openBrace !== -1) {
        jsonStr = jsonStr.substring(openBrace);
      }
    }
    
    if (!jsonStr.endsWith('}')) {
      const closeBrace = jsonStr.lastIndexOf('}');
      if (closeBrace !== -1) {
        jsonStr = jsonStr.substring(0, closeBrace + 1);
      }
    }
    
    return jsonStr;
  }

  private static fixContentFields(jsonStr: string): string {
    try {
      // More sophisticated content field fixing
      const lines = jsonStr.split('\n');
      let result = [];
      let inContentField = false;
      let contentBuffer = [];
      let braceLevel = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Track brace levels for proper JSON structure
        for (const char of line) {
          if (char === '{') braceLevel++;
          if (char === '}') braceLevel--;
        }
        
        // Detect content field start
        if (line.includes('"content":')) {
          inContentField = true;
          contentBuffer = [line];
          continue;
        }
        
        if (inContentField) {
          // Check if we've reached the end of content field
          if ((line.includes('"type":') || line.includes('"path":') || line.trim() === '}') && 
              !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
            
            // Process accumulated content
            const contentStr = contentBuffer.join('\n');
            const fixedContent = this.escapeContentString(contentStr);
            result.push(fixedContent);
            
            inContentField = false;
            contentBuffer = [];
            result.push(line);
          } else {
            contentBuffer.push(line);
          }
        } else {
          result.push(line);
        }
      }
      
      // Handle any remaining content buffer
      if (contentBuffer.length > 0) {
        const contentStr = contentBuffer.join('\n');
        const fixedContent = this.escapeContentString(contentStr);
        result.push(fixedContent);
      }
      
      return result.join('\n');
    } catch (error) {
      console.error('Error fixing content fields:', error);
      return jsonStr;
    }
  }

  private static escapeContentString(contentStr: string): string {
    // Extract the actual content value
    const match = contentStr.match(/"content":\s*"([\s\S]*)"$/);
    if (!match) return contentStr;
    
    let content = match[1];
    
    // Escape quotes and other special characters
    content = content
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/"/g, '\\"')    // Escape quotes
      .replace(/\r?\n/g, '\\n') // Escape newlines
      .replace(/\t/g, '\\t');   // Escape tabs
    
    return `"content": "${content}"`;
  }

  private static parseWithRegex(content: string): any {
    // Fallback: try to extract files using regex patterns
    console.log('Using regex fallback parser...');
    
    const files = [];
    
    // Extract HTML file
    const htmlMatch = content.match(/"path":\s*"index\.html"[\s\S]*?"content":\s*"([\s\S]*?)"[\s\S]*?"type":\s*"html"/);
    if (htmlMatch) {
      files.push({
        path: 'index.html',
        content: htmlMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
        type: 'html'
      });
    }
    
    // Extract CSS file
    const cssMatch = content.match(/"path":\s*"styles\.css"[\s\S]*?"content":\s*"([\s\S]*?)"[\s\S]*?"type":\s*"css"/);
    if (cssMatch) {
      files.push({
        path: 'styles.css',
        content: cssMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
        type: 'css'
      });
    }
    
    // Extract JS file
    const jsMatch = content.match(/"path":\s*"script\.js"[\s\S]*?"content":\s*"([\s\S]*?)"[\s\S]*?"type":\s*"js"/);
    if (jsMatch) {
      files.push({
        path: 'script.js',
        content: jsMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
        type: 'js'
      });
    }
    
    return {
      files,
      pages: ['index.html']
    };
  }
}