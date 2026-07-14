'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Check, ArrowLeft, ArrowRight, Building2, Palette, Globe, Users, Sparkles, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ProjectFormData {
  // Step 1: Business Basics
  businessName: string;
  industry: string;
  description: string;
  website: string;
  
  // Step 2: Services
  services: string[];
  mainService: string;
  
  // Step 3: Contact
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  
  // Step 4: Brand
  stylePreset: string;
  primaryColor: string;
  secondaryColor: string;
  logo: File | null;
  
  // Step 5: Social & Links
  socialLinks: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

const STEPS = [
  { id: 1, name: 'Business', icon: Building2 },
  { id: 2, name: 'Services', icon: Briefcase },
  { id: 3, name: 'Contact', icon: Users },
  { id: 4, name: 'Brand', icon: Palette },
  { id: 5, name: 'Social', icon: Globe },
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

const STYLE_PRESETS = [
  { value: 'modern', label: 'Modern', description: 'Clean lines, bold typography, contemporary feel' },
  { value: 'minimal', label: 'Minimal', description: 'Less is more, lots of whitespace, simple' },
  { value: 'corporate', label: 'Corporate', description: 'Professional, trustworthy, established' },
  { value: 'creative', label: 'Creative', description: 'Bold colors, unique layouts, expressive' },
  { value: 'friendly', label: 'Friendly', description: 'Warm, approachable, personable' },
  { value: 'luxury', label: 'Luxury', description: 'Premium feel, elegant, sophisticated' },
];

// ============================================================================
// Components
// ============================================================================

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          
          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isCurrent && 'border-primary bg-white text-primary',
                    !isCompleted && !isCurrent && 'border-muted bg-white text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <span className={cn(
                  'mt-2 text-xs font-medium',
                  isCurrent && 'text-primary',
                  !isCurrent && 'text-muted-foreground'
                )}>
                  {step.name}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={cn(
                  'mx-2 h-0.5 w-12 bg-muted',
                  currentStep > step.id && 'bg-primary'
                )} />
              )}
            </div>
          );
        })}
      </div>
      <Progress value={(currentStep / STEPS.length) * 100} className="mt-4" />
    </div>
  );
}

