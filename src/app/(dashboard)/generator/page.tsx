'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileStack, Building2, Loader2, CheckCircle, ArrowRight, AlertCircle } from 'lucide-react';
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
  { value: 'modern', label: 'Modern', description: 'Clean lines, bold colors' },
  { value: 'minimal', label: 'Minimal', description: 'Simple, elegant' },
  { value: 'corporate', label: 'Corporate', description: 'Professional' },
  { value: 'creative', label: 'Creative', description: 'Bold, artistic' },
  { value: 'luxury', label: 'Luxury', description: 'Premium, sophisticated' },
  { value: 'friendly', label: 'Friendly', description: 'Warm, welcoming' },
];

interface Template {
  id: string;
  name: string;
  category: string;
  industry: string | null;
  previewImage: string | null;
}

interface GeneratorState {
  step: 'input' | 'selecting' | 'generating' | 'complete';
  businessName: string;
  industry: string;
  description: string;
  stylePreset: string;
  templateId: string | null;
  projectId: string | null;
  progress: number;
  status: string;
  completedSteps: string[];
  error: string | null;
}

const STEPS = ['Initialize', 'Analyze Business', 'Select Templates', 'Generate Content', 'Apply Brand', 'Modify JSON', 'Validate', 'Generate Preview', 'Ready'];

export default function GeneratorPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [state, setState] = useState<GeneratorState>({
    step: 'input',
    businessName: '',
    industry: '',
    description: '',
    stylePreset: 'modern',
    templateId: null,
    projectId: null,
    progress: 0,
    status: 'Initializing...',
    completedSteps: [],
    error: null,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Load templates when industry changes
  useEffect(() => {
    if (state.industry && state.step === 'selecting') {
      loadTemplates();
    }
  }, [state.industry, state.step]);

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const params = new URLSearchParams();
      if (state.industry) params.set('industry', state.industry);
      params.set('refresh', 'true');
      
      const response = await fetch(`/api/templates?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!state.businessName || !state.industry) return;

    setState(prev => ({ ...prev, status: 'Creating project...' }));
    
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
      } else {
        const errorData = await response.json();
        setState(prev => ({ ...prev, error: errorData.error || 'Failed to create project' }));
      }
    } catch (err) {
      setState(prev => ({ ...prev, error: 'Failed to create project' }));
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    setState(prev => ({ ...prev, templateId }));
  };

  const handleGenerate = async () => {
    if (!state.templateId || !state.projectId) return;

    setState(prev => ({ 
      ...prev, 
      step: 'generating', 
      progress: 0, 
      status: 'Starting generation...',
      completedSteps: [],
      error: null,
    }));

    let pollCount = 0;
    const maxPolls = 60; // 2 minutes max

    try {
      // Start generation via API
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: state.projectId,
          businessName: state.businessName,
          industry: state.industry,
          description: state.description,
          stylePreset: state.stylePreset,
          selectedTemplates: [state.templateId],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setState(prev => ({ 
          ...prev, 
          error: data.error || data.message || 'Generation failed',
          step: 'selecting',
        }));
        return;
      }

      if (data.success) {
        setState(prev => ({ 
          ...prev, 
          step: 'complete',
          completedSteps: data.completedSteps || [],
        }));
        return;
      }

      // If not immediately successful, poll for progress
      const pollProgress = async () => {
        if (pollCount >= maxPolls) {
          setState(prev => ({ 
            ...prev, 
            error: 'Generation timed out',
            step: 'selecting',
          }));
          return;
        }

        pollCount++;

        try {
          const progressRes = await fetch(`/api/generate?projectId=${state.projectId}`);
          const progressData = await progressRes.json();

          // Calculate progress based on checkpoint
          const checkpointIndex = STEPS.findIndex(s => 
            progressData.checkpoint?.toLowerCase().includes(s.toLowerCase())
          );
          const progress = checkpointIndex >= 0 ? Math.round((checkpointIndex / STEPS.length) * 100) : 0;

          setState(prev => ({ 
            ...prev, 
            progress,
            status: `Processing: ${progressData.checkpoint || 'Working...'}`,
            completedSteps: progressData.completedSteps || prev.completedSteps,
          }));

          // Check if complete
          if (progressData.status === 'PREVIEW' || progressData.status === 'PUBLISHED') {
            setState(prev => ({ ...prev, step: 'complete' }));
            return;
          }

          if (progressData.status === 'FAILED') {
            setState(prev => ({ 
              ...prev, 
              error: 'Generation failed',
              step: 'selecting',
            }));
            return;
          }

          // Continue polling
          setTimeout(pollProgress, 2000);
        } catch {
          setTimeout(pollProgress, 5000);
        }
      };

      pollProgress();

    } catch (err) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to start generation',
        step: 'selecting',
      }));
    }
  };

  const handleViewProject = () => {
    router.push(`/projects/${state.projectId}`);
  };

  const handleReset = () => {
    setState({
      step: 'input',
      businessName: '',
      industry: '',
      description: '',
      stylePreset: 'modern',
      templateId: null,
      projectId: null,
      progress: 0,
      status: '',
      completedSteps: [],
      error: null,
    });
    setTemplates([]);
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Website Generator</h1>
        <p className="text-muted-foreground">
          Create a professional WordPress website with AI
        </p>
      </div>

      {/* Error Display */}
      {state.error && (
        <Card className="border-red-500 bg-red-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-700">{state.error}</p>
            <Button variant="outline" size="sm" onClick={() => setState(prev => ({ ...prev, error: null }))} className="ml-auto">
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

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
              disabled={!state.businessName || !state.industry}
              className="w-full"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
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
              {templatesLoading ? 'Loading templates...' : `Choose a starting template for your ${state.industry} website`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {templatesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No templates found for {state.industry}.</p>
                <Button variant="outline" className="mt-4" onClick={() => setTemplates([])}>
                  Show All Templates
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-4 rounded-lg border bg-muted/50 p-4">
                  <p className="text-sm">
                    <strong>Tip:</strong> You can customize everything after generation. The template 
                    provides a starting structure that AI will personalize for your business.
                  </p>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {templates.slice(0, 9).map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template.id)}
                      className={cn(
                        'rounded-lg border p-4 text-left transition-all',
                        state.templateId === template.id 
                          ? 'border-primary bg-primary/5 ring-2 ring-primary' 
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div className="aspect-video rounded bg-muted mb-3 flex items-center justify-center overflow-hidden">
                        {template.previewImage ? (
                          <img src={template.previewImage} alt={template.name} className="h-full w-full object-cover" />
                        ) : (
                          <FileStack className="h-8 w-8 text-muted-foreground/50" />
                        )}
                      </div>
                      <p className="font-medium">{template.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{template.category}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={handleReset}>
                Back
              </Button>
              <Button 
                onClick={handleGenerate} 
                disabled={!state.templateId}
                className="flex-1"
              >
                Generate Website
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'generating' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating Your Website
            </CardTitle>
            <CardDescription>{state.status}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{state.status}</span>
                <span>{state.progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div 
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {STEPS.map((step, i) => {
                const stepIndex = Math.floor((state.progress / 100) * STEPS.length);
                const isComplete = i < stepIndex;
                const isCurrent = i === stepIndex;
                
                return (
                  <div key={step} className="flex items-center gap-2 text-sm">
                    {isComplete ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : isCurrent ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-muted" />
                    )}
                    <span className={isComplete ? 'text-foreground' : isCurrent ? 'text-primary font-medium' : 'text-muted-foreground'}>
                      {step}
                    </span>
                  </div>
                );
              })}
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
              <Button variant="outline" onClick={handleReset} className="flex-1">
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
