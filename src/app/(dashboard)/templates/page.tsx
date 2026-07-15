'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, FileStack, Eye, ChevronRight, RefreshCw, Download, Loader2, X } from 'lucide-react';

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
  'Technology', 'Healthcare', 'Finance', 'Restaurant', 'Real Estate',
  'Creative', 'Education', 'Fitness', 'Legal', 'Travel', 'Non-Profit', 'E-commerce', 'Marketing',
];

const SESSION_KEY = 'siteforge_templates';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<{ template: Template; screenshotUrl: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const initialized = useRef(false);

  // Load templates on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    // Check sessionStorage first
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) {
      try {
        const { templates: cachedTemplates, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION && cachedTemplates.length > 0) {
          setTemplates(cachedTemplates);
          setFilteredTemplates(cachedTemplates);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error('Cache error:', e);
      }
    }
    
    // Fetch from API
    fetch('/api/templates?refresh=true')
      .then(res => res.json())
      .then(data => {
        const fetched = data.templates || [];
        setTemplates(fetched);
        setFilteredTemplates(fetched);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ templates: fetched, timestamp: Date.now() }));
      })
      .catch(err => console.error('Failed to load templates:', err))
      .finally(() => setLoading(false));
  }, []);

  // Apply filters
  useEffect(() => {
    let result = [...templates];
    if (selectedCategory) result = result.filter(t => t.category === selectedCategory);
    if (selectedIndustry) result = result.filter(t => t.industry === selectedIndustry);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(s) ||
        t.industry?.toLowerCase().includes(s) ||
        t.category.toLowerCase().includes(s) ||
        t.kitName?.toLowerCase().includes(s)
      );
    }
    setFilteredTemplates(result);
  }, [templates, selectedCategory, selectedIndustry, search]);

  const handleRefresh = () => {
    setLoading(true);
    sessionStorage.removeItem(SESSION_KEY);
    fetch('/api/templates?refresh=true')
      .then(res => res.json())
      .then(data => {
        const fetched = data.templates || [];
        setTemplates(fetched);
        setFilteredTemplates(fetched);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ templates: fetched, timestamp: Date.now() }));
      })
      .catch(err => console.error('Failed to load templates:', err))
      .finally(() => setLoading(false));
  };

  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const response = await fetch('/api/templates/import', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setImportResult({ success: true, message: `Imported ${data.results?.templatesImported || 0} templates!` });
        handleRefresh();
      } else {
        setImportResult({ success: false, message: data.error || 'Import failed' });
      }
    } catch {
      setImportResult({ success: false, message: 'Failed to connect to server' });
    } finally {
      setImporting(false);
    }
  };

  const openPreview = (template: Template) => {
    const screenshotUrl = template.previewImage || template.screenshotUrl || `/api/templates/screenshot?id=${template.id}`;
    setPreviewTemplate({ template, screenshotUrl });
    setShowPreview(true);
  };

  const hasFilters = search || selectedCategory || selectedIndustry;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Template Library</h1>
          <p className="text-muted-foreground">
            {loading ? 'Loading...' : `${filteredTemplates.length} templates${filteredTemplates.length !== templates.length ? ` (${templates.length} total)` : ''}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleImport} disabled={importing}>
            {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</> : <><Download className="mr-2 h-4 w-4" />Import Templates</>}
          </Button>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <Card className={importResult.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
          <CardContent className="flex items-center justify-between py-3">
            <p className={importResult.success ? 'text-green-700' : 'text-red-700'}>{importResult.message}</p>
            <Button variant="ghost" size="sm" onClick={() => setImportResult(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search templates..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <select value={selectedCategory || ''} onChange={(e) => setSelectedCategory(e.target.value || null)} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={selectedIndustry || ''} onChange={(e) => setSelectedIndustry(e.target.value || null)} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">All Industries</option>
          {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileStack className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">{hasFilters ? 'No matching templates' : 'No templates yet'}</h3>
            <p className="text-muted-foreground mt-2">{hasFilters ? 'Try adjusting your filters.' : 'Click "Import Templates" to load templates.'}</p>
            {hasFilters && (
              <Button variant="outline" className="mt-4" onClick={() => { setSearch(''); setSelectedCategory(null); setSelectedIndustry(null); }}>
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="overflow-hidden">
              <div className="aspect-video bg-muted relative cursor-pointer group" onClick={() => openPreview(template)}>
                {template.previewImage || template.screenshotUrl ? (
                  <img src={template.previewImage || template.screenshotUrl || ''} alt={template.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full"><FileStack className="h-12 w-12 text-muted-foreground/50" /></div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="bg-white rounded-full p-3"><Eye className="h-6 w-6" /></div>
                </div>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <p className="text-sm text-muted-foreground capitalize">{template.industry || template.kitName || 'General'}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="capitalize">{template.category}</Badge>
                  {template.style && <Badge variant="outline" className="capitalize">{template.style}</Badge>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openPreview(template)}>
                    <Eye className="mr-2 h-4 w-4" />Preview
                  </Button>
                  <Button size="sm" className="flex-1" asChild>
                    <Link href={`/projects/new?template=${template.id}`}>Use<ChevronRight className="ml-1 h-4 w-4" /></Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowPreview(false)}>
          <div className="relative max-w-6xl w-full max-h-[95vh] bg-background rounded-lg overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/90 to-transparent">
              <div>
                <h2 className="text-xl font-bold text-white">{previewTemplate.template.name}</h2>
                <p className="text-sm text-gray-300">{previewTemplate.template.kitName} • {previewTemplate.template.category}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/projects/new?template=${previewTemplate.template.id}`}>Use Template<ChevronRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setShowPreview(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="overflow-auto max-h-[95vh] pt-16 bg-gray-100">
              <img
                src={previewTemplate.screenshotUrl}
                alt={previewTemplate.template.name}
                className="w-full h-auto"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = 'none';
                  img.insertAdjacentHTML('afterend', `
                    <div class="flex flex-col items-center justify-center h-96 bg-muted">
                      <FileStack class="h-16 w-16 text-muted-foreground/50 mb-4" />
                      <p class="text-muted-foreground">Preview unavailable</p>
                    </div>
                  `);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            <strong>Tip:</strong> Templates are cached in your session. Click "Refresh" to reload templates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
