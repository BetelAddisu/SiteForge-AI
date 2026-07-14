'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Filter, FileStack, Eye, ChevronRight, RefreshCw, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  category: string;
  industry: string | null;
  kitName?: string;
  style: string | null;
  previewImage: string | null;
  screenshotUrl?: string | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
}

const CATEGORIES = [
  { value: 'hero', label: 'Hero Sections' },
  { value: 'about', label: 'About Us' },
  { value: 'services', label: 'Services' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'team', label: 'Team' },
  { value: 'testimonial', label: 'Testimonials' },
  { value: 'contact', label: 'Contact' },
  { value: 'footer', label: 'Footer' },
  { value: 'section', label: 'Sections' },
];

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

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadTemplates = async (forceRefresh = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory) params.set('category', selectedCategory);
      if (selectedIndustry) params.set('industry', selectedIndustry);
      if (search) params.set('search', search);
      if (forceRefresh) params.set('refresh', 'true');
      
      const response = await fetch(`/api/templates?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      setImporting(true);
      setImportResult(null);
      
      const response = await fetch('/api/templates/import', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok) {
        setImportResult({
          success: true,
          message: `Imported ${data.results?.templatesImported || 0} templates!`,
        });
        // Refresh templates list
        await loadTemplates(true);
      } else {
        setImportResult({
          success: false,
          message: data.error || 'Import failed',
        });
      }
    } catch (err) {
      setImportResult({
        success: false,
        message: 'Failed to connect to server',
      });
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTemplates();
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedCategory, selectedIndustry, search]);

  const showEmptyState = !loading && templates.length === 0 && !search && !selectedCategory && !selectedIndustry;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Library</h1>
          <p className="text-muted-foreground">
            {templates.length} Elementor templates ready for your projects
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => loadTemplates(true)} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
          {showEmptyState && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Import Templates
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <Card className={importResult.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
          <CardContent className="py-3">
            <p className={importResult.success ? 'text-green-700' : 'text-red-700'}>
              {importResult.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          <select
            value={selectedIndustry || ''}
            onChange={(e) => setSelectedIndustry(e.target.value || null)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">All Industries</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4">
              <FileStack className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium">No templates found</h3>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {search || selectedCategory || selectedIndustry
                ? 'Try adjusting your search or filters.'
                : 'Click "Import Templates" to load templates from Supabase storage.'}
            </p>
            {!search && !selectedCategory && !selectedIndustry && (
              <Button className="mt-4" onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing from Supabase...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Import Templates
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="overflow-hidden">
              <div className="aspect-video bg-muted">
                {template.previewImage || template.screenshotUrl ? (
                  <img
                    src={template.previewImage || template.screenshotUrl || ''}
                    alt={template.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <FileStack className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="capitalize">
                      {template.industry || template.kitName || 'General'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="capitalize">
                    {template.category}
                  </Badge>
                  {template.style && (
                    <Badge variant="outline" className="capitalize">
                      {template.style}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/templates/${template.id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </Link>
                  </Button>
                  <Button size="sm" className="flex-1" asChild>
                    <Link href={`/projects/new?template=${template.id}`}>
                      Use Template
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Help Text */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            <strong>Tip:</strong> Templates are assembled from Elementor sections. When creating a project, 
            the AI selects the best sections from multiple templates to create a cohesive website for your industry.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
