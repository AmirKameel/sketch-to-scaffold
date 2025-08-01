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
  onProgress?: (content: string, isComplete: boolean) => void;
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

        // Call progress callback with complete content
        if (request.onProgress) {
          request.onProgress(content, true);
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

MANDATORY FILES TO GENERATE:
You MUST generate all three files:
1. index.html - Complete HTML structure with proper references to styles.css and script.js
2. styles.css - Complete CSS with all styling, animations, and responsive design
3. script.js - Interactive JavaScript for animations, form handling, and dynamic functionality

CSS FILE REQUIREMENTS (styles.css):
- Reset/normalize styles at the top
- CSS variables for colors, fonts, and spacing
- Mobile-first responsive design with breakpoints
- Smooth animations and transitions for all interactive elements
- Modern design effects (glassmorphism, gradients, shadows)
- AOS animation classes and custom animations
- Form styling and validation states
- Loading spinner and state styles
- Dark/light mode support (optional)

JAVASCRIPT FILE REQUIREMENTS (script.js):
- DOM ready functionality
- Smooth scrolling navigation
- Mobile menu toggle functionality  
- AOS initialization and scroll animations
- Form handling and validation
- Counter animations for statistics
- Image loading and optimization
- Any interactive features needed
- Performance optimizations

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
      "content": "/* Complete CSS with reset, variables, responsive design, animations */",
      "type": "css"
    },
    {
      "path": "script.js",
      "content": "// Complete JavaScript with DOM ready, navigation, animations, forms",
      "type": "js"
    }
  ],
  "pages": ["index.html"]
}

CRITICAL RULES:
1. Generate ALL THREE FILES - HTML, CSS, and JS
2. CSS must be complete and self-contained with all styles needed
3. JavaScript must handle all interactive functionality
4. HTML must properly reference styles.css and script.js
5. Create visually stunning, modern websites with smooth animations
6. Use latest web design trends and beautiful visual effects
7. Return ONLY the JSON response, no additional text or explanations

