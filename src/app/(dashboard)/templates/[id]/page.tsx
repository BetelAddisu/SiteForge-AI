'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Eye, Copy, CheckCircle2, AlertTriangle, XCircle, Smartphone, Tablet, Monitor, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Template {
  id: string;
  name: string;
  category: string;
  industry?: string | null;
  kitName?: string;
  style?: string;
  previewImage?: string | null;
  screenshotUrl?: string | null;
  compatibilityScore?: number;
  tags: string[];
  metadata?: {
    colorPalette?: string[];
    sectionCount?: number;
    kitName?: string;
    kitSlug?: string;
  };
}

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewSize, setPreviewSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  useEffect(() => {
    const fetchTemplate = async () => {
      const id = params.id as string;
      
      try {
        const response = await fetch(`/api/templates/${id}`);
        if (response.ok) {
          const data = await response.json();
          setTemplate(data.template);
        } else {
          // Template not found
          setTemplate(null);
        }
      } catch (err) {
        console.error('Failed to fetch template:', err);
        setTemplate(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-bold">Template not found</h2>
        <p className="text-muted-foreground">The template you&apos;re looking for doesn&apos;t exist.</p>
        <Button asChild>
          <Link href="/templates">Back to Library</Link>
        </Button>
      </div>
    );
  }

  const previewWidth = previewSize === 'desktop' ? '100%' : previewSize === 'tablet' ? '768px' : '375px';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/templates">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{template.name}</h1>
            <p className="text-muted-foreground">
              {template.kitName && <span>{template.kitName} • </span>}
              {template.category} {template.industry && `• ${template.industry}`} {template.style && `• ${template.style}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/projects/new?template=${template.id}`}>Create Project</Link>
          </Button>
          <Button asChild>
            <Link href={`/generator?template=${template.id}`}>Use Template</Link>
          </Button>
        </div>
      </div>

      {/* Compatibility Badge */}
      {template.compatibilityScore !== undefined && (
        <div className="flex items-center gap-2">
          {template.compatibilityScore >= 80 ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              High Compatibility ({template.compatibilityScore}%)
            </Badge>
          ) : template.compatibilityScore >= 50 ? (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Medium Compatibility ({template.compatibilityScore}%)
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              Low Compatibility ({template.compatibilityScore}%)
            </Badge>
          )}
          {template.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Preview Controls */}
      <div className="flex items-center justify-between rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Preview Size:</span>
          <div className="flex rounded-md border">
            <Button
              variant={previewSize === 'desktop' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => setPreviewSize('desktop')}
            >
              <Monitor className="mr-2 h-4 w-4" />
              Desktop
            </Button>
            <Button
              variant={previewSize === 'tablet' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setPreviewSize('tablet')}
            >
              <Tablet className="mr-2 h-4 w-4" />
              Tablet
            </Button>
            <Button
              variant={previewSize === 'mobile' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => setPreviewSize('mobile')}
            >
              <Smartphone className="mr-2 h-4 w-4" />
              Mobile
            </Button>
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Eye className="mr-2 h-4 w-4" />
          Full Screen Preview
        </Button>
      </div>

      {/* Preview */}
      <div className="flex justify-center rounded-lg border bg-muted/50 p-4">
        <div
          className="overflow-hidden rounded-lg border-2 border-border transition-all duration-300"
          style={{ width: previewWidth, maxWidth: '100%' }}
        >
          {template.previewImage || template.screenshotUrl ? (
            <img
              src={template.previewImage || template.screenshotUrl || ''}
              alt={template.name}
              className="w-full"
            />
          ) : (
            <div className="flex h-64 items-center justify-center bg-muted">
              <p className="text-muted-foreground">No preview available</p>
            </div>
          )}
        </div>
      </div>

      {/* Details Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="compatibility">Compatibility</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Template Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Category</h4>
                  <p className="capitalize">{template.category}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Industry</h4>
                  <p className="capitalize">{template.industry || 'Not specified'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Style</h4>
                  <p className="capitalize">{template.style || 'Not specified'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Sections</h4>
                  <p>{template.metadata?.sectionCount || 'N/A'}</p>
                </div>
              </div>
              {template.metadata?.colorPalette && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Color Palette</h4>
                  <div className="mt-2 flex gap-2">
                    {template.metadata.colorPalette.map((color, i) => (
                      <div
                        key={i}
                        className="h-10 w-10 rounded-md border"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="structure">
          <Card>
            <CardHeader>
              <CardTitle>Template Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Widget structure analysis coming soon. This will show the Elementor widget hierarchy.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compatibility">
          <Card>
            <CardHeader>
              <CardTitle>Compatibility Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold">{template.compatibilityScore || 0}%</div>
                <div className="text-muted-foreground">
                  {template.compatibilityScore && template.compatibilityScore >= 80
                    ? 'This template can be automatically modified.'
                    : template.compatibilityScore && template.compatibilityScore >= 50
                    ? 'Some manual review may be required.'
                    : 'This template may require repair or manual modification.'}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Detected Widgets:</h4>
                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  <li>Heading widgets</li>
                  <li>Text Editor widgets</li>
                  <li>Image widgets</li>
                  <li>Button widgets</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
