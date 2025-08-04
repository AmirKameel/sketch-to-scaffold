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
    'gemini': 'AIzaSyCdN7JK1hpDaziMTfqY8V6GcYq00ufd-UI',
    'clarifai': 'a859318378284560beec23442a19ba57'
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

      let response: GenerationResponse;
      switch (request.model.provider) {
        case 'gemini':
          response = await this.generateWithGemini(request, apiKey);
          break;
        case 'openai':
          response = await this.generateWithOpenAI(request, apiKey);
          break;
        case 'claude':
          response = await this.generateWithClaude(request, apiKey);
          break;
        default:
          throw new Error(`Unsupported provider: ${request.model.provider}`);
      }

      // Validate and complete if necessary
      if (response.success && request.projectType === 'single-page') {
        response = await this.ensureCompleteGeneration(response, request, apiKey);
      }

      return response;
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
        maxOutputTokens: 8192, // Use maximum tokens for complete generation
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

    return `You are an EXTRAORDINARY web designer creating MIND-BLOWING, UNIQUE websites that make competitors jealous and visitors say "WOW!"

${request.prompt}

${isScreenshot ? `
SCREENSHOT ANALYSIS INSTRUCTIONS:
- Analyze every detail: layout, colors, typography, spacing, components
- Recreate the exact visual design but make it 10x more impressive
- Extract all text and enhance the design with modern effects
- Identify interactive elements and add stunning animations
` : ''}

CRITICAL REQUIREMENTS:
1. Generate ${isMultiPage ? 'MULTIPLE HTML pages with navigation between them' : 'ONE COMPLETE SINGLE-PAGE website with ALL sections'}
2. Use ONLY INLINE TAILWIND CSS - no separate CSS files
3. Include Tailwind CSS CDN: <script src="https://cdn.tailwindcss.com"></script>
4. Embed JavaScript directly in HTML using <script> tags
5. Use relevant Unsplash images with proper URLs
6. ${isMultiPage ? 'Each page must be complete' : 'The single page MUST include ALL sections - do not cut off early!'}

OUTPUT FORMAT (MANDATORY):
Return only valid JSON in this exact format:
{
  "files": [
    {
      "path": "index.html",
      "content": "Complete HTML with inline Tailwind - MUST include ALL sections"
    }${isMultiPage ? `,
    {
      "path": "about.html", 
      "content": "Complete HTML with inline Tailwind"
    },
    {
      "path": "services.html",
      "content": "Complete HTML with inline Tailwind"  
    },
    {
      "path": "contact.html",
      "content": "Complete HTML with inline Tailwind"
    }` : ''}
  ]
}

DESIGN REQUIREMENTS - MAKE IT ABSOLUTELY STUNNING:
- UNIQUE, CREATIVE layouts that stand out from competitors
- ADVANCED Tailwind CSS techniques: gradients, shadows, transforms, animations
- IMPRESSIVE visual effects: parallax, morphing elements, dynamic backgrounds
- MODERN glass-morphism, neumorphism, or cutting-edge design trends
- SMOOTH animations using Tailwind's animate classes and custom CSS animations
- INTERACTIVE elements with hover effects, transitions, and micro-interactions
- BEAUTIFUL color combinations with gradients and transparency
- CREATIVE use of spacing, typography, and visual hierarchy
- UNIQUE navigation patterns and layouts
- EYE-CATCHING hero sections with dynamic elements
- INNOVATIVE card designs and section layouts
- RESPONSIVE design that looks amazing on all devices

UNSPLASH IMAGE INTEGRATION:
- Use specific, relevant Unsplash image URLs
- Choose images that perfectly match the content context and positioning
- Use high-quality, professional images that enhance the design
- Format: https://images.unsplash.com/photo-[id]?w=1200&h=800&fit=crop

${isMultiPage ? `MULTI-PAGE STRUCTURE:
Create 4-6 stunning HTML pages with consistent navigation:

1. INDEX.HTML (Homepage):
   - Hero section with dynamic animations and parallax effects
   - Company overview with stunning visuals
   - Featured services/products showcase
   - Latest news/updates section
   - Multiple call-to-action sections

2. ABOUT.HTML:
   - Company story with animated timeline
   - Team members with interactive hover cards
   - Mission, vision, values sections
   - Company achievements and awards showcase

