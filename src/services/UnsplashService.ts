export interface UnsplashImage {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  alt_description: string;
  description: string;
  user: {
    name: string;
    username: string;
  };
}

export interface UnsplashSearchResponse {
  results: UnsplashImage[];
  total: number;
  total_pages: number;
}

export class UnsplashService {
  private static readonly ACCESS_KEY = 'LJRrYs6fCK-tsxV_Xx6azh4UWidQVlEQsmpnRkQqrgg';
  private static readonly BASE_URL = 'https://api.unsplash.com';

  static async searchImages(query: string, count: number = 1): Promise<UnsplashImage[]> {
    try {
      const response = await fetch(
        `${this.BASE_URL}/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
        {
          headers: {
            'Authorization': `Client-ID ${this.ACCESS_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Unsplash API error: ${response.statusText}`);
      }

      const data: UnsplashSearchResponse = await response.json();
      return data.results;
    } catch (error) {
      console.error('Error fetching images from Unsplash:', error);
      return [];
    }
  }

  static async getImagesByCategory(category: string, count: number = 3): Promise<UnsplashImage[]> {
    const queries = {
      'hero': 'modern website hero abstract',
      'about': 'team professional business',
      'services': 'professional business service',
      'portfolio': 'creative work design',
      'contact': 'office contact professional',
      'testimonials': 'happy people testimonial',
      'team': 'professional team business',
      'gallery': 'creative gallery art',
      'blog': 'reading writing blog',
      'restaurant': 'food restaurant dining',
      'technology': 'technology computer modern',
      'fashion': 'fashion style modern',
      'travel': 'travel destination beautiful',
      'fitness': 'fitness health gym',
      'education': 'education learning study',
      'default': 'modern professional business'
    };

    const query = queries[category as keyof typeof queries] || queries.default;
    return this.searchImages(query, count);
  }

  static async getContextualImages(websiteContent: string, sectionsNeeded: string[]): Promise<Record<string, UnsplashImage[]>> {
    const result: Record<string, UnsplashImage[]> = {};
    
    // Extract context from the website content
    const keywords = this.extractKeywords(websiteContent);
    const businessType = this.detectBusinessType(websiteContent.toLowerCase(), keywords);
    const tone = this.detectTone(websiteContent.toLowerCase());
    
    console.log('Contextual analysis:', { keywords, businessType, tone });
    
    for (const section of sectionsNeeded) {
      try {
        const sectionContext = this.extractSectionContext(section, websiteContent);
        const query = this.buildSmartQuery(section, keywords, businessType, tone, sectionContext);
        
        console.log(`Fetching images for section "${section}" with query: "${query}"`);
        
        // Get more images per section for variety (5-8 depending on section)
        const imageCount = this.getImageCountForSection(section);
        const images = await this.searchImages(query, imageCount);
        
        if (images.length === 0) {
          // Try alternative queries before falling back to categories
          const alternativeQueries = this.generateAlternativeQueries(section, businessType, keywords);
          let foundImages: UnsplashImage[] = [];
          
          for (const altQuery of alternativeQueries) {
            try {
              foundImages = await this.searchImages(altQuery, imageCount);
              if (foundImages.length > 0) break;
            } catch (e) {
              continue;
            }
          }
          
          if (foundImages.length === 0) {
            // Final fallback to category-based search
            const fallbackImages = await this.getImagesByCategory(section, imageCount);
            result[section] = fallbackImages;
          } else {
            result[section] = foundImages;
          }
        } else {
          result[section] = images;
        }
      } catch (error) {
        console.error(`Failed to get images for section ${section}:`, error);
        // Try a simple fallback
        try {
          const fallbackImages = await this.getImagesByCategory(section, this.getImageCountForSection(section));
          result[section] = fallbackImages;
        } catch (fallbackError) {
          console.error(`Fallback also failed for section ${section}:`, fallbackError);
          result[section] = [];
        }
      }
    }
    
    return result;
  }

  private static extractKeywords(content: string): string[] {
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Remove common words and keep meaningful keywords
    const stopWords = ['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'would', 'there', 'could', 'other', 'make', 'what', 'know', 'take', 'than', 'only', 'think', 'also', 'back', 'after', 'first', 'well', 'want', 'give', 'work', 'here', 'should', 'these', 'people', 'website', 'page', 'site', 'create', 'build', 'design'];
    
    const keywords = words
      .filter(word => !stopWords.includes(word))
      .reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    // Return top 10 most frequent meaningful keywords
    return Object.entries(keywords)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private static detectBusinessType(content: string, keywords: string[]): string {
    const businessPatterns = {
      'restaurant': ['restaurant', 'food', 'menu', 'dining', 'cuisine', 'chef', 'kitchen', 'meal', 'pizza', 'burger', 'coffee', 'cafe', 'bar'],
      'fitness': ['fitness', 'gym', 'workout', 'exercise', 'health', 'training', 'muscle', 'weight', 'yoga', 'pilates', 'cardio'],
      'technology': ['tech', 'software', 'app', 'development', 'coding', 'programming', 'digital', 'computer', 'system', 'data', 'ai', 'machine'],
      'fashion': ['fashion', 'clothing', 'style', 'apparel', 'boutique', 'designer', 'trend', 'outfit', 'collection', 'brand'],
      'travel': ['travel', 'tourism', 'hotel', 'vacation', 'trip', 'destination', 'booking', 'resort', 'adventure', 'explore'],
      'education': ['education', 'school', 'learning', 'course', 'student', 'teacher', 'university', 'academic', 'study', 'training'],
      'medical': ['medical', 'health', 'doctor', 'clinic', 'hospital', 'healthcare', 'treatment', 'patient', 'medicine'],
      'real-estate': ['property', 'real', 'estate', 'house', 'home', 'apartment', 'rent', 'buy', 'mortgage', 'investment'],
      'finance': ['finance', 'bank', 'money', 'investment', 'loan', 'credit', 'financial', 'accounting', 'insurance'],
      'creative': ['design', 'creative', 'art', 'portfolio', 'graphic', 'photography', 'artistic', 'visual', 'gallery', 'studio'],
      'automotive': ['car', 'auto', 'vehicle', 'automotive', 'repair', 'service', 'garage', 'mechanic', 'driving'],
      'beauty': ['beauty', 'salon', 'spa', 'skincare', 'makeup', 'cosmetic', 'hair', 'nail', 'massage', 'wellness']
    };

    let maxScore = 0;
    let detectedType = 'business';

    for (const [type, patterns] of Object.entries(businessPatterns)) {
      let score = 0;
      patterns.forEach(pattern => {
        if (content.includes(pattern) || keywords.includes(pattern)) {
          score += content.includes(pattern) ? 2 : 1; // Higher score for direct content match
        }
      });
      
      if (score > maxScore) {
        maxScore = score;
        detectedType = type;
      }
    }

    return detectedType;
  }

  private static detectTone(content: string): string {
    if (content.includes('luxury') || content.includes('premium') || content.includes('elegant')) return 'luxury';
    if (content.includes('modern') || content.includes('sleek') || content.includes('contemporary')) return 'modern';
    if (content.includes('friendly') || content.includes('welcoming') || content.includes('family')) return 'friendly';
    if (content.includes('professional') || content.includes('corporate') || content.includes('business')) return 'professional';
    if (content.includes('fun') || content.includes('exciting') || content.includes('vibrant')) return 'vibrant';
    return 'clean';
  }

  private static getImageCountForSection(section: string): number {
    // Return appropriate number of images based on section type
    const highImageSections = ['gallery', 'portfolio', 'testimonials', 'team', 'products'];
    const mediumImageSections = ['services', 'features', 'about'];
    
    if (highImageSections.some(s => section.toLowerCase().includes(s))) {
      return 8;
    } else if (mediumImageSections.some(s => section.toLowerCase().includes(s))) {
      return 5;
    }
    return 3; // hero, contact, etc.
  }

  private static generateAlternativeQueries(section: string, businessType: string, keywords: string[]): string[] {
    const queries: string[] = [];
    
    // Generic section-based queries
    if (section.includes('hero')) {
      queries.push(`${businessType} banner`, `professional ${businessType}`, keywords.slice(0, 2).join(' '));
    } else if (section.includes('about')) {
      queries.push(`${businessType} team`, `professional workspace`, `office environment`);
    } else if (section.includes('service')) {
      queries.push(`${businessType} work`, `professional service`, keywords[0] || businessType);
    } else if (section.includes('gallery') || section.includes('portfolio')) {
      queries.push(`${businessType} showcase`, `professional work`, `${businessType} examples`);
    } else if (section.includes('team')) {
      queries.push(`professional team`, `business people`, `workplace collaboration`);
    } else if (section.includes('testimonial')) {
      queries.push(`happy customers`, `business success`, `professional meeting`);
    }
    
    // Add fallback queries
    queries.push(businessType, keywords[0] || 'business', 'professional');
    
    return queries.filter(q => q && q.length > 0);
  }

  private static buildSmartQuery(section: string, keywords: string[], businessType: string, tone: string, sectionContext: string): string {
    // Build a highly specific query
    let query = '';
    
    // Start with the most relevant keywords for this section
    const relevantKeywords = keywords.slice(0, 3).join(' ');
    
    if (section === 'hero') {
      query = `${businessType} ${tone} hero banner ${relevantKeywords}`;
    } else if (section === 'about') {
      if (businessType === 'restaurant') query = `restaurant team chef kitchen ${tone}`;
      else if (businessType === 'technology') query = `tech team office modern workspace`;
      else if (businessType === 'fitness') query = `fitness trainer gym equipment ${tone}`;
      else query = `${businessType} team professional ${tone} ${relevantKeywords}`;
    } else if (section === 'services' || section === 'features') {
      if (businessType === 'restaurant') query = `food service dining ${relevantKeywords}`;
      else if (businessType === 'technology') query = `tech service solution digital ${relevantKeywords}`;
      else if (businessType === 'fitness') query = `fitness service workout ${relevantKeywords}`;
      else query = `${businessType} service professional ${relevantKeywords}`;
    } else if (section === 'gallery' || section === 'portfolio') {
      query = `${businessType} showcase gallery ${relevantKeywords} ${tone}`;
    } else if (section === 'contact') {
      query = `${businessType} office location contact ${tone}`;
    } else if (section === 'testimonials') {
      query = `happy customers ${businessType} testimonial ${tone}`;
    } else {
      // For any other section, use context-aware keywords
      query = `${businessType} ${section} ${relevantKeywords} ${tone}`;
    }

    // Add section context if found
    if (sectionContext) {
      query += ` ${sectionContext}`;
    }

    return query.trim();
  }

  private static extractSectionContext(section: string, content: string): string {
    // Look for content related to the specific section
    const sectionRegex = new RegExp(`${section}[^.!?]*[.!?]`, 'gi');
    const matches = content.match(sectionRegex);
    return matches ? matches.join(' ') : '';
  }

  static getImageMarkup(image: UnsplashImage, alt: string = '', className: string = ''): string {
    return `<img 
      src="${image.urls.regular}" 
      alt="${alt || image.alt_description || image.description || 'Image'}"
      class="${className}"
      loading="lazy"
      data-unsplash-id="${image.id}"
      data-photographer="${image.user.name}"
    />`;
  }

  static getOptimizedImageUrl(image: UnsplashImage, width: number, height?: number): string {
    let url = `${image.urls.raw}&w=${width}`;
    if (height) {
      url += `&h=${height}&fit=crop`;
    }
    return url;
  }
}