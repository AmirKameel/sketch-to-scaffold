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
    const imageMap: Record<string, UnsplashImage[]> = {};
    
    // Enhanced content analysis with keyword extraction
    const contentLower = websiteContent.toLowerCase();
    const keywords = this.extractKeywords(websiteContent);
    const businessType = this.detectBusinessType(contentLower, keywords);
    const tone = this.detectTone(contentLower);
    
    console.log('Detected business type:', businessType);
    console.log('Extracted keywords:', keywords);
    console.log('Detected tone:', tone);

    // Get images for each section with enhanced context
    for (const section of sectionsNeeded) {
      try {
        const query = this.buildSmartQuery(section, businessType, keywords, tone, contentLower);
        console.log(`Query for ${section}:`, query);
        
        const images = await this.searchImages(query, 3);
        imageMap[section] = images;
      } catch (error) {
        console.error(`Error fetching images for section ${section}:`, error);
        imageMap[section] = [];
      }
    }

    return imageMap;
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

  private static buildSmartQuery(section: string, businessType: string, keywords: string[], tone: string, fullContent: string): string {
    // Extract section-specific context from the full content
    const sectionContext = this.extractSectionContext(section, fullContent);
    
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
    const lines = content.split('\n');
    let sectionContext = '';
    
    // Look for lines that mention the section name and extract surrounding context
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(section)) {
        // Get context from the line and nearby lines
        const contextLines = lines.slice(Math.max(0, index - 1), index + 2);
        const context = contextLines.join(' ').toLowerCase();
        
        // Extract meaningful words from context
        const words = context.split(/\s+/).filter(word => 
          word.length > 3 && 
          !['this', 'that', 'with', 'have', 'will', 'from', 'section'].includes(word)
        );
        
        if (words.length > 0) {
          sectionContext = words.slice(0, 3).join(' ');
        }
      }
    });
    
    return sectionContext;
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