3. SERVICES.HTML (or PRODUCTS.HTML):
   - Service/product grid with stunning hover effects
   - Detailed descriptions with modal popups
   - Animated pricing tables
   - Case studies and portfolio examples

4. CONTACT.HTML:
   - Interactive contact form with validation
   - Office locations with embedded maps
   - Team contact information cards
   - Social media integration and links` : `SINGLE-PAGE STRUCTURE (ALL SECTIONS REQUIRED - NO EXCEPTIONS):
Create ONE COMPLETE HTML page with ALL these sections in order:

1. HEADER/NAVIGATION (Fixed with smooth scroll):
   - Logo and branding
   - Navigation menu with smooth scroll links
   - Mobile responsive hamburger menu
   - Call-to-action button in header

2. HERO SECTION (Eye-catching and dynamic):
   - Stunning animated background
   - Compelling headline and subtext
   - Multiple call-to-action buttons
   - Visual elements and animations

3. ABOUT/COMPANY SECTION (Story and mission):
   - Company overview and story
   - Mission, vision, values
   - Key differentiators
   - Visual elements and animations

4. SERVICES/FEATURES SECTION (Core offerings):
   - Grid of services/features with icons
   - Hover effects and animations
   - Detailed descriptions
   - Pricing or packages if applicable

5. TESTIMONIALS/REVIEWS SECTION (Social proof):
   - Customer testimonials with photos
   - Star ratings and quotes
   - Multiple testimonials in grid or carousel

6. PORTFOLIO/GALLERY SECTION (Showcase work):
   - Gallery of work/products/achievements
   - Image grid with hover effects
   - Case studies or examples

7. STATS/ACHIEVEMENTS SECTION (Credibility):
   - Animated counter numbers
   - Key metrics and achievements
   - Visual progress indicators

8. CONTACT SECTION (Lead generation):
   - Contact form with validation
   - Contact information and details
   - Map or location info
   - Social media links

9. FOOTER (Complete site links):
   - Company information
   - Quick navigation links
   - Legal pages links
   - Copyright and social media

