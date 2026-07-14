'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Sparkles, 
  FileText, 
  Palette, 
  Type, 
  Image,
  Layout,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface GenerationJob {
  id: string;
  projectId: string;
  projectName: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  currentStep: string;
  progress: number;
  createdAt: string;
}

// Mock jobs for demo - in production, fetch from API
const MOCK_JOBS: GenerationJob[] = [];

export default function GeneratorPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<GenerationJob[]>(MOCK_JOBS);

  const STEPS = [
    { id: 'analyze', name: 'Analyze Business', icon: FileText, description: 'Extracting information from your inputs' },
    { id: 'templates', name: 'Select Templates', icon: Layout, description: 'Finding the best template sections' },
    { id: 'content', name: 'Generate Content', icon: Sparkles, description: 'Creating professional copy with AI' },
    { id: 'assets', name: 'Generate Assets', icon: Image, description: 'Creating images and icons' },
    { id: 'brand', name: 'Apply Branding', icon: Palette, description: 'Customizing colors and fonts' },
    { id: 'assemble', name: 'Assemble Website', icon: Type, description: 'Building the Elementor page' },
    { id: 'validate', name: 'Validate', icon: CheckCircle2, description: 'Checking for errors' },
    { id: 'publish', name: 'Publish', icon: Zap, description: 'Deploying to WordPress' },
  ];

  const getStepStatus = (stepId: string, currentStep: string, progress: number) => {
    const stepIndex = STEPS.findIndex(s => s.id === stepId);
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'processing';
    return 'pending';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Website Generator</h1>
          <p className="text-muted-foreground">
            AI-powered WordPress website generation pipeline
          </p>
        </div>
        <Button onClick={() => router.push('/projects/new')}>
          <Sparkles className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Generation Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Generation Pipeline
          </CardTitle>
          <CardDescription>
            The AI analyzes your business, selects optimal template sections, generates content, and assembles your WordPress website.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.id} className="flex flex-col items-center text-center">
                  <div className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all',
                    'bg-muted text-muted-foreground border-muted-foreground/30'
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="mt-2 text-xs font-medium">{step.name}</span>
                  <span className="text-xs text-muted-foreground">Step {index + 1}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Tabs defaultValue="process" className="space-y-4">
        <TabsList>
          <TabsTrigger value="process">Process</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="wordpress">WordPress</TabsTrigger>
        </TabsList>

        <TabsContent value="process">
          <Card>
            <CardHeader>
              <CardTitle>How Generation Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold">1. Business Analysis</h4>
                  <p className="text-sm text-muted-foreground">
                    The AI analyzes your business information, industry, and services to understand your needs.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Layout className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold">2. Intelligent Template Selection</h4>
                  <p className="text-sm text-muted-foreground">
                    From 700+ Elementor templates, the AI selects the best sections and assembles them for your industry.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold">3. AI Content Generation</h4>
                  <p className="text-sm text-muted-foreground">
                    Professional marketing copy is generated based only on the information you provide. No fake claims.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Palette className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold">4. Brand Application</h4>
                  <p className="text-sm text-muted-foreground">
                    Your colors, fonts, and logo are applied throughout the design.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold">5. WordPress Publish</h4>
                  <p className="text-sm text-muted-foreground">
                    The website is assembled in Elementor format and published directly to your WordPress site.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>700+ Elementor Templates</CardTitle>
              <CardDescription>
                Our library contains templates for every industry and style.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {['Technology', 'Healthcare', 'Finance', 'Restaurant', 'Real Estate', 'Creative', 'Education', 'Fitness', 'Legal', 'Travel', 'Non-Profit', 'E-commerce'].map((industry) => (
                  <Card key={industry} className="cursor-pointer hover:border-primary">
                    <CardContent className="p-3 text-center">
                      <p className="font-medium">{industry}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="mt-4 text-center">
                <Button variant="outline" asChild>
                  <Link href="/templates">Browse All Templates</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wordpress">
          <Card>
            <CardHeader>
              <CardTitle>WordPress Integration</CardTitle>
              <CardDescription>
                Your generated website is published directly to WordPress with Elementor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <h4 className="font-semibold">What you need:</h4>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• A WordPress site with Elementor installed</li>
                  <li>• An Application Password for your WordPress user</li>
                  <li>• Your WordPress URL</li>
                </ul>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="font-semibold">After generation:</h4>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• The website is fully editable in Elementor</li>
                  <li>• You can modify any section, text, or design</li>
                  <li>• Add new pages or sections anytime</li>
                  <li>• Your content is preserved</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
