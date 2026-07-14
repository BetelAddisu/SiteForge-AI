'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Sparkles, FileText, Palette, Layers, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentPreferences, WebsiteFeatures, DesignPreferences } from '@/lib/types';

interface ContentPreferencesProps {
  content: ContentPreferences;
  features: WebsiteFeatures;
  design: DesignPreferences;
  onContentChange: (content: ContentPreferences) => void;
  onFeaturesChange: (features: WebsiteFeatures) => void;
  onDesignChange: (design: DesignPreferences) => void;
}

const CONTENT_MODE_INFO = {
  strict: 'Only uses information explicitly provided by you. No creative additions.',
  professional: 'Writes persuasive marketing copy without inventing facts. (Recommended)',
  creative: 'Tasteful marketing enhancements while avoiding misleading claims.',
  custom: 'You control every content option below.',
};

export function ContentPreferencesEditor({
  content,
  features,
  design,
  onContentChange,
  onFeaturesChange,
  onDesignChange,
}: ContentPreferencesProps) {
  const [activeTab, setActiveTab] = useState('content');

  const updateContent = (updates: Partial<ContentPreferences>) => {
    onContentChange({ ...content, ...updates });
  };

  const updateFeatures = (updates: Partial<WebsiteFeatures>) => {
    onFeaturesChange({ ...features, ...updates });
  };

  const updateDesign = (updates: Partial<DesignPreferences>) => {
    onDesignChange({ ...design, ...updates });
  };

  const setMode = (mode: ContentPreferences['mode']) => {
    const presets: Record<ContentPreferences['mode'], Partial<ContentPreferences>> = {
      strict: {
        mode,
        brandStory: false,
        missionStatement: false,
        visionStatement: false,
        valuePropositions: true,
        marketingHeadlines: true,
        serviceDescriptions: true,
        faq: true,
        ctaSections: true,
        portfolioDescriptions: true,
        teamDescriptions: false,
        testimonials: 'user',
        clientLogos: 'user',
        statistics: 'user',
        achievements: false,
        certifications: false,
        awards: false,
        trustBadges: true,
        caseStudies: false,
        blogPosts: false,
        pricingTables: true,
        companyTimeline: false,
        processSection: true,
        founderStory: false,
      },
      professional: {
        mode,
        brandStory: true,
        missionStatement: true,
        visionStatement: true,
        valuePropositions: true,
        marketingHeadlines: true,
        serviceDescriptions: true,
        faq: true,
        ctaSections: true,
        portfolioDescriptions: true,
        teamDescriptions: true,
        testimonials: 'ai',
        clientLogos: 'placeholder',
        statistics: 'ai',
        achievements: false,
        certifications: false,
        awards: false,
        trustBadges: true,
        caseStudies: false,
        blogPosts: false,
        pricingTables: true,
        companyTimeline: false,
        processSection: true,
        founderStory: true,
      },
      creative: {
        mode,
        brandStory: true,
        missionStatement: true,
        visionStatement: true,
        valuePropositions: true,
        marketingHeadlines: true,
        serviceDescriptions: true,
        faq: true,
        ctaSections: true,
        portfolioDescriptions: true,
        teamDescriptions: true,
        testimonials: 'ai',
        clientLogos: 'placeholder',
        statistics: 'ai',
        achievements: true,
        certifications: true,
        awards: true,
        trustBadges: true,
        caseStudies: true,
        blogPosts: true,
        pricingTables: true,
        companyTimeline: true,
        processSection: true,
        founderStory: true,
      },
      custom: { mode },
    };
    onContentChange({ ...content, ...presets[mode] });
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="content" className="gap-2">
            <FileText className="h-4 w-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="features" className="gap-2">
            <Layers className="h-4 w-4" />
            Features
          </TabsTrigger>
          <TabsTrigger value="design" className="gap-2">
            <Palette className="h-4 w-4" />
            Design
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Summary
          </TabsTrigger>
        </TabsList>

        {/* Content Mode */}
        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Content Generation Mode</CardTitle>
              <CardDescription>
                Choose how creative the AI should be with your content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={content.mode}
                onValueChange={(v) => setMode(v as ContentPreferences['mode'])}
                className="space-y-3"
              >
                {(['strict', 'professional', 'creative', 'custom'] as const).map((mode) => (
                  <div
                    key={mode}
                    className={cn(
                      'flex items-start space-x-3 rounded-lg border p-4 transition-all',
                      content.mode === mode && 'border-primary bg-primary/5'
                    )}
                  >
                    <RadioGroupItem value={mode} id={mode} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor={mode} className="cursor-pointer font-semibold capitalize">
                        {mode === 'strict' && 'Strictly Factual'}
                        {mode === 'professional' && 'Professional Marketing'}
                        {mode === 'creative' && 'Creative Marketing'}
                        {mode === 'custom' && 'Fully Custom'}
                        {mode === 'professional' && (
                          <Badge className="ml-2" variant="secondary">Recommended</Badge>
                        )}
                      </Label>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {CONTENT_MODE_INFO[mode]}
                      </p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Content Enhancement Options */}
          {content.mode === 'custom' && (
            <Card>
              <CardHeader>
                <CardTitle>Content Enhancement Options</CardTitle>
                <CardDescription>
                  Fine-tune what content the AI should generate.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Marketing Content */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold">Marketing Content</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { key: 'brandStory', label: 'Generate a compelling brand story' },
                      { key: 'missionStatement', label: 'Create a company mission statement' },
                      { key: 'visionStatement', label: 'Create a company vision statement' },
                      { key: 'valuePropositions', label: 'Generate value propositions' },
                      { key: 'marketingHeadlines', label: 'Generate marketing headlines' },
                      { key: 'serviceDescriptions', label: 'Generate service descriptions' },
                      { key: 'faq', label: 'Generate FAQ section' },
                      { key: 'ctaSections', label: 'Generate call-to-action sections' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={item.key}
                          checked={content[item.key as keyof ContentPreferences] as boolean}
                          onCheckedChange={(checked) => updateContent({ [item.key]: checked })}
                        />
                        <Label htmlFor={item.key} className="text-sm">
                          {item.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Social Proof */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold">Social Proof</h4>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="testimonials-ai"
                        checked={content.testimonials === 'ai'}
                        onCheckedChange={() => updateContent({ testimonials: 'ai' })}
                      />
                      <Label htmlFor="testimonials-ai" className="text-sm">
                        Generate testimonials
                      </Label>
                    </div>
                    <div className="ml-6 space-y-2">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ai" id="test-ai" />
                        <Label htmlFor="test-ai" className="text-sm" onClick={() => updateContent({ testimonials: 'ai' })}>AI-generated placeholders (clearly marked)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="user" id="test-user" />
                        <Label htmlFor="test-user" className="text-sm" onClick={() => updateContent({ testimonials: 'user' })}>User-provided testimonials only</Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Content */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold">Additional Content</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { key: 'portfolioDescriptions', label: 'Portfolio project descriptions' },
                      { key: 'teamDescriptions', label: 'Team member descriptions' },
                      { key: 'pricingTables', label: 'Pricing tables' },
                      { key: 'companyTimeline', label: 'Company timeline' },
                      { key: 'processSection', label: 'Process/workflow section' },
                      { key: 'founderStory', label: 'Founder story' },
                      { key: 'caseStudies', label: 'Case studies' },
                      { key: 'blogPosts', label: 'Blog posts' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={item.key}
                          checked={content[item.key as keyof ContentPreferences] as boolean}
                          onCheckedChange={(checked) => updateContent({ [item.key]: checked })}
                        />
                        <Label htmlFor={item.key} className="text-sm">
                          {item.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Box */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 flex-shrink-0 text-blue-600" />
              <div className="text-sm text-blue-800">
                <strong>Professional Tip:</strong> Professional Marketing mode is recommended for most businesses. 
                It generates persuasive content without fabricating claims that could damage trust.
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Website Features */}
        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Website Features</CardTitle>
              <CardDescription>
                Choose which features to include on your website.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
                {/* Core Pages */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold">Core Pages</h4>
                  <div className="space-y-2">
                    {[
                      { key: 'blog', label: 'Blog' },
                      { key: 'portfolio', label: 'Portfolio' },
                      { key: 'testimonials', label: 'Testimonials' },
                      { key: 'team', label: 'Team' },
                      { key: 'faq', label: 'FAQ' },
                      { key: 'careers', label: 'Careers' },
                      { key: 'pricing', label: 'Pricing' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={item.key}
                          checked={features[item.key as keyof WebsiteFeatures] as boolean}
                          onCheckedChange={(checked) => updateFeatures({ [item.key]: checked })}
                        />
                        <Label htmlFor={item.key} className="text-sm">
                          {item.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Communication */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold">Communication</h4>
                  <div className="space-y-2">
                    {[
                      { key: 'contactForms', label: 'Contact Forms' },
                      { key: 'newsletter', label: 'Newsletter' },
                      { key: 'liveChat', label: 'Live Chat' },
                      { key: 'whatsapp', label: 'WhatsApp Button' },
                      { key: 'messenger', label: 'Messenger Chat' },
                      { key: 'booking', label: 'Booking/Appointments' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={item.key}
                          checked={features[item.key as keyof WebsiteFeatures] as boolean}
                          onCheckedChange={(checked) => updateFeatures({ [item.key]: checked })}
                        />
                        <Label htmlFor={item.key} className="text-sm">
                          {item.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Social & Media */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold">Social & Media</h4>
                  <div className="space-y-2">
                    {[
                      { key: 'socialFeed', label: 'Social Feed' },
                      { key: 'instagramGallery', label: 'Instagram Gallery' },
                      { key: 'youtubeGallery', label: 'YouTube Gallery' },
                      { key: 'googleMaps', label: 'Google Maps' },
                      { key: 'googleReviews', label: 'Google Reviews' },
                      { key: 'clientLogos', label: 'Client Logos' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={item.key}
                          checked={features[item.key as keyof WebsiteFeatures] as boolean}
                          onCheckedChange={(checked) => updateFeatures({ [item.key]: checked })}
                        />
                        <Label htmlFor={item.key} className="text-sm">
                          {item.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* E-commerce */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold">E-commerce & Members</h4>
                  <div className="space-y-2">
                    {[
                      { key: 'shop', label: 'Shop (WooCommerce)' },
                      { key: 'membership', label: 'Membership' },
                      { key: 'dashboard', label: 'Client Portal' },
                      { key: 'downloads', label: 'Downloads' },
                      { key: 'events', label: 'Events' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={item.key}
                          checked={features[item.key as keyof WebsiteFeatures] as boolean}
                          onCheckedChange={(checked) => updateFeatures({ [item.key]: checked })}
                        />
                        <Label htmlFor={item.key} className="text-sm">
                          {item.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Technical */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold">Technical</h4>
                  <div className="space-y-2">
                    {[
                      { key: 'multiLanguage', label: 'Multi-language' },
                      { key: 'darkMode', label: 'Dark Mode' },
                      { key: 'search', label: 'Search' },
                      { key: 'accessibility', label: 'Accessibility' },
                      { key: 'analytics', label: 'Analytics' },
                      { key: 'seoOptimization', label: 'SEO Optimization' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={item.key}
                          checked={features[item.key as keyof WebsiteFeatures] as boolean}
                          onCheckedChange={(checked) => updateFeatures({ [item.key]: checked })}
                        />
                        <Label htmlFor={item.key} className="text-sm">
                          {item.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Compliance */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold">Compliance</h4>
                  <div className="space-y-2">
                    {[
                      { key: 'cookieBanner', label: 'Cookie Banner' },
                      { key: 'seoOptimization', label: 'Schema Markup' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={item.key}
                          checked={features[item.key as keyof WebsiteFeatures] as boolean}
                          onCheckedChange={(checked) => updateFeatures({ [item.key]: checked })}
                        />
                        <Label htmlFor={item.key} className="text-sm">
                          {item.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Design Preferences */}
        <TabsContent value="design" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Style</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={design.style}
                onValueChange={(v) => updateDesign({ style: v as DesignPreferences['style'] })}
                className="grid grid-cols-3 gap-3"
              >
                {(['minimal', 'luxury', 'corporate', 'editorial', 'creative', 'glassmorphism', 'geometric', 'modern', 'futuristic'] as const).map((style) => (
                  <div
                    key={style}
                    className={cn(
                      'cursor-pointer rounded-lg border p-3 text-center transition-all',
                      design.style === style ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
                    )}
                  >
                    <RadioGroupItem value={style} id={style} className="sr-only" />
                    <Label htmlFor={style} className="cursor-pointer capitalize">
                      {style}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Animation Level</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={design.animationLevel}
                onValueChange={(v) => updateDesign({ animationLevel: v as DesignPreferences['animationLevel'] })}
                className="space-y-2"
              >
                {(['none', 'minimal', 'moderate', 'premium'] as const).map((level) => (
                  <div
                    key={level}
                    className={cn(
                      'flex items-center space-x-3 rounded-lg border p-4 cursor-pointer',
                      design.animationLevel === level && 'border-primary bg-primary/5'
                    )}
                  >
                    <RadioGroupItem value={level} id={`anim-${level}`} />
                    <Label htmlFor={`anim-${level}`} className="flex-1 cursor-pointer capitalize">
                      {level}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visual Density</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={design.visualDensity}
                onValueChange={(v) => updateDesign({ visualDensity: v as DesignPreferences['visualDensity'] })}
                className="space-y-2"
              >
                {(['spacious', 'balanced', 'dense'] as const).map((density) => (
                  <div
                    key={density}
                    className={cn(
                      'flex items-center space-x-3 rounded-lg border p-4 cursor-pointer',
                      design.visualDensity === density && 'border-primary bg-primary/5'
                    )}
                  >
                    <RadioGroupItem value={density} id={`density-${density}`} />
                    <Label htmlFor={`density-${density}`} className="flex-1 cursor-pointer capitalize">
                      {density}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Corner Radius</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={design.roundedCorners}
                onValueChange={(v) => updateDesign({ roundedCorners: v as DesignPreferences['roundedCorners'] })}
                className="space-y-2"
              >
                {(['sharp', 'slight', 'rounded', 'fully-rounded'] as const).map((corner) => (
                  <div
                    key={corner}
                    className={cn(
                      'flex items-center space-x-3 rounded-lg border p-4 cursor-pointer',
                      design.roundedCorners === corner && 'border-primary bg-primary/5'
                    )}
                  >
                    <RadioGroupItem value={corner} id={`corner-${corner}`} />
                    <Label htmlFor={`corner-${corner}`} className="flex-1 cursor-pointer capitalize">
                      {corner.replace('-', ' ')}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visual Effects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { key: 'glassEffects', label: 'Glass Effects', desc: 'Frosted glass, blur effects' },
                  { key: 'gradientBackgrounds', label: 'Gradient Backgrounds', desc: 'Color gradients throughout' },
                  { key: 'threeDElements', label: '3D Elements', desc: 'Depth and shadows' },
                  { key: 'parallax', label: 'Parallax', desc: 'Scroll-based depth' },
                  { key: 'microAnimations', label: 'Micro Animations', desc: 'Hover and click effects' },
                  { key: 'premiumScrollEffects', label: 'Premium Scroll', desc: 'Advanced scroll animations' },
                ].map((item) => (
                  <div key={item.key} className="flex items-start space-x-3 rounded-lg border p-3">
                    <Checkbox
                      id={item.key}
                      checked={design[item.key as keyof DesignPreferences] as boolean}
                      onCheckedChange={(checked) => updateDesign({ [item.key]: checked })}
                    />
                    <div>
                      <Label htmlFor={item.key} className="cursor-pointer font-medium">
                        {item.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary */}
        <TabsContent value="summary" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Selection Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="mb-2 text-sm font-semibold">Content Mode</h4>
                <Badge variant="outline" className="capitalize">
                  {content.mode === 'strict' && 'Strictly Factual'}
                  {content.mode === 'professional' && 'Professional Marketing'}
                  {content.mode === 'creative' && 'Creative Marketing'}
                  {content.mode === 'custom' && 'Fully Custom'}
                </Badge>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold">Design Style</h4>
                <Badge variant="outline" className="capitalize">
                  {design.style}
                </Badge>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold">Enabled Features</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(features)
                    .filter(([_, v]) => v === true)
                    .map(([key]) => (
                      <Badge key={key} variant="secondary" className="capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </Badge>
                    ))}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {Object.values(features).filter((v) => v === true).length} features enabled
                </p>
              </div>

              <div className="rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="font-medium">Ready to Generate</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Click "Create Project" to generate your personalized website with all the selected options.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Default values
export const DEFAULT_CONTENT_PREFERENCES: ContentPreferences = {
  mode: 'professional',
  brandStory: true,
  missionStatement: true,
  visionStatement: true,
  valuePropositions: true,
  marketingHeadlines: true,
  serviceDescriptions: true,
  faq: true,
  ctaSections: true,
  portfolioDescriptions: true,
  teamDescriptions: true,
  testimonials: 'ai',
  clientLogos: 'placeholder',
  statistics: 'ai',
  achievements: false,
  certifications: false,
  awards: false,
  trustBadges: true,
  caseStudies: false,
  blogPosts: false,
  pricingTables: true,
  companyTimeline: false,
  processSection: true,
  founderStory: true,
};

export const DEFAULT_WEBSITE_FEATURES: WebsiteFeatures = {
  blog: false,
  portfolio: false,
  testimonials: true,
  team: false,
  faq: true,
  careers: false,
  pricing: false,
  booking: false,
  contactForms: true,
  newsletter: false,
  liveChat: false,
  whatsapp: false,
  messenger: false,
  socialFeed: false,
  instagramGallery: false,
  youtubeGallery: false,
  googleMaps: true,
  googleReviews: false,
  clientLogos: false,
  downloads: false,
  events: false,
  shop: false,
  membership: false,
  dashboard: false,
  multiLanguage: false,
  darkMode: false,
  search: false,
  accessibility: false,
  cookieBanner: true,
  analytics: false,
  seoOptimization: true,
};

export const DEFAULT_DESIGN_PREFERENCES: DesignPreferences = {
  style: 'modern',
  animationLevel: 'moderate',
  visualDensity: 'balanced',
  roundedCorners: 'rounded',
  glassEffects: false,
  gradientBackgrounds: true,
  threeDElements: true,
  parallax: false,
  microAnimations: true,
  premiumScrollEffects: false,
};
