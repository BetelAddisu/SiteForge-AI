'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, FileStack, Eye, ChevronRight, RefreshCw, Download, Loader2, X, ExternalLink } from 'lucide-react';

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
  { value: 'header', label: 'Header' },
  { value: 'error', label: 'Error Pages' },
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
  'Marketing',
];

const SESSION_KEY = 'siteforge_templates_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CachedTemplates {
  templates: Template[];
  timestamp: number;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Load from session cache
  const loadFromCache = useCallback((): Template[] | null => {
    try {
      const cached = sessionStorage.getItem(SESSION_KEY);
      if (cached) {
        const data: CachedTemplates = JSON.parse(cached);
        if (Date.now() - data.timestamp < CACHE_DURATION) {
          return data.templates;
        }
      }
    } catch (e) {
      console.error('Cache read error:', e);
    }
    return null;
  }, []);

  // Save to session cache
  const saveToCache = useCallback((templates: Template[]) => {
    try {
      const data: CachedTemplates = {
        templates,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Cache write error:', e);
    }
  }, []);

  const loadTemplates = useCallback(async (forceRefresh = false) => {
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = loadFromCache();
      if (cached && cached.length > 0) {
        setTemplates(cached);
        setFilteredTemplates(cached);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      const response = await fetch('/api/templates?refresh=true');
      if (response.ok) {
        const data = await response.json();
        const fetchedTemplates = data.templates || [];
        setTemplates(fetchedTemplates);
        setFilteredTemplates(fetchedTemplates);
        saveToCache(fetchedTemplates);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  }, [loadFromCache, saveToCache]);

  // Apply filters locally
  useEffect(() => {
    let result = [...templates];

    if (selectedCategory) {
      result = result.filter(t => t.category === selectedCategory);
    }
    if (selectedIndustry) {
      result = result.filter(t => t.industry === selectedIndustry);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        (t.industry && t.industry.toLowerCase().includes(searchLower)) ||
        t.category.toLowerCase().includes(searchLower) ||
        (t.kitName && t.kitName.toLowerCase().includes(searchLower))
      );
    }

    setFilteredTemplates(result);
  }, [templates, selectedCategory, selectedIndustry, search]);

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

  const handlePreview = async (template: Template) => {
    setSelectedTemplate(template);
    setPreviewLoading(true);
    
    // Load full preview if not available
    if (!template.screenshotUrl && !template.previewImage) {
      try {
        const response = await fetch(`/api/templates/${template.id}`);
        if (response.ok) {
          const data = await response.json();
          setSelectedTemplate({ ...template, ...data.template });
        }
      } catch (e) {
        console.error('Failed to load preview:', e);
      }
    }
    
    setPreviewLoading(false);
  };

  // Initial load
  useEffect(() => {
    loadTemplates();
  }, []);

  const showEmptyState = !loading && filteredTemplates.length === 0 && !search && !selectedCategory && !selectedIndustry;
  const showNoResults = !loading && filteredTemplates.length === 0 && (search || selectedCategory || selectedIndustry);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Library</h1>
          <p className="text-muted-foreground">
            {filteredTemplates.length} templates {filteredTemplates.length !== templates.length && `(filtered from ${templates.length})`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => loadTemplates(true)}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
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
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <Card className={importResult.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
          <CardContent className="flex items-center justify-between py-3">
            <p className={importResult.success ? 'text-green-700' : 'text-red-700'}>
              {importResult.message}
            </p>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setImportResult(null)}
            >
              Dismiss
            </Button>
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
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4">
              <FileStack className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium">
              {showNoResults ? 'No matching templates' : 'No templates yet'}
            </h3>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {showNoResults 
                ? 'Try adjusting your search or filters.'
                : showEmptyState
                  ? 'Click "Import Templates" to load templates from Supabase storage.'
                  : 'Something went wrong loading templates.'}
            </p>
            {showNoResults && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => {
                  setSearch('');
                  setSelectedCategory(null);
                  setSelectedIndustry(null);
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="overflow-hidden">
              <button 
                className="w-full aspect-video bg-muted relative group cursor-pointer"
                onClick={() => handlePreview(template)}
              >
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
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="bg-white rounded-full p-3">
                    <Eye className="h-6 w-6 text-gray-900" />
                  </div>
                </div>
              </button>
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handlePreview(template)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
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

      {/* Preview Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative max-w-5xl w-full max-h-[90vh] bg-background rounded-lg overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedTemplate.name}</h2>
                <p className="text-sm text-gray-300">
                  {selectedTemplate.kitName && `${selectedTemplate.kitName} • `}
                  {selectedTemplate.category} • {selectedTemplate.industry || 'General'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/projects/new?template=${selectedTemplate.id}`}>
                    Use Template
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => setSelectedTemplate(null)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            {/* Preview Image */}
            <div className="overflow-auto max-h-[90vh] pt-14">
              {previewLoading ? (
                <div className="flex items-center justify-center h-96">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : selectedTemplate.previewImage || selectedTemplate.screenshotUrl ? (
                <img
                  src={selectedTemplate.previewImage || selectedTemplate.screenshotUrl || ''}
                  alt={selectedTemplate.name}
                  className="w-full h-auto"
                  onError={(e) => {
                    (e.target as HTMLImageElement).parentElement!.innerHTML = `
                      <div class="flex flex-col items-center justify-center h-96 bg-muted">
                        <FileStack class="h-16 w-16 text-muted-foreground/50 mb-4" />
                        <p class="text-muted-foreground">Preview image not available</p>
                      </div>
                    `;
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-96 bg-muted">
                  <FileStack className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Preview image not available</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    This template will be imported with screenshots on next refresh.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            <strong>Tip:</strong> Templates are cached in your session. Click "Refresh" to reload templates if you add new ones to Supabase storage.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
