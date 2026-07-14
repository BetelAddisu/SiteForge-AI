'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Search,
  Filter,
  Grid,
  List,
  Heart,
  Eye,
  Copy,
  MoreVertical,
  Star,
  FileStack,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface Template {
  id: string;
  name: string;
  category: string;
  industry?: string;
  style?: string;
  previewImage?: string;
  compatibilityScore?: number;
  tags: string[];
  isFavorite: boolean;
}

interface TemplateFilters {
  search: string;
  category: string;
  industry: string;
  style: string;
  compatibilityMin: number;
  compatibilityMax: number;
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_TEMPLATES: Template[] = [
  {
    id: '1',
    name: 'Modern Business Hero',
    category: 'hero',
    industry: 'technology',
    style: 'modern',
    previewImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop',
    compatibilityScore: 95,
    tags: ['hero', 'modern', 'tech'],
    isFavorite: true,
  },
  {
    id: '2',
    name: 'Classic Services Section',
    category: 'services',
    industry: 'consulting',
    style: 'corporate',
    previewImage: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600&h=400&fit=crop',
    compatibilityScore: 88,
    tags: ['services', 'corporate', 'classic'],
    isFavorite: false,
  },
  {
    id: '3',
    name: 'Minimal Portfolio',
    category: 'portfolio',
    industry: 'creative',
    style: 'minimal',
    previewImage: 'https://images.unsplash.com/photo-1559028012-481c04fa702d?w=600&h=400&fit=crop',
    compatibilityScore: 92,
    tags: ['portfolio', 'minimal', 'creative'],
    isFavorite: true,
  },
  {
    id: '4',
    name: 'Restaurant Menu Layout',
    category: 'menu',
    industry: 'restaurant',
    style: 'elegant',
    previewImage: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop',
    compatibilityScore: 75,
    tags: ['restaurant', 'menu', 'food'],
    isFavorite: false,
  },
  {
    id: '5',
    name: 'Medical Services',
    category: 'services',
    industry: 'medical',
    style: 'clean',
    previewImage: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&h=400&fit=crop',
    compatibilityScore: 98,
    tags: ['medical', 'healthcare', 'clean'],
    isFavorite: false,
  },
  {
    id: '6',
    name: 'E-commerce Homepage',
    category: 'homepage',
    industry: 'retail',
    style: 'modern',
    previewImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=400&fit=crop',
    compatibilityScore: 65,
    tags: ['ecommerce', 'shop', 'modern'],
    isFavorite: false,
  },
];

const CATEGORIES = ['all', 'hero', 'services', 'about', 'portfolio', 'pricing', 'team', 'testimonial', 'contact', 'footer'];
const INDUSTRIES = ['all', 'technology', 'consulting', 'creative', 'restaurant', 'medical', 'retail', 'real-estate'];
const STYLES = ['all', 'modern', 'minimal', 'corporate', 'elegant', 'clean', 'creative'];

// ============================================================================
// Components
// ============================================================================

function CompatibilityBadge({ score }: { score: number }) {
  if (score >= 80) {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {score}%
      </Badge>
    );
  }
  if (score >= 50) {
    return (
      <Badge variant="warning" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        {score}%
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" />
      {score}%
    </Badge>
  );
}

function TemplateCard({ template, view }: { template: Template; view: 'grid' | 'list' }) {
  const [isFavorite, setIsFavorite] = useState(template.isFavorite);

  if (view === 'list') {
    return (
      <Card className="flex overflow-hidden">
        <div className="w-64 flex-shrink-0">
          <img
            src={template.previewImage || '/placeholder.png'}
            alt={template.name}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex flex-1 flex-col">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <CardDescription className="mt-1">
                  {template.industry && <span className="capitalize">{template.industry}</span>}
                  {template.style && <span> • <span className="capitalize">{template.style}</span></span>}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {template.compatibilityScore !== undefined && (
                  <CompatibilityBadge score={template.compatibilityScore} />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFavorite(!isFavorite)}
                >
                  <Heart className={cn('h-4 w-4', isFavorite && 'fill-red-500 text-red-500')} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="flex flex-wrap gap-1">
              {template.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button variant="outline" size="sm">
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button size="sm">
              <Copy className="mr-2 h-4 w-4" />
              Use Template
            </Button>
          </CardFooter>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[3/2]">
        <img
          src={template.previewImage || '/placeholder.png'}
          alt={template.name}
          className="h-full w-full object-cover"
        />
        <div className="absolute right-2 top-2">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-white/90 hover:bg-white"
            onClick={() => setIsFavorite(!isFavorite)}
          >
            <Heart className={cn('h-4 w-4', isFavorite && 'fill-red-500 text-red-500')} />
          </Button>
        </div>
        {template.compatibilityScore !== undefined && (
          <div className="absolute left-2 top-2">
            <CompatibilityBadge score={template.compatibilityScore} />
          </div>
        )}
      </div>
      <CardHeader className="p-4">
        <CardTitle className="text-base">{template.name}</CardTitle>
        <CardDescription className="text-xs">
          {template.category} {template.industry && `• ${template.industry}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex flex-wrap gap-1">
          {template.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="gap-2 p-4 pt-0">
        <Button variant="outline" size="sm" className="flex-1">
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </Button>
        <Button size="sm" className="flex-1">
          Use
        </Button>
      </CardFooter>
    </Card>
  );
}

function FilterPanel({ filters, onChange }: { filters: TemplateFilters; onChange: (filters: TemplateFilters) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium">Category</label>
        <Select
          value={filters.category}
          onValueChange={(value) => onChange({ ...filters, category: value })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium">Industry</label>
        <Select
          value={filters.industry}
          onValueChange={(value) => onChange({ ...filters, industry: value })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((ind) => (
              <SelectItem key={ind} value={ind}>
                {ind === 'all' ? 'All Industries' : ind.charAt(0).toUpperCase() + ind.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium">Style</label>
        <Select
          value={filters.style}
          onValueChange={(value) => onChange({ ...filters, style: value })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STYLES.map((style) => (
              <SelectItem key={style} value={style}>
                {style === 'all' ? 'All Styles' : style.charAt(0).toUpperCase() + style.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium">Compatibility</label>
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Min: {filters.compatibilityMin}%</span>
            <span>Max: {filters.compatibilityMax}%</span>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              max="100"
              value={filters.compatibilityMin}
              onChange={(e) => onChange({ ...filters, compatibilityMin: parseInt(e.target.value) || 0 })}
              className="w-20"
            />
            <Input
              type="number"
              min="0"
              max="100"
              value={filters.compatibilityMax}
              onChange={(e) => onChange({ ...filters, compatibilityMax: parseInt(e.target.value) || 100 })}
              className="w-20"
            />
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => onChange({
          search: '',
          category: 'all',
          industry: 'all',
          style: 'all',
          compatibilityMin: 0,
          compatibilityMax: 100,
        })}
      >
        Reset Filters
      </Button>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function TemplatesPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<TemplateFilters>({
    search: '',
    category: 'all',
    industry: 'all',
    style: 'all',
    compatibilityMin: 0,
    compatibilityMax: 100,
  });

  // Filter templates
  const filteredTemplates = MOCK_TEMPLATES.filter((template) => {
    if (filters.search && !template.name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.category !== 'all' && template.category !== filters.category) {
      return false;
    }
    if (filters.industry !== 'all' && template.industry !== filters.industry) {
      return false;
    }
    if (filters.style !== 'all' && template.style !== filters.style) {
      return false;
    }
    if (template.compatibilityScore !== undefined) {
      if (template.compatibilityScore < filters.compatibilityMin) return false;
      if (template.compatibilityScore > filters.compatibilityMax) return false;
    }
    return true;
  });

  const activeFiltersCount = [
    filters.category !== 'all',
    filters.industry !== 'all',
    filters.style !== 'all',
    filters.compatibilityMin > 0 || filters.compatibilityMax < 100,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Library</h1>
          <p className="text-muted-foreground">
            Browse and select from {MOCK_TEMPLATES.length} templates
          </p>
        </div>
        <Button>
          <FileStack className="mr-2 h-4 w-4" />
          Import Templates
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filter Templates</SheetTitle>
                <SheetDescription>
                  Narrow down templates by category, industry, style, and compatibility.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <FilterPanel filters={filters} onChange={setFilters} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex rounded-md border">
            <Button
              variant={view === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-r-none"
              onClick={() => setView('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-l-none"
              onClick={() => setView('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <span>High compatibility (80-100)</span>
          <span className="text-muted-foreground">
            ({MOCK_TEMPLATES.filter((t) => (t.compatibilityScore || 0) >= 80).length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-yellow-500" />
          <span>Medium compatibility (50-79)</span>
          <span className="text-muted-foreground">
            ({MOCK_TEMPLATES.filter((t) => {
              const score = t.compatibilityScore || 0;
              return score >= 50 && score < 80;
            }).length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <span>Low compatibility (0-49)</span>
          <span className="text-muted-foreground">
            ({MOCK_TEMPLATES.filter((t) => (t.compatibilityScore || 0) < 50).length})
          </span>
        </div>
      </div>

      {/* Template Grid/List */}
      {filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <FileStack className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No templates found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Try adjusting your filters or search term
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setFilters({
              search: '',
              category: 'all',
              industry: 'all',
              style: 'all',
              compatibilityMin: 0,
              compatibilityMax: 100,
            })}
          >
            Clear Filters
          </Button>
        </div>
      ) : view === 'grid' ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTemplates.map((template) => (
            <TemplateCard key={template.id} template={template} view={view} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTemplates.map((template) => (
            <TemplateCard key={template.id} template={template} view={view} />
          ))}
        </div>
      )}
    </div>
  );
}
