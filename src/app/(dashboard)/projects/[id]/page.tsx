'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, 
  Edit, 
  Sparkles, 
  Eye, 
  Send, 
  Loader2, 
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Settings,
  FileText
} from 'lucide-react';

interface Project {
  id: string;
  businessName: string;
  industry: string | null;
  description: string | null;
  stylePreset: string | null;
  status: string;
  previewImage: string | null;
  createdAt: string;
  templateId: string | null;
  generatedContent: {
    homepage?: {
      hero?: { heading?: string; subheading?: string; ctaText?: string };
      about?: { heading?: string; paragraphs?: string[] };
      services?: Array<{ title?: string; description?: string }>;
    };
  } | null;
  elementorData: unknown | null;
}

interface GenerationProgress {
  step: string;
  progress: number;
  status: string;
}

const STEPS = [
  'Initializing',
  'Analyzing Business',
  'Selecting Templates',
  'Generating Content',
  'Applying Brand',
  'Modifying JSON',
  'Validating',
  'Generating Preview',
  'Ready',
];

interface ContentFormState {
  heroHeading: string;
  heroSubheading: string;
  heroCta: string;
  aboutHeading: string;
  aboutParagraphs: string;
  services: Array<{ title: string; description: string }>;
}

const emptyContentForm: ContentFormState = {
  heroHeading: '',
  heroSubheading: '',
  heroCta: '',
  aboutHeading: '',
  aboutParagraphs: '',
  services: [],
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    businessName: '',
    industry: '',
    description: '',
  });
  const [contentForm, setContentForm] = useState<ContentFormState>(emptyContentForm);
  const [savingContent, setSavingContent] = useState(false);
  const [contentSaveMessage, setContentSaveMessage] = useState<string | null>(null);
  const [regeneratingPreview, setRegeneratingPreview] = useState(false);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
        setEditData({
          businessName: data.project.businessName || '',
          industry: data.project.industry || '',
          description: data.project.description || '',
        });

        const homepage = data.project.generatedContent?.homepage;
        if (homepage) {
          setContentForm({
            heroHeading: homepage.hero?.heading || '',
            heroSubheading: homepage.hero?.subheading || '',
            heroCta: homepage.hero?.ctaText || '',
            aboutHeading: homepage.about?.heading || '',
            aboutParagraphs: (homepage.about?.paragraphs || []).join('\n\n'),
            services: (homepage.services || []).map((s: { title?: string; description?: string }) => ({
              title: s.title || '',
              description: s.description || '',
            })),
          });
        }
      } else {
        router.push('/projects');
      }
    } catch (err) {
      console.error('Failed to load project:', err);
      router.push('/projects');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: editData.businessName,
          industry: editData.industry,
          description: editData.description,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Failed to save project:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!project) return;
    
    setGenerating(true);
    setProgress({ step: 'Starting...', progress: 0, status: 'Initializing' });
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          businessName: project.businessName,
          industry: project.industry,
          description: project.description,
          stylePreset: project.stylePreset,
          selectedTemplates: project.templateId ? [project.templateId] : undefined,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      if (data.success) {
        setProgress({ step: 'Complete', progress: 100, status: 'READY_FOR_PUBLISH' });
        await loadProject();
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error('Generation error:', err);
      setProgress({
        step: 'Error',
        progress: 0,
        status: err instanceof Error ? err.message : 'Generation failed',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveContent = async () => {
    if (!project) return;
    
    setSavingContent(true);
    setContentSaveMessage(null);
    
    try {
      // Convert form fields back to generatedContent structure
      const paragraphs = contentForm.aboutParagraphs.split('\n\n').filter(p => p.trim());
      const generatedContent = {
        homepage: {
          hero: {
            heading: contentForm.heroHeading,
            subheading: contentForm.heroSubheading,
            ctaText: contentForm.heroCta,
          },
          about: {
            heading: contentForm.aboutHeading,
            paragraphs,
          },
        },
        services: contentForm.services.map(s => ({
          title: s.title,
          description: s.description,
        })),
      };
      
      const response = await fetch(`/api/projects/${project.id}/apply-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatedContent }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save content');
      }
      
      setContentSaveMessage('Content saved and applied to your website!');
      await loadProject();
    } catch (err) {
      console.error('Save content error:', err);
      setContentSaveMessage(err instanceof Error ? err.message : 'Failed to save content');
    } finally {
      setSavingContent(false);
    }
  };

  const handleRegeneratePreview = async () => {
    if (!project) return;
    
    setRegeneratingPreview(true);
    setPreviewError(null);
    
    try {
      const response = await fetch(`/api/projects/${project.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate preview');
      }
      
      await loadProject();
    } catch (err) {
      console.error('Regenerate preview error:', err);
      setPreviewError(err instanceof Error ? err.message : 'Failed to regenerate preview');
    } finally {
      setRegeneratingPreview(false);
    }
  };

  const handlePublish = async () => {
    if (!project) return;
    
    setPublishing(true);
    setPublishError(null);
    setPublishSuccess(null);
    
    try {
      const response = await fetch(`/api/projects/${project.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to publish');
      }
      
      setPublishSuccess('Your website has been published to WordPress!');
      await loadProject();
    } catch (err) {
      console.error('Publish error:', err);
      setPublishError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="secondary">Draft</Badge>;
      case 'GENERATING':
        return <Badge variant="default" className="bg-blue-500">Generating</Badge>;
      case 'PREVIEW':
        return <Badge variant="default" className="bg-green-500">Preview Ready</Badge>;
      case 'PUBLISHED':
        return <Badge variant="default" className="bg-purple-500">Published</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-bold">Project not found</h2>
        <Button asChild><Link href="/projects">Back to Projects</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{project.businessName}</h1>
              {getStatusBadge(project.status)}
            </div>
            <p className="text-muted-foreground capitalize">
              {project.industry} • Created {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
            <Edit className="mr-2 h-4 w-4" />
            {isEditing ? 'Cancel Edit' : 'Edit'}
          </Button>
          <Button onClick={handleGenerate} disabled={generating || project.status === 'GENERATING'}>
            {generating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" />Generate Website</>
            )}
          </Button>
          {(project.elementorData as object | null) && (
            <Button variant="default" asChild>
              <Link href={`/projects/${project.id}/editor`}>
                <Edit className="mr-2 h-4 w-4" />
                Open Visual Editor
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Generation Progress */}
      {generating && progress && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{progress.step}</span>
                <span className="text-sm text-muted-foreground">{progress.progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200">
                <div 
                  className="h-full rounded-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <div className="space-y-1">
                {STEPS.map((step, i) => {
                  const stepProgress = Math.round((i / STEPS.length) * 100);
                  const isComplete = progress.progress >= stepProgress;
                  const isCurrent = progress.progress >= stepProgress - 10 && progress.progress < stepProgress + 10;
                  return (
                    <div key={step} className="flex items-center gap-2 text-sm">
                      {isComplete ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : isCurrent ? (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted" />
                      )}
                      <span className={isComplete ? 'text-foreground' : 'text-muted-foreground'}>{step}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generation Error */}
      {progress?.status === 'Error' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-700">{progress.step}</p>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setProgress(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="publish">Publish</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Business Name</Label>
                    <Input 
                      value={editData.businessName}
                      onChange={(e) => setEditData({ ...editData, businessName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <Input 
                      value={editData.industry}
                      onChange={(e) => setEditData({ ...editData, industry: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea 
                      rows={4}
                      value={editData.description}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Business Name</h4>
                    <p>{project.businessName}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Industry</h4>
                    <p className="capitalize">{project.industry || 'Not specified'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
                    <p className="text-muted-foreground">{project.description || 'No description'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Style</h4>
                    <p className="capitalize">{project.stylePreset || 'modern'}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <Card>
            <CardHeader>
              <CardTitle>Website Content</CardTitle>
              <CardDescription>
                Edit the AI-generated copy for your site. Saving applies your edits to the website immediately.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!project.generatedContent ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Content Not Generated Yet</h3>
                  <p className="text-muted-foreground mt-2 max-w-md">
                    Click "Generate Website" to create AI-powered content for your website based on your business details.
                  </p>
                  <Button className="mt-4" onClick={handleGenerate} disabled={generating}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Content
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-4 rounded-lg border p-4">
                    <h4 className="font-medium">Hero Section</h4>
                    <div className="space-y-2">
                      <Label>Heading</Label>
                      <Input
                        value={contentForm.heroHeading}
                        onChange={(e) => setContentForm({ ...contentForm, heroHeading: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subheading</Label>
                      <Input
                        value={contentForm.heroSubheading}
                        onChange={(e) => setContentForm({ ...contentForm, heroSubheading: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Call-to-action text</Label>
                      <Input
                        value={contentForm.heroCta}
                        onChange={(e) => setContentForm({ ...contentForm, heroCta: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 rounded-lg border p-4">
                    <h4 className="font-medium">About Section</h4>
                    <div className="space-y-2">
                      <Label>Heading</Label>
                      <Input
                        value={contentForm.aboutHeading}
                        onChange={(e) => setContentForm({ ...contentForm, aboutHeading: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Paragraphs (separate paragraphs with a blank line)</Label>
                      <Textarea
                        rows={6}
                        value={contentForm.aboutParagraphs}
                        onChange={(e) => setContentForm({ ...contentForm, aboutParagraphs: e.target.value })}
                      />
                    </div>
                  </div>

                  {contentForm.services.length > 0 && (
                    <div className="space-y-4 rounded-lg border p-4">
                      <h4 className="font-medium">Services</h4>
                      {contentForm.services.map((service, i) => (
                        <div key={i} className="space-y-2 rounded-md bg-muted/40 p-3">
                          <Label>Service {i + 1} title</Label>
                          <Input
                            value={service.title}
                            onChange={(e) => {
                              const next = [...contentForm.services];
                              next[i] = { ...next[i], title: e.target.value };
                              setContentForm({ ...contentForm, services: next });
                            }}
                          />
                          <Label>Description</Label>
                          <Textarea
                            rows={2}
                            value={service.description}
                            onChange={(e) => {
                              const next = [...contentForm.services];
                              next[i] = { ...next[i], description: e.target.value };
                              setContentForm({ ...contentForm, services: next });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Button onClick={handleSaveContent} disabled={savingContent}>
                      {savingContent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save & Apply to Website
                    </Button>
                    {contentSaveMessage && (
                      <p className={`text-sm ${contentSaveMessage.includes('Failed') || contentSaveMessage.includes('could not') ? 'text-red-600' : 'text-green-700'}`}>
                        {contentSaveMessage}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Website Preview</CardTitle>
              <CardDescription>Live rendering of your generated website</CardDescription>
            </CardHeader>
            <CardContent>
              {previewError && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {previewError}
                </div>
              )}
              {project.elementorData ? (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted overflow-hidden" style={{ height: '600px' }}>
                    <iframe
                      key={previewRefreshKey}
                      src={`/api/projects/${projectId}/render`}
                      title="Website Preview"
                      className="w-full h-full border-0"
                      sandbox="allow-same-origin"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This renders your actual generated Elementor content directly - not a screenshot. Widget
                    types not yet supported by the preview renderer show as a labeled placeholder instead of
                    being silently skipped.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => window.open(`/api/projects/${projectId}/render`, '_blank')}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Open Full Size
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPreviewRefreshKey((k) => k + 1)}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh Preview
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Eye className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Preview Not Available</h3>
                  <p className="text-muted-foreground mt-2 max-w-md">
                    Generate your website first to see the preview.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="publish">
          <Card>
            <CardHeader>
              <CardTitle>Publish to WordPress</CardTitle>
              <CardDescription>Deploy your website to your WordPress site</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {publishError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {publishError}
                </div>
              )}
              {publishSuccess && (
                <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  {publishSuccess}
                </div>
              )}
              {project.status === 'PREVIEW' || project.status === 'PUBLISHED' ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <p className="font-medium text-green-800">Your website is ready!</p>
                    </div>
                    <p className="text-sm text-green-700 mt-2">
                      {project.status === 'PUBLISHED' 
                        ? 'Your website has been published to WordPress. Publishing again updates the live page.'
                        : 'Your website preview is ready. Publish it to your WordPress site.'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handlePublish} disabled={publishing}>
                      {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {project.status === 'PUBLISHED' ? 'Re-publish to WordPress' : 'Publish to WordPress'}
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Configure WordPress
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Send className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Ready to Publish</h3>
                  <p className="text-muted-foreground mt-2 max-w-md">
                    Generate your website first, then publish it to your WordPress site.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Help */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Edit your project details anytime, then click "Generate Website" 
            to create new content. Your changes won't be published until you click "Publish to WordPress".
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
