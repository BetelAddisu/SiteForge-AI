'use client';

import React, { useState, useCallback, useRef } from 'react';
import { 
  ChevronDown, ChevronUp, ChevronRight, GripVertical, 
  Trash2, Copy, Eye, Save, Undo, Redo,
  AlignLeft, AlignCenter, AlignRight,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

// Types
interface ElementorElement {
  id: string;
  elType: string;
  widgetType?: string;
  settings?: Record<string, unknown>;
  elements?: ElementorElement[];
}

interface ElementorData {
  version?: string;
  elements: ElementorElement[];
  [key: string]: unknown;
}

interface SelectedElement {
  id: string;
  element: ElementorElement;
  path: number[];
}

// Widget type to icon mapping
const widgetIcons: Record<string, string> = {
  heading: 'H',
  'text-editor': '¶',
  image: '🖼',
  button: '🔘',
  icon: '★',
  'social-icons': '◎',
  video: '▶',
  divider: '—',
  spacer: '↕',
  'icon-box': '◉',
  'image-box': '▢',
  testimonial: '"',
  accordion: '≡',
  tabs: '☰',
  counter: '#',
  progress: '▓',
  price: '$',
  CTA: '→',
  container: '▢',
  section: '▤',
  column: '▥',
};

// Get widget type from element
function getWidgetType(element: ElementorElement): string {
  if (element.widgetType) return element.widgetType;
  if (element.elType === 'section') return 'section';
  if (element.elType === 'column') return 'column';
  if (element.elType === 'widget') return 'unknown';
  return element.elType || 'unknown';
}

// Get display name for element
function getElementName(element: ElementorElement): string {
  const type = getWidgetType(element);
  const settings = element.settings || {};
  
  if (type === 'heading' && settings.heading) return String(settings.heading);
  if (type === 'button' && settings.text) return String(settings.text);
  if (settings.page_title) return String(settings.page_title);
  
  const names: Record<string, string> = {
    heading: 'Heading',
    'text-editor': 'Text',
    image: 'Image',
    button: 'Button',
    icon: 'Icon',
    'social-icons': 'Social Icons',
    video: 'Video',
    divider: 'Divider',
    spacer: 'Spacer',
    'icon-box': 'Icon Box',
    'image-box': 'Image Box',
    testimonial: 'Testimonial',
    accordion: 'Accordion',
    tabs: 'Tabs',
    counter: 'Counter',
    progress: 'Progress',
    price: 'Price',
    CTA: 'Call to Action',
    container: 'Container',
    section: 'Section',
    column: 'Column',
  };
  
  return names[type] || type;
}

// Get text content from element
function getElementText(element: ElementorElement): string {
  const settings = element.settings || {};
  if (settings.heading) return String(settings.heading);
  if (settings.editor) return String(settings.editor).replace(/<[^>]*>/g, '');
  if (settings.text) return String(settings.text);
  return '';
}

// Element Toolbar Component
function ElementToolbar({ 
  element, 
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  element: ElementorElement;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const widgetType = getWidgetType(element);
  const icon = widgetIcons[widgetType] || '◆';
  const name = getElementName(element);
  
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-slate-800 text-white text-xs rounded">
      <GripVertical className="h-3 w-3 cursor-grab" />
      <span className="w-5 h-5 flex items-center justify-center bg-slate-700 rounded text-center font-bold">
        {icon}
      </span>
      <span className="flex-1 truncate max-w-[120px]">{name}</span>
      <button 
        onClick={onMoveUp} 
        disabled={isFirst}
        className="p-1 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Move Up"
      >
        <ChevronUp className="h-3 w-3" />
      </button>
      <button 
        onClick={onMoveDown} 
        disabled={isLast}
        className="p-1 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Move Down"
      >
        <ChevronDown className="h-3 w-3" />
      </button>
      <button 
        onClick={onDuplicate}
        className="p-1 hover:bg-slate-700"
        title="Duplicate"
      >
        <Copy className="h-3 w-3" />
      </button>
      <button 
        onClick={onDelete}
        className="p-1 hover:bg-red-600"
        title="Delete"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// Render Elementor Widget
function ElementorWidget({ 
  element, 
  isSelected, 
  onClick,
  onEditText,
}: { 
  element: ElementorElement; 
  isSelected: boolean; 
  onClick: () => void;
  onEditText: (text: string) => void;
}) {
  const settings = element.settings || {};
  const widgetType = getWidgetType(element);
  
  const baseClasses = `elementor-widget relative transition-all ${
    isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:ring-1 hover:ring-blue-300'
  }`;
  
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = getElementText(element);
    if (text) {
      const newText = prompt('Edit text:', text);
      if (newText !== null) {
        onEditText(newText);
      }
    }
  };
  
  // Render based on widget type
  switch (widgetType) {
    case 'heading':
      return (
        <div 
          className={baseClasses} 
          onClick={onClick}
          onDoubleClick={handleDoubleClick}
        >
          <h2 
            className="text-3xl font-bold"
            style={{ color: settings.title_color as string }}
          >
            {settings.heading || 'Heading'}
          </h2>
        </div>
      );
      
    case 'text-editor':
      return (
        <div 
          className={baseClasses}
          onClick={onClick}
          onDoubleClick={handleDoubleClick}
          dangerouslySetInnerHTML={{ __html: (settings.editor as string) || '<p>Text content</p>' }}
        />
      );
      
    case 'button':
      const btnStyle: React.CSSProperties = {
        backgroundColor: settings.background_color as string || '#3B82F6',
        color: settings.button_text_color as string || '#FFFFFF',
        padding: `${settings.button_padding_top || 12}px ${settings.button_padding_right || 24}px`,
        borderRadius: typeof settings.border_radius === 'number' ? `${settings.border_radius}px` : '4px',
      };
      return (
        <div className={baseClasses} onClick={onClick}>
          <a style={btnStyle} className="inline-block font-medium">
            {settings.text || 'Button'}
          </a>
        </div>
      );
      
    case 'image':
      return (
        <div className={baseClasses} onClick={onClick}>
          {settings.image?.url || settings.url ? (
            <img 
              src={String(settings.image?.url || settings.url)} 
              alt={settings.alt as string || ''}
              className="w-full h-auto"
            />
          ) : (
            <div className="bg-slate-200 w-full h-48 flex items-center justify-center text-slate-400">
              No image
            </div>
          )}
        </div>
      );
      
    case 'icon':
      return (
        <div 
          className={baseClasses} 
          onClick={onClick} 
          style={{ textAlign: (settings.align || 'center') as 'left' | 'center' | 'right' }}
        >
          <div 
            className="inline-block"
            style={{ fontSize: `${settings.icon_size || 50}px`, color: settings.primary_color as string }}
          >
            {settings.icon || '★'}
          </div>
        </div>
      );
      
    case 'spacer':
      return (
        <div 
          className={baseClasses} 
          onClick={onClick}
          style={{ height: `${settings.space || 100}px` }}
        >
          <div className="w-full h-full bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">
            Spacer: {settings.space || 100}px
          </div>
        </div>
      );
      
    case 'divider':
      return (
        <div className={baseClasses} onClick={onClick}>
          <hr style={{ 
            borderColor: settings.color as string || '#E0E0E0',
            borderWidth: `${settings.weight || 1}px`,
          }} />
        </div>
      );
      
    case 'section':
    case 'container':
      return (
        <div 
          className={baseClasses + ' bg-slate-50 p-4 rounded'}
          onClick={onClick}
        >
          <div className="text-slate-400 text-sm text-center">
            {widgetType === 'section' ? 'Section' : 'Container'}
            {element.elements && element.elements.length > 0 && (
              <span className="ml-2 bg-slate-200 px-2 py-0.5 rounded">
                {element.elements.length} children
              </span>
            )}
          </div>
        </div>
      );
      
    default:
      return (
        <div 
          className={baseClasses + ' bg-slate-100 p-4 rounded text-center'}
          onClick={onClick}
        >
          <span className="text-slate-500 text-sm">{getElementName(element)}</span>
        </div>
      );
  }
}

// Property Panel Component
function PropertyPanel({ 
  selectedElement,
  onUpdate,
  onClose,
}: { 
  selectedElement: SelectedElement | null;
  onUpdate: (elementId: string, newSettings: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  if (!selectedElement) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 text-center py-8">
            Click an element to edit its properties
          </p>
        </CardContent>
      </Card>
    );
  }
  
  const { element } = selectedElement;
  const settings = element.settings || {};
  const widgetType = getWidgetType(element);
  
  const updateSetting = (key: string, value: unknown) => {
    onUpdate(element.id, { ...settings, [key]: value });
  };
  
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-medium">{getElementName(element)}</h3>
          <p className="text-xs text-slate-500 capitalize">{widgetType}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
      </div>
      
      <Tabs defaultValue="content" className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-8">
          <TabsTrigger value="content" className="text-xs py-1">Content</TabsTrigger>
          <TabsTrigger value="style" className="text-xs py-1">Style</TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs py-1">Advanced</TabsTrigger>
        </TabsList>
        
        <TabsContent value="content" className="space-y-3 mt-3">
          {widgetType === 'heading' && (
            <div className="space-y-2">
              <Label>Heading Text</Label>
              <Input 
                value={settings.heading as string || ''} 
                onChange={(e) => updateSetting('heading', e.target.value)}
              />
            </div>
          )}
          
          {(widgetType === 'text-editor' || widgetType === 'button') && (
            <div className="space-y-2">
              <Label>{widgetType === 'text-editor' ? 'Text Content' : 'Button Text'}</Label>
              <Textarea 
                value={getElementText(element)}
                onChange={(e) => {
                  if (widgetType === 'button') {
                    updateSetting('text', e.target.value);
                  } else {
                    updateSetting('editor', `<p>${e.target.value}</p>`);
                  }
                }}
                rows={4}
              />
            </div>
          )}
          
          {widgetType === 'image' && (
            <>
              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input 
                  value={settings.image?.url as string || settings.url as string || ''}
                  onChange={(e) => updateSetting('image', { url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Alt Text</Label>
                <Input 
                  value={settings.alt as string || ''}
                  onChange={(e) => updateSetting('alt', e.target.value)}
                />
              </div>
            </>
          )}
          
          {['heading', 'icon', 'image'].includes(widgetType) && (
            <div className="space-y-2">
              <Label>Alignment</Label>
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <Button
                    key={align}
                    variant={settings.align === align ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateSetting('align', align)}
                    className="flex-1"
                  >
                    {align === 'left' && <AlignLeft className="h-4 w-4" />}
                    {align === 'center' && <AlignCenter className="h-4 w-4" />}
                    {align === 'right' && <AlignRight className="h-4 w-4" />}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="style" className="space-y-3 mt-3">
          {(widgetType === 'heading' || widgetType === 'text-editor') && (
            <div className="space-y-2">
              <Label>Text Color</Label>
              <div className="flex gap-2">
                <Input 
                  type="color"
                  value={settings.title_color as string || settings.text_color as string || '#000000'}
                  onChange={(e) => updateSetting(
                    widgetType === 'heading' ? 'title_color' : 'text_color', 
                    e.target.value
                  )}
                  className="w-12 h-10 p-1"
                />
                <Input 
                  value={settings.title_color as string || settings.text_color as string || '#000000'}
                  onChange={(e) => updateSetting(
                    widgetType === 'heading' ? 'title_color' : 'text_color', 
                    e.target.value
                  )}
                  className="flex-1"
                />
              </div>
            </div>
          )}
          
          {widgetType === 'button' && (
            <div className="space-y-2">
              <Label>Background Color</Label>
              <div className="flex gap-2">
                <Input 
                  type="color"
                  value={settings.background_color as string || '#3B82F6'}
                  onChange={(e) => updateSetting('background_color', e.target.value)}
                  className="w-12 h-10 p-1"
                />
                <Input 
                  value={settings.background_color as string || '#3B82F6'}
                  onChange={(e) => updateSetting('background_color', e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          )}
          
          {widgetType === 'heading' && (
            <div className="space-y-2">
              <Label>Font Size</Label>
              <div className="flex gap-2">
                <Input 
                  type="number"
                  value={settings.font_size?.size as number || 36}
                  onChange={(e) => updateSetting('font_size', { size: parseInt(e.target.value) })}
                  className="w-20"
                />
                <span className="flex items-center text-sm text-slate-500">px</span>
              </div>
            </div>
          )}
          
          {widgetType === 'spacer' && (
            <div className="space-y-2">
              <Label>Space Height</Label>
              <div className="flex gap-2">
                <Input 
                  type="number"
                  value={settings.space as number || 100}
                  onChange={(e) => updateSetting('space', parseInt(e.target.value))}
                  className="w-20"
                />
                <span className="flex items-center text-sm text-slate-500">px</span>
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="advanced" className="space-y-3 mt-3">
          <div className="space-y-2">
            <Label>CSS ID</Label>
            <Input 
              value={settings.css_id as string || ''}
              onChange={(e) => updateSetting('css_id', e.target.value)}
              placeholder="element-id"
            />
          </div>
          <div className="space-y-2">
            <Label>CSS Classes</Label>
            <Input 
              value={settings.css_classes as string || ''}
              onChange={(e) => updateSetting('css_classes', e.target.value)}
              placeholder="class1 class2"
            />
          </div>
          <Separator />
          <div className="text-xs text-slate-500">
            <p><strong>Element ID:</strong> {element.id}</p>
            <p><strong>Element Type:</strong> {element.elType}</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Layer Tree Component
function LayerTree({ 
  elements, 
  selectedId, 
  onSelect,
}: { 
  elements: ElementorElement[]; 
  selectedId: string | null;
  onSelect: (id: string, element: ElementorElement, path: number[]) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  
  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };
  
  return (
    <div className="space-y-0.5">
      {elements.map((element, index) => {
        const widgetType = getWidgetType(element);
        const icon = widgetIcons[widgetType] || '◆';
        const name = getElementName(element);
        const hasChildren = element.elements && element.elements.length > 0;
        const isExpanded = expanded.has(element.id);
        const isSelected = selectedId === element.id;
        
        return (
          <div key={element.id}>
            <button
              onClick={() => onSelect(element.id, element, [index])}
              className={`w-full flex items-center gap-1 px-2 py-1.5 text-xs rounded transition-colors ${
                isSelected 
                  ? 'bg-blue-500 text-white' 
                  : 'hover:bg-slate-100'
              }`}
            >
              {hasChildren ? (
                <span 
                  onClick={(e) => { e.stopPropagation(); toggleExpand(element.id); }}
                  className="w-4 h-4 flex items-center justify-center cursor-pointer"
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </span>
              ) : (
                <span className="w-4" />
              )}
              <span className="w-5 h-5 flex items-center justify-center bg-slate-200 rounded text-center font-bold">
                {icon}
              </span>
              <span className="flex-1 text-left truncate">{name}</span>
            </button>
            
            {hasChildren && isExpanded && (
              <div className="ml-4 border-l border-slate-200 pl-1">
                <LayerTree 
                  elements={element.elements!} 
                  selectedId={selectedId}
                  onSelect={onSelect}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Main Elementor Editor Component
export default function ElementorEditor({ 
  projectId,
  initialData,
  onSave,
}: { 
  projectId: string;
  initialData: ElementorData;
  onSave: (data: ElementorData) => Promise<void>;
}) {
  const [elements, setElements] = useState<ElementorElement[]>(initialData.elements || []);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [history, setHistory] = useState<ElementorElement[][]>([initialData.elements || []]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Update element settings
  const updateElementSettings = useCallback((elementId: string, newSettings: Record<string, unknown>) => {
    const updateInTree = (els: ElementorElement[]): ElementorElement[] => {
      return els.map(el => {
        if (el.id === elementId) {
          return { ...el, settings: { ...el.settings, ...newSettings } };
        }
        if (el.elements) {
          return { ...el, elements: updateInTree(el.elements) };
        }
        return el;
      });
    };
    
    setElements(prev => {
      const updated = updateInTree(prev);
      setIsDirty(true);
      
      // Add to history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(updated);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      
      return updated;
    });
  }, [history, historyIndex]);
  
  // Select element
  const handleSelectElement = useCallback((id: string, element: ElementorElement, path: number[]) => {
    setSelectedElement({ id, element, path });
  }, []);
  
  // Delete element
  const deleteElement = useCallback((elementId: string) => {
    const deleteFromTree = (els: ElementorElement[]): ElementorElement[] => {
      return els.filter(el => {
        if (el.id === elementId) return false;
        if (el.elements) {
          el.elements = deleteFromTree(el.elements);
        }
        return true;
      });
    };
    
    setElements(prev => {
      const updated = deleteFromTree(prev);
      setIsDirty(true);
      setSelectedElement(null);
      
      // Add to history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(updated);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      
      return updated;
    });
  }, [history, historyIndex]);
  
  // Duplicate element
  const duplicateElement = useCallback((element: ElementorElement) => {
    const duplicate = JSON.parse(JSON.stringify(element)) as ElementorElement;
    duplicate.id = `element-${Date.now()}`;
    
    const insertAfter = (els: ElementorElement[], targetId: string): ElementorElement[] => {
      const result: ElementorElement[] = [];
      for (const el of els) {
        result.push(el);
        if (el.id === targetId) {
          result.push(duplicate);
        }
        if (el.elements) {
          el.elements = insertAfter(el.elements, targetId);
        }
      }
      return result;
    };
    
    setElements(prev => {
      const updated = insertAfter(prev, element.id);
      setIsDirty(true);
      
      // Add to history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(updated);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      
      return updated;
    });
  }, [history, historyIndex]);
  
  // Move element
  const moveElement = useCallback((element: ElementorElement, direction: 'up' | 'down') => {
    setElements(prev => {
      const index = prev.findIndex(el => el.id === element.id);
      if (index === -1) return prev;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      
      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      setIsDirty(true);
      
      // Add to history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(updated);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      
      return updated;
    });
  }, [history, historyIndex]);
  
  // Undo/Redo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setElements(JSON.parse(JSON.stringify(history[newIndex])));
    }
  }, [history, historyIndex]);
  
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setElements(JSON.parse(JSON.stringify(history[newIndex])));
    }
  }, [history, historyIndex]);
  
  // Save
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ ...initialData, elements });
      setIsDirty(false);
      
      // Update history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push([...elements]);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Render element in canvas
  const renderElement = (element: ElementorElement): React.ReactNode => {
    return (
      <div key={element.id}>
        <ElementorWidget 
          element={element}
          isSelected={selectedElement?.id === element.id}
          onClick={() => handleSelectElement(element.id, element, [])}
          onEditText={(text) => updateElementSettings(element.id, { 
            heading: text, 
            editor: `<p>${text}</p>`,
            text 
          })}
        />
        {element.elements && (
          <div className="ml-4 border-l-2 border-blue-200 pl-2">
            {element.elements.map(renderElement)}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="h-[calc(100vh-200px)] flex flex-col bg-slate-100 rounded-lg overflow-hidden border">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={undo}
            disabled={historyIndex <= 0}
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button 
            variant={showPreview ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-xs text-amber-600">Unsaved changes</span>
          )}
          <Button 
            variant="default" 
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
          >
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
      
      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Layers */}
        {!showPreview && (
          <div className="w-64 bg-white border-r flex flex-col">
            <div className="p-3 border-b bg-slate-50">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Layers
              </h3>
            </div>
            <ScrollArea className="flex-1 p-2">
              <LayerTree 
                elements={elements}
                selectedId={selectedElement?.id || null}
                onSelect={handleSelectElement}
              />
            </ScrollArea>
          </div>
        )}
        
        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-slate-100 p-8">
          <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
            {/* Selected element toolbar */}
            {selectedElement && (
              <div className="sticky top-0 z-10 bg-white border-b p-2 flex justify-center">
                <ElementorToolbar
                  element={selectedElement.element}
                  onDelete={() => deleteElement(selectedElement.id)}
                  onDuplicate={() => duplicateElement(selectedElement.element)}
                  onMoveUp={() => moveElement(selectedElement.element, 'up')}
                  onMoveDown={() => moveElement(selectedElement.element, 'down')}
                  isFirst={true}
                  isLast={true}
                />
              </div>
            )}
            
            {/* Element Canvas */}
            <div 
              ref={previewRef}
              className="min-h-[500px] p-8 space-y-6"
              onClick={() => setSelectedElement(null)}
            >
              {elements.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <p>No elements yet. Add elements from the template.</p>
                </div>
              ) : (
                elements.map(renderElement)
              )}
            </div>
          </div>
        </div>
        
        {/* Right Panel - Properties */}
        {!showPreview && (
          <div className="w-80 bg-white border-l flex flex-col">
            <ScrollArea className="flex-1">
              <PropertyPanel 
                selectedElement={selectedElement}
                onUpdate={updateElementSettings}
                onClose={() => setSelectedElement(null)}
              />
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
