'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Check, ArrowLeft, ArrowRight, Building2, Palette, Globe, Users, Sparkles, Briefcase, FileText, AlertCircle, X, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContentPreferencesEditor, DEFAULT_CONTENT_PREFERENCES, DEFAULT_WEBSITE_FEATURES, DEFAULT_DESIGN_PREFERENCES } from '@/components/content/content-preferences';
import { ColorManager, DEFAULT_PALETTES } from '@/components/color/color-manager';
import { FontManager } from '@/components/font/font-manager';
import type { ContentPreferences, WebsiteFeatures, DesignPreferences, ColorPalette, FontConfig, LogoData } from '@/lib/types';

// Error display interface
interface ErrorDisplay {
  error: string;
  message: string;
  code?: string;
}

interface TemplateParamHandlerProps {
  children: React.ReactNode;
  onTemplateId: (id: string) => void;
  onKitId: (id: string) => void;
  onSource: (source: 'template' | 'kit' | null) => void;
}

function TemplateParamHandler({ children, onTemplateId, onKitId, onSource }: TemplateParamHandlerProps) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const templateId = searchParams.get('template');
    const kitId = searchParams.get('kit');
    
    if (templateId) {
      onTemplateId(templateId);
      onSource('template');
    } else if (kitId) {
      onKitId(kitId);
      onSource('kit');
    } else {
      onSource(null);
    }
  }, [searchParams, onTemplateId, onKitId, onSource]);
  return <>{children}</>;
}

// ============================================================================
// Types
// ============================================================================

interface ProjectFormData {
  businessName: string;
  industry: string;
  description: string;
  website: string;
  services: string[];
  mainService: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  stylePreset: string;
  colorPalettes: ColorPalette[];
  fontConfigs: FontConfig[];
  logoData?: LogoData;
  socialLinks: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
  contentPreferences: ContentPreferences;
  websiteFeatures: WebsiteFeatures;
  designPreferences: DesignPreferences;
}

// ============================================================================
// Constants
// ============================================================================

const STEPS = [
  { id: 1, name: 'Business', icon: Building2, description: 'Tell us about your business' },
  { id: 2, name: 'Services', icon: Briefcase, description: 'What do you offer?' },
  { id: 3, name: 'Contact', icon: Users, description: 'How can people reach you?' },
  { id: 4, name: 'Brand', icon: Palette, description: 'Define your visual identity' },
  { id: 5, name: 'Social', icon: Globe, description: 'Connect your social presence' },
  { id: 6, name: 'Content', icon: FileText, description: 'Configure AI content' },
];

const INDUSTRIES = [
  { value: 'technology', label: 'Technology & Software' },
  { value: 'healthcare', label: 'Healthcare & Medical' },
  { value: 'finance', label: 'Finance & Banking' },
  { value: 'retail', label: 'Retail & E-commerce' },
  { value: 'restaurant', label: 'Restaurant & Food' },
  { value: 'real-estate', label: 'Real Estate' },
  { value: 'consulting', label: 'Consulting & Professional Services' },
  { value: 'education', label: 'Education & Training' },
  { value: 'creative', label: 'Creative & Design' },
  { value: 'fitness', label: 'Fitness & Wellness' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'home-services', label: 'Home Services' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'travel', label: 'Travel & Hospitality' },
  { value: 'nonprofit', label: 'Non-Profit' },
  { value: 'other', label: 'Other' },
];

// ============================================================================
// Step Components
// ============================================================================

