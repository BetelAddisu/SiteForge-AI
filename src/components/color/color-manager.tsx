'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Copy, Check, Palette, Sparkles, Download, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandColor, ColorPalette } from '@/lib/types';

interface ColorManagerProps {
  palettes: ColorPalette[];
  onChange: (palettes: ColorPalette[]) => void;
}

const COLOR_TYPES: BrandColor['type'][] = ['primary', 'secondary', 'accent', 'neutral', 'custom'];

const PRESET_PALETTES: ColorPalette[] = [
  {
    id: 'modern-blue',
    name: 'Modern Blue',
    isDefault: true,
    colors: [
      { id: 'c1', name: 'Primary', hex: '#2563EB', type: 'primary' },
      { id: 'c2', name: 'Secondary', hex: '#1E40AF', type: 'secondary' },
      { id: 'c3', name: 'Accent', hex: '#F59E0B', type: 'accent' },
      { id: 'c4', name: 'Background', hex: '#F8FAFC', type: 'neutral' },
      { id: 'c5', name: 'Text', hex: '#1F2937', type: 'neutral' },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'luxury-gold',
    name: 'Luxury Gold',
    isDefault: false,
    colors: [
      { id: 'c1', name: 'Primary', hex: '#1C1917', type: 'primary' },
      { id: 'c2', name: 'Secondary', hex: '#78716C', type: 'secondary' },
      { id: 'c3', name: 'Accent', hex: '#D4AF37', type: 'accent' },
      { id: 'c4', name: 'Background', hex: '#FAFAF9', type: 'neutral' },
      { id: 'c5', name: 'Text', hex: '#292524', type: 'neutral' },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'nature-green',
    name: 'Nature Green',
    isDefault: false,
    colors: [
      { id: 'c1', name: 'Primary', hex: '#059669', type: 'primary' },
      { id: 'c2', name: 'Secondary', hex: '#047857', type: 'secondary' },
      { id: 'c3', name: 'Accent', hex: '#FBBF24', type: 'accent' },
      { id: 'c4', name: 'Background', hex: '#ECFDF5', type: 'neutral' },
      { id: 'c5', name: 'Text', hex: '#064E3B', type: 'neutral' },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'minimal-dark',
    name: 'Minimal Dark',
    isDefault: false,
    colors: [
      { id: 'c1', name: 'Primary', hex: '#FFFFFF', type: 'primary' },
      { id: 'c2', name: 'Secondary', hex: '#A1A1AA', type: 'secondary' },
      { id: 'c3', name: 'Accent', hex: '#3B82F6', type: 'accent' },
      { id: 'c4', name: 'Background', hex: '#09090B', type: 'neutral' },
      { id: 'c5', name: 'Text', hex: '#FAFAFA', type: 'neutral' },
    ],
    createdAt: new Date().toISOString(),
  },
];

function generateComplementary(hex: string): string[] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  const comp = { r: 255 - r, g: 255 - g, b: 255 - b };
  return [
    hex,
    `#${comp.r.toString(16).padStart(2, '0')}${comp.g.toString(16).padStart(2, '0')}${comp.b.toString(16).padStart(2, '0')}`,
  ];
}

function generateMonochromatic(hex: string): string[] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  const variations = [0.3, 0.5, 0.7, 0.9, 1.1];
  return variations.map((factor) => {
    const nr = Math.min(255, Math.round(r * factor));
    const ng = Math.min(255, Math.round(g * factor));
    const nb = Math.min(255, Math.round(b * factor));
    return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
  });
}

function generateAnalogous(hex: string): string[] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  const hsl = rgbToHsl(r, g, b);
  const angles = [-30, -15, 0, 15, 30];
  
  return angles.map((angle) => {
    const newHue = (hsl.h + angle + 360) % 360;
    const rgb = hslToRgb(newHue, hsl.s, hsl.l);
    return `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;
  });
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

export function ColorManager({ palettes, onChange }: ColorManagerProps) {
  const [selectedPalette, setSelectedPalette] = useState(palettes[0]?.id || 'modern-blue');
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  const currentPalette = palettes.find((p) => p.id === selectedPalette) || palettes[0];

  const addColor = () => {
    if (!currentPalette) return;
    const newColor: BrandColor = {
      id: `c${Date.now()}`,
      name: 'New Color',
      hex: '#6366F1',
      type: 'custom',
    };
    const updated = palettes.map((p) =>
      p.id === selectedPalette ? { ...p, colors: [...p.colors, newColor] } : p
    );
    onChange(updated);
  };

  const updateColor = (colorId: string, updates: Partial<BrandColor>) => {
    const updated = palettes.map((p) =>
      p.id === selectedPalette
        ? { ...p, colors: p.colors.map((c) => (c.id === colorId ? { ...c, ...updates } : c)) }
        : p
    );
    onChange(updated);
  };

  const deleteColor = (colorId: string) => {
    const updated = palettes.map((p) =>
      p.id === selectedPalette ? { ...p, colors: p.colors.filter((c) => c.id !== colorId) } : p
    );
    onChange(updated);
  };

  const copyColor = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedColor(hex);
    setTimeout(() => setCopiedColor(null), 2000);
  };

  const addPalette = (palette: ColorPalette) => {
    onChange([...palettes, { ...palette, id: `${palette.id}-${Date.now()}` }]);
    setSelectedPalette(`${palette.id}-${Date.now()}`);
    setShowPresets(false);
  };

  const generateFromColor = (baseColor: string, type: 'complementary' | 'monochromatic' | 'analogous') => {
    let colors: string[] = [];
    switch (type) {
      case 'complementary': colors = generateComplementary(baseColor); break;
      case 'monochromatic': colors = generateMonochromatic(baseColor); break;
      case 'analogous': colors = generateAnalogous(baseColor); break;
    }
    
    const newPalette: ColorPalette = {
      id: `generated-${Date.now()}`,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Palette`,
      isDefault: false,
      colors: colors.map((hex, i) => ({
        id: `gc${i}`,
        name: `Color ${i + 1}`,
        hex,
        type: i === 0 ? 'primary' : 'custom',
      })),
      createdAt: new Date().toISOString(),
    };
    addPalette(newPalette);
  };

  const exportPalette = () => {
    if (!currentPalette) return;
    const data = JSON.stringify(currentPalette, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentPalette.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          <h3 className="font-semibold">Color Management</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPresets(!showPresets)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Presets
          </Button>
          <Button variant="outline" size="sm" onClick={exportPalette}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Preset Palettes */}
      {showPresets && (
        <div className="grid grid-cols-2 gap-3">
          {PRESET_PALETTES.map((preset) => (
            <Card
              key={preset.id}
              className={cn(
                'cursor-pointer transition-all hover:border-primary',
                selectedPalette === preset.id && 'border-primary'
              )}
              onClick={() => addPalette(preset)}
            >
              <CardContent className="p-3">
                <div className="flex gap-1">
                  {preset.colors.map((color) => (
                    <div
                      key={color.id}
                      className="h-8 flex-1 rounded"
                      style={{ backgroundColor: color.hex }}
                      title={color.hex}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs font-medium">{preset.name}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Palette Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {palettes.map((palette) => (
          <Badge
            key={palette.id}
            variant={selectedPalette === palette.id ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSelectedPalette(palette.id)}
          >
            {palette.name}
          </Badge>
        ))}
        <Button variant="ghost" size="sm" onClick={() => addPalette(PRESET_PALETTES[0])}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Colors Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {currentPalette?.colors.map((color) => (
          <div
            key={color.id}
            className="group relative rounded-lg border bg-card"
          >
            <div
              className="aspect-square rounded-t-lg"
              style={{ backgroundColor: color.hex }}
            />
            <div className="p-3">
              <Input
                value={color.hex}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                    updateColor(color.id, { hex: val });
                  }
                }}
                className="h-8 text-xs font-mono"
              />
              <Input
                value={color.name}
                onChange={(e) => updateColor(color.id, { name: e.target.value })}
                className="mt-1 h-8 text-xs"
                placeholder="Color name"
              />
              <select
                value={color.type}
                onChange={(e) => updateColor(color.id, { type: e.target.value as BrandColor['type'] })}
                className="mt-1 w-full rounded border bg-transparent px-2 py-1 text-xs"
              >
                {COLOR_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="secondary"
                size="icon"
                className="h-6 w-6"
                onClick={() => copyColor(color.hex)}
              >
                {copiedColor === color.hex ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="destructive"
                size="icon"
                className="h-6 w-6"
                onClick={() => deleteColor(color.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
        
        {/* Add Color Button */}
        <button
          onClick={addColor}
          className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-primary hover:bg-muted/50"
        >
          <Plus className="h-8 w-8 text-muted-foreground" />
          <span className="mt-1 text-xs text-muted-foreground">Add Color</span>
        </button>
      </div>

      {/* Generate Palettes */}
      <div className="rounded-lg bg-muted/50 p-4">
        <h4 className="mb-3 text-sm font-medium">Generate Palettes</h4>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateFromColor(currentPalette?.colors[0]?.hex || '#3B82F6', 'complementary')}
          >
            Complementary
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateFromColor(currentPalette?.colors[0]?.hex || '#3B82F6', 'monochromatic')}
          >
            Monochromatic
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateFromColor(currentPalette?.colors[0]?.hex || '#3B82F6', 'analogous')}
          >
            Analogous
          </Button>
        </div>
      </div>
    </div>
  );
}

export const DEFAULT_PALETTES = PRESET_PALETTES;
