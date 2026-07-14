'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Upload, Search, Type, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FontConfig } from '@/lib/types';

// Popular Google Fonts grouped by category
const GOOGLE_FONTS = {
  'Modern Sans': [
    { family: 'Inter', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { family: 'Plus Jakarta Sans', weights: [200, 300, 400, 500, 600, 700, 800] },
    { family: 'Outfit', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { family: 'Manrope', weights: [200, 300, 400, 500, 600, 700, 800] },
    { family: 'Space Grotesk', weights: [300, 400, 500, 600, 700] },
  ],
  'Classic Serif': [
    { family: 'Playfair Display', weights: [400, 500, 600, 700, 800, 900] },
    { family: 'Lora', weights: [400, 500, 600, 700] },
    { family: 'Merriweather', weights: [300, 400, 700, 900] },
    { family: 'Crimson Pro', weights: [200, 300, 400, 500, 600, 700, 800, 900] },
    { family: 'Libre Baskerville', weights: [400, 700] },
  ],
  'Display': [
    { family: 'Poppins', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { family: 'Montserrat', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { family: 'Raleway', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { family: 'Oswald', weights: [200, 300, 400, 500, 600, 700] },
    { family: 'Archivo', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  ],
  'Elegant': [
    { family: 'Cormorant Garamond', weights: [300, 400, 500, 600, 700] },
    { family: 'EB Garamond', weights: [400, 500, 600, 700, 800] },
    { family: 'Fraunces', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { family: 'Bodoni Moda', weights: [400, 500, 600, 700, 800, 900] },
  ],
  'Tech': [
    { family: 'JetBrains Mono', weights: [100, 200, 300, 400, 500, 600, 700, 800] },
    { family: 'Fira Code', weights: [300, 400, 500, 600, 700] },
    { family: 'Source Code Pro', weights: [200, 300, 400, 500, 600, 700, 800, 900] },
    { family: 'IBM Plex Mono', weights: [100, 200, 300, 400, 500, 600, 700] },
  ],
  'Handwritten': [
    { family: 'Caveat', weights: [400, 500, 600, 700] },
    { family: 'Pacifico', weights: [400] },
    { family: 'Dancing Script', weights: [400, 500, 600, 700] },
    { family: 'Satisfy', weights: [400] },
  ],
};

// Font pair recommendations
const FONT_PAIRINGS = [
  { heading: 'Playfair Display', body: 'Inter', style: 'Classic Elegant' },
  { heading: 'Montserrat', body: 'Open Sans', style: 'Modern Corporate' },
  { heading: 'Oswald', body: 'Lato', style: 'Bold Impact' },
  { heading: 'Poppins', body: 'Source Sans Pro', style: 'Clean Tech' },
  { heading: 'Merriweather', body: 'Open Sans', style: 'Readable Serif' },
  { heading: 'Fraunces', body: 'Inter', style: 'Sophisticated' },
  { heading: 'Space Grotesk', body: 'Inter', style: 'Modern Geometric' },
  { heading: 'Cormorant Garamond', body: 'Proza Libre', style: 'Luxury Editorial' },
];

interface FontManagerProps {
  fonts: FontConfig[];
  onChange: (fonts: FontConfig[]) => void;
  previewText?: string;
}

export function FontManager({ fonts, onChange, previewText = 'The quick brown fox jumps over the lazy dog' }: FontManagerProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Modern Sans');
  const [activeTab, setActiveTab] = useState('library');

  // Initialize with default fonts
  useEffect(() => {
    if (fonts.length === 0) {
      onChange([
        { id: 'heading', family: 'Inter', source: 'google', variants: ['700'], weights: [700], heading: true },
        { id: 'body', family: 'Inter', source: 'google', variants: ['400'], weights: [400], body: true },
      ]);
    }
  }, []);

  const addFont = (font: { family: string; weights: number[] }) => {
    const newFont: FontConfig = {
      id: `font-${Date.now()}`,
      family: font.family,
      source: 'google',
      variants: font.weights.map((w) => (w >= 700 ? '700' : w >= 400 ? '400' : '300')),
      weights: font.weights,
    };
    onChange([...fonts, newFont]);
  };

  const removeFont = (id: string) => {
    onChange(fonts.filter((f) => f.id !== id));
  };

  const setAsHeading = (id: string) => {
    onChange(fonts.map((f) => ({ ...f, heading: f.id === id, body: f.id === id ? false : f.body, button: f.id === id ? false : f.button, navigation: f.id === id ? false : f.navigation })));
  };

  const setAsBody = (id: string) => {
    onChange(fonts.map((f) => ({ ...f, body: f.id === id, heading: f.id === id ? false : f.heading, button: f.id === id ? false : f.button, navigation: f.id === id ? false : f.navigation })));
  };

  const setAsButton = (id: string) => {
    onChange(fonts.map((f) => ({ ...f, button: f.id === id, heading: f.id === id ? false : f.body, body: f.id === id ? false : f.body, navigation: f.id === id ? false : f.navigation })));
  };

  const setAsNavigation = (id: string) => {
    onChange(fonts.map((f) => ({ ...f, navigation: f.id === id, heading: f.id === id ? false : f.heading, body: f.id === id ? false : f.body, button: f.id === id ? false : f.button })));
  };

  const applyPairing = (pairing: { heading: string; body: string }) => {
    const headingFont = GOOGLE_FONTS['Classic Serif'].concat(GOOGLE_FONTS['Display'], GOOGLE_FONTS['Modern Sans'], GOOGLE_FONTS['Elegant'])
      .find((f) => f.family === pairing.heading);
    const bodyFont = [...Object.values(GOOGLE_FONTS).flat()]
      .find((f) => f.family === pairing.body);
    
    if (headingFont && bodyFont) {
      onChange([
        { id: 'heading', family: headingFont.family, source: 'google', variants: ['700'], weights: headingFont.weights, heading: true },
        { id: 'body', family: bodyFont.family, source: 'google', variants: ['400'], weights: bodyFont.weights, body: true },
      ]);
    }
  };

  const loadFont = (family: string) => {
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  };

  // Load all selected fonts
  fonts.forEach((font) => loadFont(font.family));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Type className="h-5 w-5" />
          <h3 className="font-semibold">Typography</h3>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="library">Font Library</TabsTrigger>
          <TabsTrigger value="pairings">Pairings</TabsTrigger>
          <TabsTrigger value="active">Active Fonts</TabsTrigger>
        </TabsList>

        {/* Font Library */}
        <TabsContent value="library" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search fonts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {Object.keys(GOOGLE_FONTS).map((category) => (
              <Badge
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                className="cursor-pointer whitespace-nowrap"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Badge>
            ))}
          </div>

          <div className="grid gap-3">
            {GOOGLE_FONTS[selectedCategory as keyof typeof GOOGLE_FONTS]
              .filter((font) => font.family.toLowerCase().includes(search.toLowerCase()))
              .map((font) => {
                loadFont(font.family);
                return (
                  <Card key={font.family} className="cursor-pointer transition-all hover:border-primary" onClick={() => addFont(font)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium" style={{ fontFamily: font.family }}>
                            {font.family}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Weights: {font.weights.join(', ')}
                          </p>
                        </div>
                        <Button variant="outline" size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          Add
                        </Button>
                      </div>
                      <p className="mt-2 text-lg" style={{ fontFamily: font.family }}>
                        {previewText}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </TabsContent>

        {/* Font Pairings */}
        <TabsContent value="pairings" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Curated font combinations that work well together.
          </p>
          <div className="grid gap-3">
            {FONT_PAIRINGS.map((pairing, i) => {
              const headingFont = [...Object.values(GOOGLE_FONTS).flat()].find((f) => f.family === pairing.heading);
              const bodyFont = [...Object.values(GOOGLE_FONTS).flat()].find((f) => f.family === pairing.body);
              if (headingFont) loadFont(headingFont.family);
              if (bodyFont) loadFont(bodyFont.family);
              return (
                <Card key={i} className="cursor-pointer hover:border-primary" onClick={() => applyPairing(pairing)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{pairing.style}</Badge>
                      <Button variant="ghost" size="sm">Apply</Button>
                    </div>
                    <p className="mt-3 text-2xl" style={{ fontFamily: pairing.heading }}>
                      {pairing.heading}
                    </p>
                    <p className="text-base" style={{ fontFamily: pairing.body }}>
                      {previewText}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {pairing.heading} + {pairing.body}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Active Fonts */}
        <TabsContent value="active" className="space-y-4">
          {fonts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fonts selected. Add fonts from the library or apply a pairing.</p>
          ) : (
            <div className="space-y-3">
              {fonts.map((font) => (
                <Card key={font.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium" style={{ fontFamily: font.family }}>
                          {font.family}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {font.source} • Weights: {font.weights.join(', ')}
                        </p>
                      </div>
                      <Button variant="destructive" size="icon" onClick={() => removeFont(font.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="mt-2 text-lg" style={{ fontFamily: font.family }}>
                      {previewText}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant={font.heading ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAsHeading(font.id)}
                      >
                        Heading
                      </Button>
                      <Button
                        variant={font.body ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAsBody(font.id)}
                      >
                        Body
                      </Button>
                      <Button
                        variant={font.button ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAsButton(font.id)}
                      >
                        Button
                      </Button>
                      <Button
                        variant={font.navigation ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAsNavigation(font.id)}
                      >
                        Navigation
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview */}
      <Card className="bg-gradient-to-br from-muted/50 to-muted">
        <CardHeader>
          <CardTitle className="text-lg">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {fonts.filter((f) => f.heading)[0] && (
              <h1 className="text-4xl font-bold" style={{ fontFamily: fonts.find((f) => f.heading)?.family }}>
                {previewText}
              </h1>
            )}
            {fonts.filter((f) => f.body)[0] && (
              <p className="text-base" style={{ fontFamily: fonts.find((f) => f.body)?.family }}>
                {previewText}
              </p>
            )}
            {fonts.filter((f) => f.navigation)[0] && (
              <nav className="flex gap-4" style={{ fontFamily: fonts.find((f) => f.navigation)?.family }}>
                <span>Home</span>
                <span>About</span>
                <span>Services</span>
                <span>Contact</span>
              </nav>
            )}
            {fonts.filter((f) => f.button)[0] && (
              <button
                className="rounded-lg bg-primary px-6 py-2 text-white"
                style={{ fontFamily: fonts.find((f) => f.button)?.family }}
              >
                Get Started
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
