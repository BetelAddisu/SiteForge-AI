// ============================================================================
// SiteForge AI - Type Definitions
// ============================================================================

// Content Generation Mode
export type ContentMode = 'strict' | 'professional' | 'creative' | 'custom';

export interface ContentPreferences {
  mode: ContentMode;
  brandStory: boolean;
  missionStatement: boolean;
  visionStatement: boolean;
  valuePropositions: boolean;
  marketingHeadlines: boolean;
  serviceDescriptions: boolean;
  faq: boolean;
  ctaSections: boolean;
  portfolioDescriptions: boolean;
  teamDescriptions: boolean;
  testimonials: 'ai' | 'user' | 'none';
  clientLogos: 'placeholder' | 'upload' | 'user';
  statistics: 'ai' | 'user' | 'none';
  achievements: boolean;
  certifications: boolean;
  awards: boolean;
  trustBadges: boolean;
  caseStudies: boolean;
  blogPosts: boolean;
  pricingTables: boolean;
  companyTimeline: boolean;
  processSection: boolean;
  founderStory: boolean;
}

// Website Features
export interface WebsiteFeatures {
  blog: boolean;
  portfolio: boolean;
  testimonials: boolean;
  team: boolean;
  faq: boolean;
  careers: boolean;
  pricing: boolean;
  booking: boolean;
  contactForms: boolean;
  newsletter: boolean;
  liveChat: boolean;
  whatsapp: boolean;
  messenger: boolean;
  socialFeed: boolean;
  instagramGallery: boolean;
  youtubeGallery: boolean;
  googleMaps: boolean;
  googleReviews: boolean;
  clientLogos: boolean;
  downloads: boolean;
  events: boolean;
  shop: boolean;
  membership: boolean;
  dashboard: boolean;
  multiLanguage: boolean;
  darkMode: boolean;
  search: boolean;
  accessibility: boolean;
  cookieBanner: boolean;
  analytics: boolean;
  seoOptimization: boolean;
}

// Design Preferences
export interface DesignPreferences {
  style: 'minimal' | 'luxury' | 'corporate' | 'editorial' | 'creative' | 'glassmorphism' | 'geometric' | 'modern' | 'futuristic';
  animationLevel: 'none' | 'minimal' | 'moderate' | 'premium';
  visualDensity: 'spacious' | 'balanced' | 'dense';
  roundedCorners: 'sharp' | 'slight' | 'rounded' | 'fully-rounded';
  glassEffects: boolean;
  gradientBackgrounds: boolean;
  threeDElements: boolean;
  parallax: boolean;
  microAnimations: boolean;
  premiumScrollEffects: boolean;
}

// Color Management
export interface ColorPalette {
  id: string;
  name: string;
  colors: BrandColor[];
  isDefault: boolean;
  createdAt: string;
}

export interface BrandColor {
  id: string;
  name: string;
  hex: string;
  type: 'primary' | 'secondary' | 'accent' | 'neutral' | 'custom';
}

// Font Management
export interface FontConfig {
  id: string;
  family: string;
  source: 'google' | 'local' | 'uploaded';
  variants: string[];
  weights: number[];
  heading?: boolean;
  body?: boolean;
  button?: boolean;
  navigation?: boolean;
}

// Logo Data
export interface LogoData {
  id: string;
  url: string;
  filename: string;
  dominantColors: string[];
  suggestedPalettes: ColorPalette[];
  favicon?: string;
  darkVariant?: string;
  lightVariant?: string;
}

// Project
export interface Project {
  id: string;
  userId: string;
  businessName: string;
  industry: string;
  description: string;
  website?: string;
  services: string[];
  mainService: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  stylePreset: string;
  primaryColor: string;
  secondaryColor: string;
  logo?: LogoData;
  socialLinks: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
  contentPreferences?: ContentPreferences;
  websiteFeatures?: WebsiteFeatures;
  designPreferences?: DesignPreferences;
  colorPalettes?: ColorPalette[];
  fontConfigs?: FontConfig[];
  status: 'draft' | 'generating' | 'preview' | 'published' | 'failed';
  wordpressUrl?: string;
  wordpressPageId?: string;
  createdAt: string;
  updatedAt: string;
}

// Template Section
export interface TemplateSection {
  id: string;
  templateId: string;
  type: string;
  name: string;
  category: string;
  industry?: string;
  style?: string;
  widgets: string[];
  colors: string[];
  fonts: string[];
  animations: string[];
  content: Record<string, unknown>;
  previewImage?: string;
  compatibilityScore: number;
  tags: string[];
}

// WordPress Connection
export interface WordPressConnection {
  id: string;
  url: string;
  username: string;
  applicationPassword: string;
  isConnected: boolean;
  testedAt?: string;
}
