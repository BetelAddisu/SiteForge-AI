'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, FileStack, Eye, ChevronRight, ChevronDown, RefreshCw, 
  Download, Loader2, X, LayoutGrid, Layers, Sparkles, ArrowRight 
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface TemplateItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  industry: string | null;
  kitId: string;
  kitName: string;
  kitSlug: string;
  previewImage: string | null;
  screenshotUrl: string | null;
  compatibilityScore: number;
}

interface TemplateKit {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  style: string | null;
  previewImage: string | null;
  thumbnailImage: string | null;
  templateCount: number;
  categories: string[];
  templates: TemplateItem[];
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORIES = [
  { value: 'hero', label: 'Hero' },
  { value: 'about', label: 'About' },
  { value: 'services', label: 'Services' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'team', label: 'Team' },
  { value: 'testimonial', label: 'Testimonials' },
  { value: 'contact', label: 'Contact' },
  { value: 'footer', label: 'Footer' },
  { value: 'header', label: 'Header' },
  { value: 'section', label: 'Section' },
  { value: 'blog', label: 'Blog' },
  { value: 'error', label: 'Error Pages' },
];

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Restaurant', 'Real Estate',
  'Creative', 'Education', 'Fitness', 'Legal', 'Travel', 'Non-Profit', 'E-commerce', 'Marketing',
];

const SESSION_KEY = 'siteforge_template_kits';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// ============================================================================
// Component
// ============================================================================

