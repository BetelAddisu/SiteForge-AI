'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Wand2, 
  FileStack, 
  Building2,
  Palette,
  Globe,
  Loader2,
  CheckCircle,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'Restaurant',
  'Real Estate',
  'Creative',
  'Education',
  'Fitness',
  'Legal',
  'Travel',
  'Non-Profit',
  'E-commerce',
];

const STYLE_PRESETS = [
  { value: 'modern', label: 'Modern', description: 'Clean lines, bold colors, contemporary feel' },
  { value: 'minimal', label: 'Minimal', description: 'Simple, elegant, lots of white space' },
  { value: 'corporate', label: 'Corporate', description: 'Professional, trustworthy, business-focused' },
  { value: 'creative', label: 'Creative', description: 'Bold, artistic, expressive' },
  { value: 'luxury', label: 'Luxury', description: 'Premium, sophisticated, high-end' },
  { value: 'friendly', label: 'Friendly', description: 'Warm, approachable, welcoming' },
];

interface GeneratorState {
  step: 'input' | 'selecting' | 'generating' | 'preview' | 'complete';
  businessName: string;
  industry: string;
  description: string;
  stylePreset: string;
  templateId: string | null;
  projectId: string | null;
  progress: number;
  status: string;
}

export default function GeneratorPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<GeneratorState>({
    step: 'input',
    businessName: '',
    industry: '',
    description: '',
    stylePreset: 'modern',
    templateId: null,
    projectId: null,
    progress: 0,
    status: '',
  });
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleCreateProject = async () => {
    if (!state.businessName || !state.industry) return;

    setGenerating(true);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: state.businessName,
          industry: state.industry,
          description: state.description,
          stylePreset: state.stylePreset,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setState(prev => ({
          ...prev,
          step: 'selecting',
          projectId: data.project.id,
        }));
      }
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    setState(prev => ({ ...prev, templateId }));
  };

  const handleGenerate = async () => {
    if (!state.templateId) return;

    setState(prev => ({ ...prev, step: 'generating', progress: 0, status: 'Starting generation...' }));
    setGenerating(true);

    try {
      // Update project with template
      await fetch(`/api/projects/${state.projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: state.templateId }),
      });

      // Simulate generation progress (in real app, this would be a WebSocket or polling)
      const steps = [
        { progress: 20, status: 'Analyzing template...' },
        { progress: 40, status: 'Generating content with AI...' },
        { progress: 60, status: 'Applying brand styles...' },
        { progress: 80, status: 'Building Elementor structure...' },
        { progress: 100, status: 'Finalizing...' },
      ];

      for (const step of steps) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setState(prev => ({ ...prev, progress: step.progress, status: step.status }));
      }

      // Update project status
      await fetch(`/api/projects/${state.projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PREVIEW' }),
      });

      setState(prev => ({ ...prev, step: 'complete' }));
    } catch (err) {
      console.error('Generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleViewProject = () => {
    router.push(`/projects/${state.projectId}`);
  };

  if (authLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Website Generator</h1>
        <p className="text-muted-foreground">
          Create a professional WordPress website with AI
        </p>
      </div>

      {/* Step Progress */}
      <div className="flex items-center justify-between">
        {['Business Info', 'Select Template', 'Generate', 'Preview'].map((label, i) => (
          <div key={label} className="flex items-center">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
              state.step === ['input', 'selecting', 'generating', 'complete'][i]
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}>
              {i + 1}
            </div>
            <span className="ml-2 text-sm">{label}</span>
            {i < 3 && <ArrowRight className="mx-4 h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {state.step === 'input' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Tell us about your business
            </CardTitle>
            <CardDescription>
              This information helps AI create relevant content for your website.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business-name">Business Name *</Label>
              <Input 
                id="business-name" 
                placeholder="Acme Corporation"
                value={state.businessName}
                onChange={(e) => setState(prev => ({ ...prev, businessName: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry *</Label>
              <select
                id="industry"
                value={state.industry}
                onChange={(e) => setState(prev => ({ ...prev, industry: e.target.value }))}
                className="w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="">Select an industry</option>
                {INDUSTRIES.map(ind => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Brief Description</Label>
              <textarea
                id="description"
                placeholder="Tell us about what your business does..."
                value={state.description}
                onChange={(e) => setState(prev => ({ ...prev, description: e.target.value }))}
                className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-3">
              <Label>Style Preference</Label>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {STYLE_PRESETS.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => setState(prev => ({ ...prev, stylePreset: preset.value }))}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-all hover:border-primary',
                      state.stylePreset === preset.value 
                        ? 'border-primary bg-primary/5 ring-2 ring-primary' 
                        : 'border-border'
                    )}
                  >
                    <p className="font-medium">{preset.label}</p>
                    <p className="text-xs text-muted-foreground">{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleCreateProject} 
              disabled={generating || !state.businessName || !state.industry}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Project...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {state.step === 'selecting' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileStack className="h-5 w-5" />
              Select a Template
            </CardTitle>
            <CardDescription>
              Choose a starting template for your {state.industry} website.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-lg border bg-muted/50 p-4">
              <p className="text-sm">
                <strong>Tip:</strong> You can customize everything after generation. The template 
                provides a starting structure that AI will personalize for your business.
              </p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <button
                  key={i}
                  onClick={() => handleSelectTemplate(`template-${i}`)}
                  className={cn(
                    'rounded-lg border p-4 text-left transition-all',
                    state.templateId === `template-${i}` 
                      ? 'border-primary bg-primary/5 ring-2 ring-primary' 
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="aspect-video rounded bg-muted mb-3 flex items-center justify-center">
                    <FileStack className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="font-medium">Template {i}</p>
                  <p className="text-xs text-muted-foreground capitalize">{state.industry}</p>
                </button>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => setState(prev => ({ ...prev, step: 'input' }))}>
                Back
              </Button>
              <Button 
                onClick={handleGenerate} 
                disabled={!state.templateId || generating}
                className="flex-1"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generate Website
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'generating' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 animate-pulse" />
              Generating Your Website
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{state.status}</span>
                <span>{state.progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div 
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                { done: state.progress >= 20, label: 'Analyzing template' },
                { done: state.progress >= 40, label: 'Generating content' },
                { done: state.progress >= 60, label: 'Applying styles' },
                { done: state.progress >= 80, label: 'Building structure' },
                { done: state.progress >= 100, label: 'Finalizing' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {item.done ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-muted" />
                  )}
                  <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'complete' && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Your Website is Ready!</CardTitle>
            <CardDescription>
              {state.businessName} website has been generated with Elementor structure.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">What was created:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>✓ AI-generated content tailored for {state.industry}</li>
                <li>✓ {state.stylePreset.charAt(0).toUpperCase() + state.stylePreset.slice(1)} style applied</li>
                <li>✓ Elementor-compatible structure</li>
                <li>✓ Ready for WordPress publishing</li>
              </ul>
            </div>

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
                <p className="text-sm text-yellow-800">
                  <strong>Next step:</strong> Connect your WordPress site in Settings to publish this website.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push('/generator')} className="flex-1">
                Create Another
              </Button>
              <Button onClick={handleViewProject} className="flex-1">
                View Project
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