function BusinessStep({ data, update }: { data: ProjectFormData; update: (data: Partial<ProjectFormData>) => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="businessName">Business Name *</Label>
        <Input id="businessName" placeholder="e.g., Acme Digital Solutions" value={data.businessName} onChange={(e) => update({ businessName: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="industry">Industry *</Label>
        <Select value={data.industry} onValueChange={(value) => update({ industry: value })}>
          <SelectTrigger><SelectValue placeholder="Select your industry" /></SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((industry) => (
              <SelectItem key={industry.value} value={industry.value}>{industry.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Business Description *</Label>
        <Textarea id="description" placeholder="Describe what your business does, who you serve, and what makes you unique..." rows={4} value={data.description} onChange={(e) => update({ description: e.target.value })} />
        <p className="text-xs text-muted-foreground">This information is used to generate accurate, professional content. Only real information will be used.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="website">Current Website (optional)</Label>
        <Input id="website" type="url" placeholder="https://yourwebsite.com" value={data.website} onChange={(e) => update({ website: e.target.value })} />
      </div>
    </div>
  );
}

function ServicesStep({ data, update }: { data: ProjectFormData; update: (data: Partial<ProjectFormData>) => void }) {
  const [newService, setNewService] = useState('');
  const addService = () => {
    if (newService.trim() && !data.services.includes(newService.trim())) {
      update({ services: [...data.services, newService.trim()] });
      setNewService('');
    }
  };
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="mainService">Primary Service *</Label>
        <Input id="mainService" placeholder="e.g., Digital Marketing Services" value={data.mainService} onChange={(e) => update({ mainService: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Additional Services</Label>
        <div className="flex gap-2">
          <Input placeholder="Add a service..." value={newService} onChange={(e) => setNewService(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addService())} />
          <Button onClick={addService} disabled={!newService.trim()}>Add</Button>
        </div>
        {data.services.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {data.services.map((service) => (
              <Badge key={service} variant="secondary" className="gap-1 pr-1">
                {service}
                <button onClick={() => update({ services: data.services.filter((s) => s !== service) })} className="ml-1 rounded-full p-0.5 hover:bg-muted">×</button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContactStep({ data, update }: { data: ProjectFormData; update: (data: Partial<ProjectFormData>) => void }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" type="email" placeholder="contact@yourbusiness.com" value={data.email} onChange={(e) => update({ email: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" placeholder="(555) 123-4567" value={data.phone} onChange={(e) => update({ phone: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Street Address</Label>
        <Input id="address" placeholder="123 Main Street" value={data.address} onChange={(e) => update({ address: e.target.value })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2"><Label htmlFor="city">City</Label><Input id="city" placeholder="New York" value={data.city} onChange={(e) => update({ city: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="state">State</Label><Input id="state" placeholder="NY" value={data.state} onChange={(e) => update({ state: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="zipCode">ZIP Code</Label><Input id="zipCode" placeholder="10001" value={data.zipCode} onChange={(e) => update({ zipCode: e.target.value })} /></div>
      </div>
    </div>
  );
}

function BrandStep({ data, update }: { data: ProjectFormData; update: (data: Partial<ProjectFormData>) => void }) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="colors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="fonts">Typography</TabsTrigger>
          <TabsTrigger value="logo">Logo</TabsTrigger>
        </TabsList>
        <TabsContent value="colors">
          <ColorManager palettes={data.colorPalettes} onChange={(palettes) => update({ colorPalettes: palettes })} />
        </TabsContent>
        <TabsContent value="fonts">
          <FontManager fonts={data.fontConfigs} onChange={(fonts) => update({ fontConfigs: fonts })} />
        </TabsContent>
        <TabsContent value="logo">
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Upload Your Logo</h3>
              <p className="mt-2 text-sm text-muted-foreground">PNG, JPG, or SVG. Max 5MB.</p>
              <Button className="mt-4" variant="secondary">Choose File</Button>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="font-medium">What happens next?</h4>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>✓ We extract dominant colors from your logo</li>
                <li>✓ We generate a brand color palette</li>
                <li>✓ We create a favicon</li>
                <li>✓ We generate dark/light logo variants</li>
                <li>✓ We apply your branding throughout the site</li>
              </ul>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SocialStep({ data, update }: { data: ProjectFormData; update: (data: Partial<ProjectFormData>) => void }) {
  const updateSocial = (platform: keyof ProjectFormData['socialLinks'], value: string) => {
    update({ socialLinks: { ...data.socialLinks, [platform]: value } });
  };
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Label htmlFor="facebook">Facebook</Label><Input id="facebook" type="url" placeholder="https://facebook.com/yourpage" value={data.socialLinks.facebook || ''} onChange={(e) => updateSocial('facebook', e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="twitter">Twitter / X</Label><Input id="twitter" type="url" placeholder="https://twitter.com/yourhandle" value={data.socialLinks.twitter || ''} onChange={(e) => updateSocial('twitter', e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="instagram">Instagram</Label><Input id="instagram" type="url" placeholder="https://instagram.com/yourpage" value={data.socialLinks.instagram || ''} onChange={(e) => updateSocial('instagram', e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="linkedin">LinkedIn</Label><Input id="linkedin" type="url" placeholder="https://linkedin.com/in/yourprofile" value={data.socialLinks.linkedin || ''} onChange={(e) => updateSocial('linkedin', e.target.value)} /></div>
      <div className="rounded-lg bg-muted/50 p-4">
        <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><p className="text-sm"><strong>Pro tip:</strong> Adding social links will automatically add social icons to your website.</p></div>
      </div>
    </div>
  );
}

function ContentStep({ data, update }: { data: ProjectFormData; update: (data: Partial<ProjectFormData>) => void }) {
  return (
    <ContentPreferencesEditor
      content={data.contentPreferences}
      features={data.websiteFeatures}
      design={data.designPreferences}
      onContentChange={(content) => update({ contentPreferences: content })}
      onFeaturesChange={(features) => update({ websiteFeatures: features })}
      onDesignChange={(design) => update({ designPreferences: design })}
    />
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function NewProjectPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [kitId, setKitId] = useState<string | null>(null);
  const [templateSource, setTemplateSource] = useState<'template' | 'kit' | null>(null);
  const [error, setError] = useState<ErrorDisplay | null>(null);

  const [formData, setFormData] = useState<ProjectFormData>({
    businessName: '', industry: '', description: '', website: '',
    services: [], mainService: '',
    email: '', phone: '', address: '', city: '', state: '', zipCode: '',
    stylePreset: 'modern', colorPalettes: DEFAULT_PALETTES, fontConfigs: [],
    socialLinks: {},
    contentPreferences: DEFAULT_CONTENT_PREFERENCES,
    websiteFeatures: DEFAULT_WEBSITE_FEATURES,
    designPreferences: DEFAULT_DESIGN_PREFERENCES,
  });

  const updateFormData = (updates: Partial<ProjectFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    if (templateId) console.log('Template selected:', templateId);
    if (kitId) console.log('Kit selected:', kitId);
    if (templateSource) console.log('Template source:', templateSource);
  }, [templateId, kitId, templateSource]);

  const canProceed = () => {
    switch (currentStep) {
      case 1: return formData.businessName && formData.industry && formData.description;
      case 2: return formData.mainService;
      case 3: return formData.email;
      default: return true;
    }
  };

  const handleNext = () => { 
    setError(null);
    if (currentStep < STEPS.length) setCurrentStep(currentStep + 1); 
  };
  const handleBack = () => { 
    setError(null);
    if (currentStep > 1) setCurrentStep(currentStep - 1); 
  };

  const handleDismissError = () => {
    setError(null);
  };

  const getHumanReadableError = (errorData: ErrorDisplay): string => {
    // Always show the actual error message
    if (errorData.message) {
      return errorData.message;
    }
    
    switch (errorData.code) {
      case 'AUTH_REQUIRED':
        return 'You need to sign in to create a project. Please sign in and try again.';
      case 'CONFIG_ERROR':
        return 'The application is not properly configured. Please contact support.';
      case 'VALIDATION_ERROR':
        return errorData.message || 'Please check your input and try again.';
      case 'DB_CONNECTION_ERROR':
        return errorData.message || 'Unable to connect to the database. Please try again.';
      case 'DUPLICATE_ERROR':
        return 'A project with this name already exists.';
      case 'FETCH_ERROR':
        return 'Unable to save your project. Please try again.';
      default:
        return errorData.message || 'An unexpected error occurred. Please try again.';
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    
    try {
      // Create project via API
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: formData.businessName,
          industry: formData.industry,
          description: formData.description,
          stylePreset: formData.stylePreset,
          templateId: templateId,
          kitId: kitId,
          templateSource: templateSource,
          services: formData.services,
          mainService: formData.mainService,
          contact: {
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
          },
          socialLinks: formData.socialLinks,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: 'Unknown error', 
          message: 'Failed to create project',
          code: 'UNKNOWN_ERROR'
        }));
        
        console.error('Project creation failed:', {
          status: response.status,
          error: errorData.error,
          message: errorData.message,
          code: errorData.code,
        });
        
        setError({
          error: errorData.error || 'Failed to create project',
          message: getHumanReadableError(errorData),
          code: errorData.code,
        });
        return;
      }

      const data = await response.json();
      const projectId = data.project?.id;

      if (projectId) {
        // Redirect to the project page where user can edit and generate
        router.push(`/projects/${projectId}`);
      } else {
        router.push('/projects');
      }
    } catch (err) {
      console.error('Network or unexpected error:', err);
      setError({
        error: 'Connection error',
        message: 'Unable to connect to the server. Please check your internet connection and try again.',
        code: 'NETWORK_ERROR',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <BusinessStep data={formData} update={updateFormData} />;
      case 2: return <ServicesStep data={formData} update={updateFormData} />;
      case 3: return <ContactStep data={formData} update={updateFormData} />;
      case 4: return <BrandStep data={formData} update={updateFormData} />;
      case 5: return <SocialStep data={formData} update={updateFormData} />;
      case 6: return <ContentStep data={formData} update={updateFormData} />;
      default: return null;
    }
  };

  return (
    <Suspense fallback={<div className="flex h-96 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
    <TemplateParamHandler 
      onTemplateId={setTemplateId}
      onKitId={setKitId}
      onSource={setTemplateSource}
    >
    <div className="mx-auto max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Create New Project</h1>
        <p className="mt-2 text-muted-foreground">Build your professional WordPress website with Elementor</p>
      </div>

      {/* Workflow Info Banner */}
      {templateSource === 'template' && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <Layers className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-blue-900">Template Selected</h3>
              <p className="text-sm text-blue-700 mt-1">
                You're creating a project using a specific template. Our AI will personalize it 
                based on your business information.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {templateSource === 'kit' && (
        <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-purple-100 p-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium text-purple-900">Template Kit Selected</h3>
              <p className="text-sm text-purple-700 mt-1">
                You're creating a project using a complete design system. Our AI will select 
                the best templates from the kit for your website.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {!templateSource && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-green-100 p-2">
              <Sparkles className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-green-900">AI Will Select the Best Template</h3>
              <p className="text-sm text-green-700 mt-1">
                Based on your business information, our AI will automatically choose the most 
                suitable Template Kit from our library. You can customize everything later.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all', isCompleted && 'border-primary bg-primary text-primary-foreground', isActive && !isCompleted && 'border-primary bg-primary/10 text-primary', !isActive && !isCompleted && 'border-muted-foreground/30 text-muted-foreground')}>
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={cn('mt-2 text-xs', isActive && 'font-medium text-foreground', !isActive && 'text-muted-foreground')}>{step.name}</span>
                </div>
                {index < STEPS.length - 1 && <div className={cn('mx-2 h-0.5 w-12 transition-all', isCompleted ? 'bg-primary' : 'bg-muted-foreground/30')} />}
              </div>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => {
              const Icon = STEPS[currentStep - 1].icon;
              return Icon ? <Icon className="h-5 w-5" /> : null;
            })()}
            {STEPS[currentStep - 1].name}
          </CardTitle>
          <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
        </CardHeader>
        
        {/* Error Display */}
        {error && (
          <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-800">{error.error}</p>
                <p className="mt-1 text-sm text-red-700">{error.message}</p>
                {process.env.NODE_ENV === 'development' && error.code && (
                  <p className="mt-1 text-xs text-red-500">Error code: {error.code}</p>
                )}
              </div>
              <button 
                onClick={handleDismissError}
                className="flex-shrink-0 rounded-full p-1 hover:bg-red-100 transition-colors"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4 text-red-600" />
              </button>
            </div>
          </div>
        )}
        
        <CardContent>
          <AnimatePresence mode="wait">
            <motion.div key={currentStep} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}>
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          {currentStep < STEPS.length ? (
            <Button onClick={handleNext} disabled={!canProceed()}>Next<ArrowRight className="ml-2 h-4 w-4" /></Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (<><div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />Creating...</>) : (<><Sparkles className="mr-2 h-4 w-4" />Generate Website</>)}
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Help Text */}
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-3">
          <Sparkles className="h-5 w-5 flex-shrink-0 text-blue-600" />
          <div className="text-sm text-blue-800">
            <strong>What happens next?</strong>
            <p className="mt-1">After clicking "Generate Website", our AI will:</p>
            <ol className="mt-1 list-inside list-decimal space-y-0.5">
              <li>Analyze the best templates from our 700+ Elementor library</li>
              <li>Generate professional content based on your information</li>
              <li>Customize colors, fonts, and branding</li>
              <li>Assemble a complete WordPress website with Elementor</li>
              <li>Publish directly to your WordPress site</li>
            </ol>
            <p className="mt-2">The website will be fully editable in Elementor after publishing.</p>
          </div>
        </div>
      </div>
    </div>
    </TemplateParamHandler>
    </Suspense>
  );
}