CRITICAL: You MUST include ALL 9 sections above. Do not stop early or skip sections!`}

TAILWIND CSS REQUIREMENTS:
- Use advanced Tailwind classes: backdrop-blur, bg-gradient-to-*, transform, transition-all
- Implement responsive design with sm:, md:, lg:, xl: prefixes
- Use Tailwind's animation classes: animate-pulse, animate-bounce, animate-fade-in
- Create custom animations with CSS when needed
- Use proper color palettes and semantic naming

GENERATION RULES:
- Generate the COMPLETE page in one response
- If approaching token limits, prioritize essential content but include ALL sections
- Use concise but impactful copy
- Focus on visual impact over verbose descriptions
- Ensure proper HTML structure with DOCTYPE, head, and body tags
- Include proper meta tags for SEO

Never include any explanations, comments, or text outside the JSON. Only return the valid JSON with the HTML files containing inline Tailwind CSS and embedded JavaScript.`;
  }

  private static async enhanceWithImages(content: string, request: GenerationRequest): Promise<GenerationResponse> {
    try {
      const response = this.parseGeneratedContent(content);
      
      if (!response.success) {
        return response;
      }

      // Generate AI images for better visual impact
      const enhancedFiles = await Promise.all(response.files.map(async (file) => {
        if (file.type === 'html') {
          let enhancedContent = file.content;
          
          // Identify sections that need images
          const sections = this.identifyImageSections(enhancedContent, request.prompt);
          
          // Generate contextual images using Clarifai
          for (const section of sections) {
            try {
              const imageUrl = await this.generateContextualImage(section.prompt, request.prompt);
              if (imageUrl) {
                enhancedContent = enhancedContent.replace(
                  section.placeholder,
                  `<img src="${imageUrl}" alt="${section.alt}" class="${section.classes}" loading="lazy" />`
                );
              }
            } catch (error) {
              console.warn(`Failed to generate image for ${section.type}:`, error);
              // Fallback to Unsplash if Clarifai fails
              const fallbackImages = await UnsplashService.getContextualImages(request.prompt, [section.type]);
              if (fallbackImages[section.type]?.length > 0) {
                const image = fallbackImages[section.type][0];
                enhancedContent = enhancedContent.replace(
                  section.placeholder,
                  UnsplashService.getImageMarkup(image, section.alt, section.classes)
                );
              }
            }
          }
          
          return { ...file, content: enhancedContent };
        }
        return file;
      }));

      return {
        success: true,
        files: enhancedFiles,
        pages: response.pages
      };
    } catch (error) {
      console.error('Error enhancing with images:', error);
      // Return original response if image enhancement fails
      const fallbackResponse = this.parseGeneratedContent(content);
      return fallbackResponse;
    }
  }

  private static identifyImageSections(content: string, userPrompt: string): Array<{
    type: string;
    prompt: string;
    placeholder: string;
    alt: string;
    classes: string;
  }> {
    const sections = [];
    
    // Hero section images
    if (content.includes('hero') || content.includes('Hero')) {
      sections.push({
        type: 'hero',
        prompt: `A stunning hero image for ${userPrompt}, professional, high-quality, modern design`,
        placeholder: /src="https:\/\/images\.unsplash\.com\/[^"]*"/g,
        alt: 'Hero background image',
        classes: 'w-full h-full object-cover'
      });
    }
    
    // About section images
    if (content.includes('about') || content.includes('About')) {
      sections.push({
        type: 'about',
        prompt: `Professional team or company image for ${userPrompt}, business environment, modern office`,
        placeholder: /src="https:\/\/images\.unsplash\.com\/[^"]*"/g,
        alt: 'About us image',
        classes: 'w-full h-64 object-cover rounded-lg'
      });
    }
    
    // Services section images
    if (content.includes('service') || content.includes('Service')) {
      sections.push({
        type: 'services',
        prompt: `Services illustration for ${userPrompt}, professional, clean, modern technology`,
        placeholder: /src="https:\/\/images\.unsplash\.com\/[^"]*"/g,
        alt: 'Services image',
        classes: 'w-full h-48 object-cover rounded-lg'
      });
    }
    
    // Portfolio/gallery images
    if (content.includes('portfolio') || content.includes('gallery') || content.includes('work')) {
      sections.push({
        type: 'portfolio',
        prompt: `Portfolio showcase for ${userPrompt}, creative work, professional presentation`,
        placeholder: /src="https:\/\/images\.unsplash\.com\/[^"]*"/g,
        alt: 'Portfolio image',
        classes: 'w-full h-64 object-cover rounded-lg hover:scale-105 transition-transform duration-300'
      });
    }
    
    return sections;
  }

  private static async generateContextualImage(imagePrompt: string, userContext: string): Promise<string | null> {
    try {
      const apiKey = this.getApiKey('clarifai');
      if (!apiKey) {
        console.warn('Clarifai API key not found, falling back to Unsplash');
        return null;
      }

      const response = await fetch('https://api.clarifai.com/v2/users/stability-ai/apps/stable-diffusion-2/models/stable-diffusion-xl/versions/68eeab068a5e4488a685fc67bc7ba71e/outputs', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: [{
            data: {
              text: {
                raw: `${imagePrompt}, ultra high quality, professional photography, 4K resolution, perfect lighting`
              }
            }
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Clarifai API error: ${response.statusText}`);
      }

      const data = await response.json();
      const imageUrl = data.outputs?.[0]?.data?.image?.url;
      
      if (!imageUrl) {
        throw new Error('No image URL in Clarifai response');
      }

      return imageUrl;
    } catch (error) {
      console.error('Clarifai image generation failed:', error);
      return null;
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

  private static parseWithRegex(content: string): any {
    console.log('Using regex fallback parser...');
    
    const files = [];
    
    // Try to parse HTML files directly from JSON structure
    const htmlFileMatches = content.matchAll(/"path":\s*"(\w+\.html)"[\s\S]*?"content":\s*"([\s\S]*?)"\s*(?=}|\],)/g);
    
    for (const match of htmlFileMatches) {
      const filename = match[1];
      let htmlContent = match[2];
      
      // Unescape the content
      htmlContent = htmlContent
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
      
      if (htmlContent.length > 100) { // Only if we have substantial content
        files.push({
          path: filename,
          content: htmlContent,
          type: 'html'
        });
      }
    }

    // If regex parsing failed, try simpler extraction
    if (files.length === 0) {
      const htmlMatches = content.match(/<!DOCTYPE html[\s\S]*?<\/html>/gi);
      if (htmlMatches && htmlMatches.length > 0) {
        htmlMatches.forEach((html, index) => {
          const filename = index === 0 ? 'index.html' : `page${index + 1}.html`;
          files.push({
            path: filename,
            content: html,
            type: 'html'
          });
        });
      }
    }

    return {
      files,
      pages: files.map(f => f.path)
    };
  }

  private static createFallbackContent(content: string): GenerationResponse {
    // Last resort: create a basic HTML file if we can find any meaningful content
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
        }
      }
    }
    
    return {
      success: files.length > 0,
      files,
      pages: files.length > 0 ? ['index.html'] : []
    };
  }

  private static async ensureCompleteGeneration(response: GenerationResponse, request: GenerationRequest, apiKey: string): Promise<GenerationResponse> {
    const maxRetries = 3;
    let currentResponse = response;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const validation = this.validateSinglePageContent(currentResponse);
      
      if (validation.isComplete) {
        console.log('Content generation is complete with all required sections');
        return currentResponse;
      }
      
      console.log(`Content incomplete (attempt ${attempt + 1}/${maxRetries}). Missing sections:`, validation.missingSections);
      
      // Generate continuation
      const continuationRequest: GenerationRequest = {
        ...request,
        prompt: this.buildContinuationPrompt(request.prompt, validation.lastSection, validation.missingSections, currentResponse.files[0]?.content || '')
      };
      
      try {
        const continuationResponse = await this.generateWithGemini(continuationRequest, apiKey);
        
        if (continuationResponse.success && continuationResponse.files.length > 0) {
          // Merge the new content with existing content
          currentResponse = this.mergeContent(currentResponse, continuationResponse, validation.lastSection);
          
          // Update progress callback if available
          if (request.onProgress) {
            request.onProgress(currentResponse.files[0]?.content || '', false);
          }
        } else {
          console.warn('Failed to generate continuation content');
          break;
        }
      } catch (error) {
        console.error('Error generating continuation:', error);
        break;
      }
    }
    
    // Final validation and progress callback
    if (request.onProgress) {
      const finalValidation = this.validateSinglePageContent(currentResponse);
      request.onProgress(currentResponse.files[0]?.content || '', finalValidation.isComplete);
    }
    
    return currentResponse;
  }

  private static validateSinglePageContent(response: GenerationResponse): { isComplete: boolean; missingSections: string[]; lastSection: string } {
    if (!response.success || response.files.length === 0) {
      return { isComplete: false, missingSections: ['all'], lastSection: 'none' };
    }
    
    const htmlContent = response.files[0].content;
    
    // Required sections for single-page websites
    const requiredSections = [
      { id: 'header', patterns: ['<header', 'id="header"', 'class=".*header'] },
      { id: 'hero', patterns: ['id="hero"', 'hero', 'class=".*hero'] },
      { id: 'about', patterns: ['id="about"', 'about', 'class=".*about'] },
      { id: 'services', patterns: ['id="services"', 'id="features"', 'services', 'features'] },
      { id: 'testimonials', patterns: ['id="testimonials"', 'testimonial', 'class=".*testimonial'] },
      { id: 'portfolio', patterns: ['id="portfolio"', 'id="gallery"', 'portfolio', 'gallery', 'class=".*portfolio', 'class=".*gallery'] },
      { id: 'stats', patterns: ['id="stats"', 'id="achievements"', 'stats', 'achievements', 'counter'] },
      { id: 'contact', patterns: ['id="contact"', 'contact', 'class=".*contact'] },
      { id: 'footer', patterns: ['<footer', 'id="footer"', 'class=".*footer'] }
    ];
    
    const missingSections: string[] = [];
    let lastFoundSection = 'header';
    
    for (const section of requiredSections) {
      const hasSection = section.patterns.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(htmlContent);
      });
      
      if (hasSection) {
        lastFoundSection = section.id;
      } else {
        missingSections.push(section.id);
      }
    }
    
    // Check if HTML is properly closed
    const hasClosingHtml = /<\/html>/i.test(htmlContent);
    const hasClosingBody = /<\/body>/i.test(htmlContent);
    
    const isComplete = missingSections.length === 0 && hasClosingHtml && hasClosingBody;
    
    return {
      isComplete,
      missingSections,
      lastSection: lastFoundSection
    };
  }

  private static buildContinuationPrompt(originalPrompt: string, lastSection: string, missingSections: string[], existingContent: string): string {
    const sectionMap: Record<string, string> = {
      'testimonials': 'TESTIMONIALS/REVIEWS SECTION',
      'portfolio': 'PORTFOLIO/GALLERY SECTION', 
      'stats': 'STATS/ACHIEVEMENTS SECTION',
      'contact': 'CONTACT SECTION',
      'footer': 'FOOTER'
    };
    
    const nextSections = missingSections.map(section => sectionMap[section] || section.toUpperCase()).join(', ');
    
    return `CONTINUE the website generation from where it left off. You are completing a single-page website.

ORIGINAL REQUEST: ${originalPrompt}

CURRENT STATUS: The website generation stopped after the ${lastSection.toUpperCase()} section. 

MISSING SECTIONS TO COMPLETE: ${nextSections}

CRITICAL REQUIREMENTS:
1. Generate ONLY the missing sections listed above
2. Start immediately with the next section after ${lastSection.toUpperCase()}
3. Use ONLY INLINE TAILWIND CSS - no separate CSS files
4. Maintain consistent design with the existing content
5. End with proper closing tags: </main>, </body>, </html>

OUTPUT FORMAT (MANDATORY):
Return only valid JSON in this exact format:
{
  "files": [
    {
      "path": "index.html",
      "content": "HTML content for the missing sections ONLY - starting from the next section"
    }
  ]
}

CONTINUE WITH THESE SECTIONS IN ORDER:
${missingSections.includes('testimonials') ? `
5. TESTIMONIALS/REVIEWS SECTION (Social proof):
   - Customer testimonials with photos
   - Star ratings and quotes
   - Multiple testimonials in grid or carousel
` : ''}

${missingSections.includes('portfolio') ? `
6. PORTFOLIO/GALLERY SECTION (Showcase work):
   - Gallery of work/products/achievements
   - Image grid with hover effects
   - Case studies or examples
` : ''}

${missingSections.includes('stats') ? `
7. STATS/ACHIEVEMENTS SECTION (Credibility):
   - Animated counter numbers
   - Key metrics and achievements
   - Visual progress indicators
` : ''}

${missingSections.includes('contact') ? `
8. CONTACT SECTION (Lead generation):
   - Contact form with validation
   - Contact information and details
   - Map or location info
   - Social media links
` : ''}

${missingSections.includes('footer') ? `
9. FOOTER (Complete site links):
   - Company information
   - Quick navigation links
   - Legal pages links
   - Copyright and social media

    </main>

    <!-- JavaScript for interactivity -->
    <script>
        // Add necessary JavaScript for animations, form handling, mobile menu, etc.
    </script>

</body>
</html>
` : ''}

Generate STUNNING, UNIQUE designs that make competitors jealous. Use advanced Tailwind CSS techniques and beautiful animations.

Never include any explanations, comments, or text outside the JSON. Only return the valid JSON with the HTML content for the missing sections.`;
  }

  private static mergeContent(existingResponse: GenerationResponse, continuationResponse: GenerationResponse, lastSection: string): GenerationResponse {
    if (!existingResponse.files[0] || !continuationResponse.files[0]) {
      return existingResponse;
    }
    
    let existingContent = existingResponse.files[0].content;
    const continuationContent = continuationResponse.files[0].content;
    
    // Remove any HTML structure from continuation (DOCTYPE, html, head, body opening tags)
    let cleanContinuation = continuationContent
      .replace(/<!DOCTYPE[^>]*>/i, '')
      .replace(/<html[^>]*>/i, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/i, '')
      .replace(/<body[^>]*>/i, '')
      .replace(/<main[^>]*>/i, '')
      .trim();
    
    // Find the insertion point in existing content
    const insertionPatterns = [
      /<\/main>/i,
      /<\/body>/i,
      /<\/html>/i,
      /$/
    ];
    
    let insertionPoint = -1;
    for (const pattern of insertionPatterns) {
      insertionPoint = existingContent.search(pattern);
      if (insertionPoint !== -1) {
        break;
      }
    }
    
    if (insertionPoint === -1) {
      // If no insertion point found, append to the end
      insertionPoint = existingContent.length;
    }
    
    // Insert the continuation content
    const beforeInsertion = existingContent.substring(0, insertionPoint);
    const afterInsertion = existingContent.substring(insertionPoint);
    
    const mergedContent = beforeInsertion + '\n\n' + cleanContinuation + '\n\n' + afterInsertion;
    
    return {
      ...existingResponse,
      files: [{
        ...existingResponse.files[0],
        content: mergedContent
      }]
    };
  }
}