function BusinessStep({ data, update }: { data: ProjectFormData; update: (data: Partial<ProjectFormData>) => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="businessName">Business Name *</Label>
        <Input
          id="businessName"
          placeholder="Enter your business name"
          value={data.businessName}
          onChange={(e) => update({ businessName: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="industry">Industry *</Label>
        <Select value={data.industry} onValueChange={(value) => update({ industry: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select your industry" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((industry) => (
              <SelectItem key={industry.value} value={industry.value}>
                {industry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Business Description</Label>
        <Textarea
          id="description"
          placeholder="Tell us about your business..."
          rows={4}
          value={data.description}
          onChange={(e) => update({ description: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          This will help AI generate relevant content for your website.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="website">Current Website (Optional)</Label>
        <Input
          id="website"
          type="url"
          placeholder="https://example.com"
          value={data.website}
          onChange={(e) => update({ website: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          We can use this to extract existing business information.
        </p>
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

  const removeService = (service: string) => {
    update({ services: data.services.filter(s => s !== service) });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="mainService">Primary Service/Product *</Label>
        <Input
          id="mainService"
          placeholder="What is your main offering?"
          value={data.mainService}
          onChange={(e) => update({ mainService: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Additional Services/Products</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Add a service..."
            value={newService}
            onChange={(e) => setNewService(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addService();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addService}>
            Add
          </Button>
        </div>
        
        {data.services.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.services.map((service) => (
              <Badge key={service} variant="secondary" className="gap-1 pr-1">
                {service}
                <button
                  type="button"
                  onClick={() => removeService(service)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Add all the services or products you want to highlight on your website.
        </p>
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
          <Input
            id="email"
            type="email"
            placeholder="contact@yourbusiness.com"
            value={data.email}
            onChange={(e) => update({ email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="(555) 123-4567"
            value={data.phone}
            onChange={(e) => update({ phone: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Street Address</Label>
        <Input
          id="address"
          placeholder="123 Main Street"
          value={data.address}
          onChange={(e) => update({ address: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            placeholder="New York"
            value={data.city}
            onChange={(e) => update({ city: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            placeholder="NY"
            value={data.state}
            onChange={(e) => update({ state: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zipCode">ZIP Code</Label>
          <Input
            id="zipCode"
            placeholder="10001"
            value={data.zipCode}
            onChange={(e) => update({ zipCode: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

function BrandStep({ data, update }: { data: ProjectFormData; update: (data: Partial<ProjectFormData>) => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Style Preset *</Label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STYLE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => update({ stylePreset: preset.value })}
              className={cn(
                'rounded-lg border-2 p-4 text-left transition-all',
                data.stylePreset === preset.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <div className="font-medium">{preset.label}</div>
              <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="primaryColor">Primary Color</Label>
        <div className="flex gap-3">
          <Input
            id="primaryColor"
            type="color"
            value={data.primaryColor}
            onChange={(e) => update({ primaryColor: e.target.value })}
            className="h-12 w-20 cursor-pointer"
          />
          <Input
            value={data.primaryColor}
            onChange={(e) => update({ primaryColor: e.target.value })}
            placeholder="#3B82F6"
            className="flex-1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="secondaryColor">Secondary Color</Label>
        <div className="flex gap-3">
          <Input
            id="secondaryColor"
            type="color"
            value={data.secondaryColor}
            onChange={(e) => update({ secondaryColor: e.target.value })}
            className="h-12 w-20 cursor-pointer"
          />
          <Input
            value={data.secondaryColor}
            onChange={(e) => update({ secondaryColor: e.target.value })}
            placeholder="#10B981"
            className="flex-1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Logo (Optional)</Label>
        <div className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8',
          data.logo ? 'border-primary bg-primary/5' : 'border-muted'
        )}>
          {data.logo ? (
            <div className="text-center">
              <Check className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-2 text-sm font-medium">{data.logo.name}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => update({ logo: null })}
                className="mt-2"
              >
                Remove
              </Button>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Drag and drop your logo, or click to browse
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PNG, JPG, SVG up to 5MB
              </p>
              <Input
                type="file"
                accept="image/*"
                className="mt-4"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    update({ logo: file });
                  }
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SocialStep({ data, update }: { data: ProjectFormData; update: (data: Partial<ProjectFormData>) => void }) {
  const updateSocial = (platform: keyof ProjectFormData['socialLinks'], value: string) => {
    update({
      socialLinks: {
        ...data.socialLinks,
        [platform]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="facebook">Facebook</Label>
        <Input
          id="facebook"
          type="url"
          placeholder="https://facebook.com/yourpage"
          value={data.socialLinks.facebook || ''}
          onChange={(e) => updateSocial('facebook', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="twitter">Twitter / X</Label>
        <Input
          id="twitter"
          type="url"
          placeholder="https://twitter.com/yourhandle"
          value={data.socialLinks.twitter || ''}
          onChange={(e) => updateSocial('twitter', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="instagram">Instagram</Label>
        <Input
          id="instagram"
          type="url"
          placeholder="https://instagram.com/yourpage"
          value={data.socialLinks.instagram || ''}
          onChange={(e) => updateSocial('instagram', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="linkedin">LinkedIn</Label>
        <Input
          id="linkedin"
          type="url"
          placeholder="https://linkedin.com/in/yourprofile"
          value={data.socialLinks.linkedin || ''}
          onChange={(e) => updateSocial('linkedin', e.target.value)}
        />
      </div>

      <div className="rounded-lg bg-muted/50 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <p className="text-sm">
            <strong>Pro tip:</strong> Adding social links will automatically add social icons to your website.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function NewProjectPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ProjectFormData>({
    businessName: '',
    industry: '',
    description: '',
    website: '',
    services: [],
    mainService: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    stylePreset: 'modern',
    primaryColor: '#3B82F6',
    secondaryColor: '#10B981',
    logo: null,
    socialLinks: {},
  });

  const updateFormData = (updates: Partial<ProjectFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.businessName.trim() && formData.industry;
      case 2:
        return formData.mainService.trim();
      case 3:
        return formData.email.trim();
      case 4:
        return formData.stylePreset;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // Generate and download website
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: formData.businessName,
          industry: formData.industry,
          description: formData.description,
          tagline: `Professional ${formData.industry} services`,
          sections: [
            {
              type: 'hero',
              title: `Welcome to ${formData.businessName}`,
              subtitle: formData.description,
            },
            {
              type: 'services',
              title: 'Our Services',
              items: formData.services.map(s => ({ title: s, description: `Professional ${s.toLowerCase()} services` })),
            },
            {
              type: 'about',
              title: 'About Us',
              content: formData.description,
            },
            {
              type: 'contact',
              title: 'Contact Us',
            },
          ],
          brandColors: {
            primary: formData.primaryColor || '#3B82F6',
            secondary: formData.secondaryColor || '#1E40AF',
            accent: '#F59E0B',
          },
          contact: {
            email: formData.email,
            phone: formData.phone,
            address: `${formData.address}, ${formData.city}, ${formData.state} ${formData.zipCode}`,
          },
        }),
      });

      if (response.ok) {
        // Download the file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${formData.businessName.toLowerCase().replace(/\s+/g, '-')}-website.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        // Show success message
        alert(`Website exported successfully! Upload the HTML file to any hosting provider.`);
        
        // Redirect to projects page
        router.push('/projects');
      } else {
        throw new Error('Export failed');
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to generate website. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <BusinessStep data={formData} update={updateFormData} />;
      case 2:
        return <ServicesStep data={formData} update={updateFormData} />;
      case 3:
        return <ContactStep data={formData} update={updateFormData} />;
      case 4:
        return <BrandStep data={formData} update={updateFormData} />;
      case 5:
        return <SocialStep data={formData} update={updateFormData} />;
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Create New Project</h1>
        <p className="mt-2 text-muted-foreground">
          Tell us about your business and we&apos;ll create a customized website for you.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="outline">{currentStep} of {STEPS.length}</Badge>
            {STEPS[currentStep - 1].name}
          </CardTitle>
          <CardDescription>
            {currentStep === 1 && 'Start with the basics about your business'}
            {currentStep === 2 && 'What do you offer?'}
            {currentStep === 3 && 'How can people reach you?'}
            {currentStep === 4 && 'Define your visual identity'}
            {currentStep === 5 && 'Connect your social presence'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <StepIndicator currentStep={currentStep} />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          {currentStep < STEPS.length ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create Project
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