FALLBACK STRATEGY:
If you cannot generate proper JSON, create the content with clear file separators:
=== index.html ===
[HTML content]
=== styles.css ===
[CSS content]  
=== script.js ===
[JavaScript content]`;
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

      // Ensure we have all required files (HTML, CSS, JS)
      response.files = this.ensureAllRequiredFiles(response.files);
      
      return response;
    } catch (error) {
      console.error('Error enhancing with images:', error);
      // Return original response if image enhancement fails
      const fallbackResponse = this.parseGeneratedContent(content);
      fallbackResponse.files = this.ensureAllRequiredFiles(fallbackResponse.files);
      return fallbackResponse;
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

  static parseGeneratedContent(content: string): GenerationResponse {
    try {
      console.log('Parsing content, length:', content.length);
      
      // Try direct regex extraction first (most reliable)
      const regexResult = this.parseWithRegex(content);
      if (regexResult && regexResult.files && regexResult.files.length > 0) {
        console.log('Successfully parsed with regex');
        return {
          success: true,
          files: regexResult.files,
          pages: regexResult.pages || ['index.html']
        };
      }

      // Fallback to JSON parsing
      let jsonStr = this.extractJsonFromContent(content);
      if (!jsonStr) {
        throw new Error('No valid JSON structure found in response');
      }

      // Clean the JSON string more aggressively
      jsonStr = this.sanitizeJsonString(jsonStr);
      
      const parsed = JSON.parse(jsonStr);
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
      
      // Final fallback: create minimal HTML if we can find any content
      const fallbackResult = this.createFallbackContent(content);
      if (fallbackResult.files.length > 0) {
        return fallbackResult;
      }
      
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
    console.log('Using regex fallback parser...');
    
    const files = [];
    
    // First, try to parse fallback strategy format
    const fallbackResult = this.parseFallbackFormat(content);
    if (fallbackResult.files.length > 0) {
      return fallbackResult;
    }
    
    // More aggressive patterns to extract content from JSON
    const htmlPatterns = [
      // Try to find complete HTML with proper escaping
      /<!DOCTYPE html[\s\S]*?<\/html>/i,
      // Try to find HTML content between quotes
      /"content":\s*"(<!DOCTYPE html[\s\S]*?<\/html>)"/i,
      // Try to find any HTML content
      /<html[\s\S]*?<\/html>/i
    ];

    let htmlContent = '';
    for (const pattern of htmlPatterns) {
      const match = content.match(pattern);
      if (match) {
        htmlContent = match[1] || match[0];
        // Clean up escaped characters
        htmlContent = htmlContent
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\');
        break;
      }
    }

    if (htmlContent) {
      files.push({
        path: 'index.html',
        content: htmlContent,
        type: 'html'
      });
    }

    // Extract CSS - try multiple patterns
    const cssPatterns = [
      // Look for CSS in "styles.css" content field
      /"path":\s*"styles\.css"[\s\S]*?"content":\s*"([^"]*[\s\S]*?)"/i,
      // Look for CSS comments and rules
      /"content":\s*"([^"]*\/\*[\s\S]*?\*\/[\s\S]*?)"/i,
      // Look for CSS selectors and properties
      /"content":\s*"([^"]*\{[\s\S]*?\}[\s\S]*?)"/i,
      // Find CSS outside JSON
      /\/\*[\s\S]*?\*\/[\s\S]*?\{[\s\S]*?\}/
    ];

    for (const pattern of cssPatterns) {
      const match = content.match(pattern);
      if (match) {
        let cssContent = match[1] || match[0];
        cssContent = cssContent
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\');
        
        if (cssContent.includes('{') && cssContent.length > 50) {
          files.push({
            path: 'styles.css',
            content: cssContent,
            type: 'css'
          });
          break;
        }
      }
    }

    // Extract JavaScript - try multiple patterns
    const jsPatterns = [
      // Look for JS in "script.js" content field
      /"path":\s*"script\.js"[\s\S]*?"content":\s*"([^"]*[\s\S]*?)"/i,
      // Look for functions
      /"content":\s*"([^"]*function[\s\S]*?)"/i,
      // Look for document interactions
      /"content":\s*"([^"]*document\.[\s\S]*?)"/i,
      // Look for event listeners
      /"content":\s*"([^"]*addEventListener[\s\S]*?)"/i,
      // Find JS outside JSON
      /document\.[\s\S]*?;|function[\s\S]*?\}|addEventListener[\s\S]*?\}/
    ];

    for (const pattern of jsPatterns) {
      const match = content.match(pattern);
      if (match) {
        let jsContent = match[1] || match[0];
        jsContent = jsContent
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\');
        
        if ((jsContent.includes('function') || jsContent.includes('document') || jsContent.includes('addEventListener')) && jsContent.length > 20) {
          files.push({
            path: 'script.js',
            content: jsContent,
            type: 'js'
          });
          break;
        }
      }
    }
    
    return {
      files,
      pages: ['index.html']
    };
  }

  private static parseFallbackFormat(content: string): any {
    const files = [];
    
    // Check if content uses fallback format with === separators
    const htmlMatch = content.match(/=== index\.html ===\s*([\s\S]*?)(?=\s*===|\s*$)/i);
    if (htmlMatch) {
      files.push({
        path: 'index.html',
        content: htmlMatch[1].trim(),
        type: 'html'
      });
    }
    
    const cssMatch = content.match(/=== styles\.css ===\s*([\s\S]*?)(?=\s*===|\s*$)/i);
    if (cssMatch) {
      files.push({
        path: 'styles.css',
        content: cssMatch[1].trim(),
        type: 'css'
      });
    }
    
    const jsMatch = content.match(/=== script\.js ===\s*([\s\S]*?)(?=\s*===|\s*$)/i);
    if (jsMatch) {
      files.push({
        path: 'script.js',
        content: jsMatch[1].trim(),
        type: 'js'
      });
    }
    
    return {
      files,
      pages: ['index.html']
    };
  }

  private static createFallbackContent(content: string): GenerationResponse {
    // Last resort: create a basic HTML file if we can extract any meaningful content
    console.log('Creating fallback content...');
    
    const files = [];
    
    // Look for any HTML-like content
    const htmlPattern = /<!DOCTYPE html|<html|<head|<body/i;
    if (htmlPattern.test(content)) {
      // Extract the first reasonable HTML snippet
      let htmlStart = content.search(htmlPattern);
      if (htmlStart !== -1) {
        let htmlContent = content.substring(htmlStart);
        
        // Try to find a reasonable ending
        const htmlEnd = htmlContent.search(/<\/html>|$/) + 7;
        htmlContent = htmlContent.substring(0, htmlEnd);
        
        // Clean up
        htmlContent = htmlContent
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\');
        
        if (htmlContent.length > 50) { // Only if we have substantial content
          files.push({
            path: 'index.html',
            content: htmlContent,
            type: 'html'
          });
          
          // Generate basic CSS file if missing
          files.push({
            path: 'styles.css',
            content: this.generateBasicCSS(),
            type: 'css'
          });
          
          // Generate basic JS file if missing
          files.push({
            path: 'script.js',
            content: this.generateBasicJS(),
            type: 'js'
          });
        }
      }
    }
    
    return {
      success: files.length > 0,
      files,
      pages: files.length > 0 ? ['index.html'] : []
    };
  }

  private static generateBasicCSS(): string {
    return `/* Reset and Base Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary-color: #2563eb;
  --primary-dark: #1d4ed8;
  --text-dark: #1f2937;
  --text-light: #6b7280;
  --bg-light: #f9fafb;
  --white: #ffffff;
  --shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1);
  --transition: all 0.3s ease;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  line-height: 1.6;
  color: var(--text-dark);
  background-color: var(--white);
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 1rem;
}

h1 { font-size: 2.5rem; }
h2 { font-size: 2rem; }
h3 { font-size: 1.5rem; }

p {
  margin-bottom: 1rem;
  color: var(--text-light);
}

/* Layout */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.container-fluid {
  width: 100%;
  padding: 0 1rem;
}