export default function TemplatesPage() {
  const [kits, setKits] = useState<TemplateKit[]>([]);
  const [filteredKits, setFilteredKits] = useState<TemplateKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [expandedKit, setExpandedKit] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<{ template: TemplateItem; screenshotUrl: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [viewMode, setViewMode] = useState<'kits' | 'all'>('kits');
  const initialized = useRef(false);

  // Load templates on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    // Check sessionStorage first
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) {
      try {
        const { kits: cachedKits, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION && cachedKits.length > 0) {
          setKits(cachedKits);
          setFilteredKits(cachedKits);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error('Cache error:', e);
      }
    }
    
    // Fetch from API
    loadTemplates(true);
  }, []);

  const loadTemplates = (forceRefresh = false) => {
    setLoading(true);
    const url = forceRefresh ? '/api/templates?refresh=true' : '/api/templates';
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
        const fetchedKits = data.kits || [];
        setKits(fetchedKits);
        setFilteredKits(fetchedKits);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ kits: fetchedKits, timestamp: Date.now() }));
      })
      .catch(err => {
        console.error('Failed to load templates:', err);
      })
      .finally(() => setLoading(false));
  };

  // Apply filters
  useEffect(() => {
    let result = [...kits];
    
    if (selectedCategory) {
      result = result.filter(kit => kit.categories.includes(selectedCategory));
    }
    
    if (selectedIndustry) {
      result = result.filter(kit => kit.industry === selectedIndustry);
    }
    
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(kit =>
        kit.name.toLowerCase().includes(s) ||
        (kit.industry && kit.industry.toLowerCase().includes(s)) ||
        kit.categories.some(c => c.toLowerCase().includes(s)) ||
        kit.templates.some(t => 
          t.name.toLowerCase().includes(s) ||
          t.category.toLowerCase().includes(s)
        )
      );
    }
    
    setFilteredKits(result);
  }, [kits, selectedCategory, selectedIndustry, search]);

  const handleRefresh = () => {
    sessionStorage.removeItem(SESSION_KEY);
    loadTemplates(true);
  };

  const openPreview = (template: TemplateItem) => {
    const screenshotUrl = template.previewImage || template.screenshotUrl || `/api/templates/screenshot?id=${template.id}`;
    setPreviewTemplate({ template, screenshotUrl });
    setShowPreview(true);
  };

  const toggleKit = (kitId: string) => {
    setExpandedKit(expandedKit === kitId ? null : kitId);
  };

  const hasFilters = search || selectedCategory || selectedIndustry;

  // Count total templates across all kits
  const totalTemplates = filteredKits.reduce((sum, kit) => sum + kit.templates.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Template Library</h1>
          <p className="text-muted-foreground">
            {loading 
              ? 'Loading...' 
              : `${filteredKits.length} Template Kits • ${totalTemplates} Templates`
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-100">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-purple-100 p-2">
              <Layers className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Template Kits</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Browse complete design systems. Each kit contains multiple related templates 
                (Home, About, Services, Header, Footer, etc.) that share the same visual language.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'kits' | 'all')}>
        <TabsList>
          <TabsTrigger value="kits" className="gap-2">
            <Layers className="h-4 w-4" />
            By Kit
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            All Templates
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search template kits or templates..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-10" 
          />
        </div>
        <select 
          value={selectedCategory || ''} 
          onChange={(e) => setSelectedCategory(e.target.value || null)} 
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select 
          value={selectedIndustry || ''} 
          onChange={(e) => setSelectedIndustry(e.target.value || null)} 
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">All Industries</option>
          {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      {/* Template Kits View */}
      {viewMode === 'kits' && (
        <>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredKits.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FileStack className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">{hasFilters ? 'No matching template kits' : 'No template kits yet'}</h3>
                <p className="text-muted-foreground mt-2">
                  {hasFilters ? 'Try adjusting your filters.' : 'Template kits will appear here after import.'}
                </p>
                {hasFilters && (
                  <Button variant="outline" className="mt-4" onClick={() => { setSearch(''); setSelectedCategory(null); setSelectedIndustry(null); }}>
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredKits.map((kit) => (
                <Card key={kit.id} className="overflow-hidden">
                  {/* Kit Header */}
                  <div 
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleKit(kit.id)}
                  >
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center transition-transform",
                      expandedKit === kit.id ? "bg-primary text-primary-foreground rotate-90" : "bg-muted"
                    )}>
                      <ChevronRight className="h-5 w-5" />
                    </div>
                    
                    {/* Kit Preview Image */}
                    <div className="h-16 w-24 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {kit.previewImage || kit.thumbnailImage ? (
                        <img 
                          src={kit.previewImage || kit.thumbnailImage || ''} 
                          alt={kit.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Layers className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    
                    {/* Kit Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">{kit.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {kit.industry && (
                          <Badge variant="secondary" className="text-xs">{kit.industry}</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {kit.templateCount} templates
                        </span>
                      </div>
                    </div>
                    
                    {/* Categories */}
                    <div className="hidden md:flex flex-wrap gap-1 max-w-xs">
                      {kit.categories.slice(0, 5).map(cat => (
                        <Badge key={cat} variant="outline" className="text-xs capitalize">{cat}</Badge>
                      ))}
                      {kit.categories.length > 5 && (
                        <Badge variant="outline" className="text-xs">+{kit.categories.length - 5}</Badge>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <Button variant="outline" size="sm" asChild onClick={(e) => e.stopPropagation()}>
                      <Link href={`/projects/new?kit=${kit.slug}`}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Use Kit
                      </Link>
                    </Button>
                  </div>
                  
                  {/* Expanded Template Grid */}
                  {expandedKit === kit.id && (
                    <div className="border-t bg-muted/30">
                      <div className="p-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {kit.templates.map((template) => (
                          <Card key={template.id} className="overflow-hidden group hover:shadow-md transition-shadow">
                            <div 
                              className="aspect-video bg-muted relative cursor-pointer overflow-hidden"
                              onClick={() => openPreview(template)}
                            >
                              {template.previewImage ? (
                                <img 
                                  src={template.previewImage} 
                                  alt={template.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <FileStack className="h-8 w-8 text-muted-foreground/50" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <div className="bg-white rounded-full p-2">
                                  <Eye className="h-5 w-5" />
                                </div>
                              </div>
                            </div>
                            <CardContent className="p-3">
                              <p className="font-medium text-sm truncate">{template.name}</p>
                              <div className="flex items-center justify-between mt-2">
                                <Badge variant="secondary" className="text-xs capitalize">{template.category}</Badge>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 text-xs"
                                  asChild
                                >
                                  <Link href={`/projects/new?template=${template.id}`}>
                                    Use <ArrowRight className="ml-1 h-3 w-3" />
                                  </Link>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* All Templates View */}
      {viewMode === 'all' && (
        <>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : totalTemplates === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FileStack className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">{hasFilters ? 'No matching templates' : 'No templates yet'}</h3>
                <p className="text-muted-foreground mt-2">{hasFilters ? 'Try adjusting your filters.' : 'Templates will appear here after import.'}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredKits.flatMap(kit => kit.templates).map((template) => (
                <Card key={template.id} className="overflow-hidden group hover:shadow-md transition-shadow">
                  <div 
                    className="aspect-video bg-muted relative cursor-pointer overflow-hidden"
                    onClick={() => openPreview(template)}
                  >
                    {template.previewImage ? (
                      <img 
                        src={template.previewImage} 
                        alt={template.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileStack className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <div className="bg-white rounded-full p-2">
                        <Eye className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                  <CardHeader className="p-3 pb-0">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{template.kitName}</p>
                  </CardHeader>
                  <CardContent className="p-3 pt-2">
                    <div className="flex flex-wrap gap-1 mb-3">
                      <Badge variant="secondary" className="text-xs capitalize">{template.category}</Badge>
                      {template.industry && (
                        <Badge variant="outline" className="text-xs">{template.industry}</Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openPreview(template)}>
                        <Eye className="mr-1 h-3 w-3" /> Preview
                      </Button>
                      <Button size="sm" className="flex-1" asChild>
                        <Link href={`/projects/new?template=${template.id}`}>
                          Use <ChevronRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Preview Modal */}
      {showPreview && previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowPreview(false)}>
          <div className="relative max-w-6xl w-full max-h-[95vh] bg-background rounded-lg overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/90 to-transparent">
              <div>
                <h2 className="text-xl font-bold text-white">{previewTemplate.template.name}</h2>
                <p className="text-sm text-gray-300">
                  {previewTemplate.template.kitName} • <span className="capitalize">{previewTemplate.template.category}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/projects/new?template=${previewTemplate.template.id}`}>
                    Use Template <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
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
            <strong>Tip:</strong> Click on a Template Kit to expand it and see all templates within. Each kit shares the same design system.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
