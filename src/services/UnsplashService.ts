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
    
    // Analyze content to determine website type
    const contentLower = websiteContent.toLowerCase();
    let websiteType = 'business';
    
    if (contentLower.includes('restaurant') || contentLower.includes('food') || contentLower.includes('menu')) {
      websiteType = 'restaurant';
    } else if (contentLower.includes('portfolio') || contentLower.includes('creative') || contentLower.includes('design')) {
      websiteType = 'portfolio';
    } else if (contentLower.includes('tech') || contentLower.includes('software') || contentLower.includes('app')) {
      websiteType = 'technology';
    } else if (contentLower.includes('fashion') || contentLower.includes('clothing') || contentLower.includes('style')) {
      websiteType = 'fashion';
    } else if (contentLower.includes('travel') || contentLower.includes('tourism') || contentLower.includes('hotel')) {
      websiteType = 'travel';
    } else if (contentLower.includes('fitness') || contentLower.includes('gym') || contentLower.includes('health')) {
      websiteType = 'fitness';
    }

    // Get images for each section
    for (const section of sectionsNeeded) {
      try {
        let query = '';
        
        if (section === 'hero') {
          query = `${websiteType} hero modern professional`;
        } else if (section === 'about') {
          query = `${websiteType} team professional`;
        } else if (section === 'services' || section === 'features') {
          query = `${websiteType} service professional`;
        } else if (section === 'gallery' || section === 'portfolio') {
          query = `${websiteType} gallery showcase`;
        } else {
          query = `${websiteType} ${section} professional`;
        }

        const images = await this.searchImages(query, 2);
        imageMap[section] = images;
      } catch (error) {
        console.error(`Error fetching images for section ${section}:`, error);
        imageMap[section] = [];
      }
    }

    return imageMap;
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