/* Header */
.header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding: 1rem 0;
  transition: var(--transition);
}

.header.fixed-top {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-color);
  text-decoration: none;
}

/* Navigation */
.navbar ul {
  display: flex;
  list-style: none;
  gap: 2rem;
  align-items: center;
}

.nav-link {
  color: var(--text-dark);
  text-decoration: none;
  font-weight: 500;
  transition: var(--transition);
  position: relative;
}

.nav-link:hover,
.nav-link.active {
  color: var(--primary-color);
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 0;
  width: 0;
  height: 2px;
  background: var(--primary-color);
  transition: var(--transition);
}

.nav-link:hover::after,
.nav-link.active::after {
  width: 100%;
}

/* Hero Section */
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
  color: var(--white);
  text-align: center;
  position: relative;
  overflow: hidden;
}

.hero h1 {
  font-size: 3.5rem;
  margin-bottom: 1.5rem;
  animation: fadeInUp 1s ease;
}

.hero h2 {
  font-size: 1.25rem;
  font-weight: 400;
  margin-bottom: 2rem;
  opacity: 0.9;
  animation: fadeInUp 1s ease 0.2s both;
}

/* Buttons */
.btn-get-started {
  display: inline-block;
  background: var(--white);
  color: var(--primary-color);
  padding: 1rem 2rem;
  border-radius: 50px;
  text-decoration: none;
  font-weight: 600;
  transition: var(--transition);
  box-shadow: var(--shadow);
  animation: fadeInUp 1s ease 0.4s both;
}

.btn-get-started:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 35px -3px rgba(0, 0, 0, 0.2);
}

/* Sections */
section {
  padding: 5rem 0;
}

.section-header {
  text-align: center;
  margin-bottom: 3rem;
}

.section-header h2 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.section-header p {
  font-size: 1.125rem;
  color: var(--text-light);
}

/* Cards */
.feature-card,
.testimonial-item {
  background: var(--white);
  border-radius: 15px;
  padding: 2rem;
  box-shadow: var(--shadow);
  transition: var(--transition);
  height: 100%;
}

.feature-card:hover,
.testimonial-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 20px 35px -3px rgba(0, 0, 0, 0.15);
}

/* Grid Layouts */
.features-grid,
.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-top: 3rem;
}

/* Animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Loading Spinner */
#loading-spinner {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--white);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid var(--bg-light);
  border-top: 4px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Responsive Design */
@media (max-width: 768px) {
  .hero h1 { font-size: 2.5rem; }
  .hero h2 { font-size: 1rem; }
  
  .navbar ul {
    display: none;
  }
  
  .mobile-nav-toggle {
    display: block;
  }
  
  .features-grid,
  .testimonials-grid {
    grid-template-columns: 1fr;
  }
}

/* Utility Classes */
.d-flex { display: flex; }
.align-items-center { align-items: center; }
.justify-content-between { justify-content: space-between; }
.text-center { text-align: center; }
.mt-3 { margin-top: 1rem; }
.mb-3 { margin-bottom: 1rem; }
.w-100 { width: 100%; }
.h-100 { height: 100%; }`;
  }

  private static generateBasicJS(): string {
    return `// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize AOS if available
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            easing: 'ease-in-out',
            once: true,
            mirror: false
        });
    }

    // Initialize PureCounter if available
    if (typeof PureCounter !== 'undefined') {
        new PureCounter();
    }

    // Hide loading spinner
    const loadingSpinner = document.getElementById('loading-spinner');
    if (loadingSpinner) {
        setTimeout(() => {
            loadingSpinner.style.opacity = '0';
            setTimeout(() => {
                loadingSpinner.style.display = 'none';
            }, 300);
        }, 500);
    }

    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('.nav-link.scrollto, .btn-get-started.scrollto');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    const offsetTop = target.offsetTop - 80; // Account for fixed header
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // Mobile navigation toggle
    const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
    const navbar = document.querySelector('.navbar ul');
    
    if (mobileNavToggle && navbar) {
        mobileNavToggle.addEventListener('click', function() {
            navbar.classList.toggle('active');
            this.classList.toggle('active');
        });
    }

    // Header scroll effect
    const header = document.querySelector('.header');
    if (header) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 100) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // Back to top button
    const backToTop = document.querySelector('.back-to-top');
    if (backToTop) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 300) {
                backToTop.style.display = 'flex';
            } else {
                backToTop.style.display = 'none';
            }
        });

        backToTop.addEventListener('click', function(e) {
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // Form handling
    const contactForm = document.querySelector('.php-email-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const loading = this.querySelector('.loading');
            const errorMessage = this.querySelector('.error-message');
            const sentMessage = this.querySelector('.sent-message');
            
            // Hide all messages
            if (loading) loading.style.display = 'none';
            if (errorMessage) errorMessage.style.display = 'none';
            if (sentMessage) sentMessage.style.display = 'none';
            
            // Show loading
            if (loading) loading.style.display = 'block';
            
            // Simulate form submission
            setTimeout(() => {
                if (loading) loading.style.display = 'none';
                if (sentMessage) sentMessage.style.display = 'block';
                
                // Reset form
                this.reset();
                
                // Hide success message after 5 seconds
                setTimeout(() => {
                    if (sentMessage) sentMessage.style.display = 'none';
                }, 5000);
            }, 2000);
        });
    }

    // Gallery lightbox functionality
    const galleryItems = document.querySelectorAll('.gallery-item img');
    galleryItems.forEach(item => {
        item.addEventListener('click', function() {
            // Simple lightbox implementation
            const overlay = document.createElement('div');
            overlay.style.cssText = \`
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
            \`;
            
            const img = document.createElement('img');
            img.src = this.src;
            img.style.cssText = \`
                max-width: 90%;
                max-height: 90%;
                object-fit: contain;
            \`;
            
            overlay.appendChild(img);
            document.body.appendChild(overlay);
            
            overlay.addEventListener('click', function() {
                document.body.removeChild(overlay);
            });
        });
    });

    // Active navigation highlighting
    const sections = document.querySelectorAll('section[id]');
    const navItems = document.querySelectorAll('.nav-link');
    
    function highlightNav() {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            if (window.scrollY >= sectionTop) {
                current = section.getAttribute('id');
            }
        });
        
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === '#' + current) {
                item.classList.add('active');
            }
        });
    }
    
    window.addEventListener('scroll', highlightNav);
    highlightNav(); // Initial call
});

// Particle effect for hero section (optional)
function createParticles() {
    const particlesContainer = document.querySelector('.particles-container');
    if (!particlesContainer) return;
    
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = \`
            position: absolute;
            width: 2px;
            height: 2px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            animation: float \${Math.random() * 3 + 2}s infinite ease-in-out;
            left: \${Math.random() * 100}%;
            top: \${Math.random() * 100}%;
        \`;
        particlesContainer.appendChild(particle);
    }
}

// Add particle animation CSS
const style = document.createElement('style');
style.textContent = \`
@keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-20px) rotate(180deg); }
}
\`;
document.head.appendChild(style);

// Create particles on load
createParticles();`;
  }

  private static ensureAllRequiredFiles(files: Array<{path: string, content: string, type: 'html' | 'css' | 'js' | 'json'}>): Array<{path: string, content: string, type: 'html' | 'css' | 'js' | 'json'}> {
    const fileMap = new Map(files.map(f => [f.path, f]));
    
    // Ensure HTML file exists
    if (!fileMap.has('index.html')) {
      fileMap.set('index.html', {
        path: 'index.html',
        content: '<!DOCTYPE html><html><head><title>Generated Page</title><link rel="stylesheet" href="styles.css"></head><body><h1>Welcome</h1><script src="script.js"></script></body></html>',
        type: 'html'
      });
    }
    
    // Ensure CSS file exists
    if (!fileMap.has('styles.css')) {
      fileMap.set('styles.css', {
        path: 'styles.css',
        content: this.generateBasicCSS(),
        type: 'css'
      });
    }
    
    // Ensure JS file exists
    if (!fileMap.has('script.js')) {
      fileMap.set('script.js', {
        path: 'script.js',
        content: this.generateBasicJS(),
        type: 'js'
      });
    }
    
    return Array.from(fileMap.values());
  }
}