/**
 * Demo Render API
 * 
 * Demonstrates the complete flow from Digicy template → content → rendered HTML.
 * This endpoint:
 * 1. Loads the Digicy home template from the local filesystem
 * 2. Generates mock AI content (simulating what the AI engine would produce)
 * 3. Applies content to the template
 * 4. Renders as HTML and returns
 * 
 * GET /api/demo/render
 *    - Returns a standalone HTML preview of the Digicy template with sample content
 * 
 * This is useful for:
 * - Testing the HTML renderer with all widget types
 * - Demonstrating the template integration without requiring database/R2
 * - Verifying the complete flow works end-to-end
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { renderElementorToHtml, type ElementorNode, type BrandTokens } from '@/lib/preview/render';
import { getTemplateElements } from '@/lib/elementor/template-document';

const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'digicy-digital-agency-elementor-template-kit', 'home.json');

// Sample business data that would typically come from AI generation
const SAMPLE_BUSINESS = {
  name: 'Nexus Digital Agency',
  tagline: 'Transforming Ideas Into Digital Experiences',
  description: 'We are a forward-thinking digital agency specializing in crafting innovative web solutions,Brand strategy, and creative design that drives business growth.',
  services: [
    { title: 'Web Development', description: 'Custom websites and web applications built with cutting-edge technologies.' },
    { title: 'Brand Strategy', description: 'Comprehensive branding solutions that define your unique market position.' },
    { title: 'UI/UX Design', description: 'User-centered design that creates seamless digital experiences.' },
    { title: 'Digital Marketing', description: 'Data-driven marketing strategies that deliver measurable results.' },
  ],
  stats: [
    { value: 500, suffix: '+', label: 'Happy Clients' },
    { value: 1200, suffix: '+', label: 'Projects Completed' },
    { value: 98, suffix: '%', label: 'Client Satisfaction' },
  ],
  contact: {
    email: 'hello@nexusdigital.com',
    phone: '+1 (555) 123-4567',
    address: '123 Innovation Street, Tech City, CA 94000',
  },
};

interface ElementorSettings {
  [key: string]: unknown;
}

interface TemplateNode {
  id: string;
  elType: string;
  widgetType?: string;
  settings?: ElementorSettings;
  elements?: TemplateNode[];
}

/**
 * Load the Digicy home template from the filesystem
 */
function loadTemplate(): TemplateNode[] | null {
  try {
    if (!fs.existsSync(TEMPLATE_PATH)) {
      console.error('[Demo] Template not found:', TEMPLATE_PATH);
      return null;
    }
    
    const content = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
    const data = JSON.parse(content);

    // Normalize the kit-wrapper / document / bare-array shapes.
    const elements = getTemplateElements(data);
    if (elements.length === 0) {
      console.error('[Demo] Unexpected template structure');
      return null;
    }
    return elements as TemplateNode[];
  } catch (error) {
    console.error('[Demo] Error loading template:', error);
    return null;
  }
}

/**
 * Recursively find and replace text in the Elementor tree
 */
function applyContentToNode(node: TemplateNode, business: typeof SAMPLE_BUSINESS): TemplateNode {
  // Deep clone the node to avoid mutation
  const newNode: TemplateNode = {
    ...node,
    settings: { ...node.settings } as ElementorSettings,
    elements: node.elements ? node.elements.map(el => applyContentToNode(el, business)) : undefined,
  };

  if (!newNode.settings) return newNode;

  const settings = newNode.settings;

  // Replace heading text
  if (settings.heading && typeof settings.heading === 'string') {
    const heading = settings.heading;
    if (heading.includes('Real Happy Clients') || heading.includes('Happy Clients')) {
      const stat = business.stats.find(s => s.label.includes('Happy'));
      if (stat) {
        settings.heading = `${stat.value}${stat.suffix}`;
      }
    }
    if (heading.includes('business grow') || heading.includes('help')) {
      settings.heading = business.tagline;
    }
    // Replace "see how we can help" type text
    if (heading.includes('see how') || heading.includes('help your')) {
      settings.heading = business.tagline;
    }
  }

  // Replace title (used by some widgets)
  if (settings.title && typeof settings.title === 'string') {
    const title = settings.title;
    if (title.includes('Clients') || title.includes('Real Happy')) {
      const stat = business.stats.find(s => s.label.includes('Happy'));
      if (stat) {
        settings.title = `${stat.value}${stat.suffix} ${stat.label}`;
      }
    }
    if (title.includes('Projects') || title.includes('Completed')) {
      const stat = business.stats.find(s => s.label.includes('Projects'));
      if (stat) {
        settings.title = `${stat.value}${stat.suffix} ${stat.label}`;
      }
    }
    if (title.includes('Satisfaction') || title.includes('Client')) {
      const stat = business.stats.find(s => s.label.includes('Satisfaction'));
      if (stat) {
        settings.title = `${stat.value}${stat.suffix} ${stat.label}`;
      }
    }
    // Services titles
    if (title.includes('Web Development') || 
        title.includes('Strategy') ||
        title.includes('Design') ||
        title.includes('Marketing')) {
      const serviceIndex = ['Web Development', 'Strategy', 'Design', 'Marketing'].findIndex(s => 
        title.includes(s)
      );
      if (serviceIndex >= 0 && business.services[serviceIndex]) {
        settings.title = business.services[serviceIndex].title;
      }
    }
  }

  // Replace text-editor content
  if (settings.editor && typeof settings.editor === 'string') {
    const editor = settings.editor;
    if (editor.includes('help your business') || 
        editor.includes('digital marketing') ||
        editor.includes('transform')) {
      settings.editor = `<p style="text-align: center;">${business.description}</p>`;
    }
  }

  // Replace button text
  if (settings.text && typeof settings.text === 'string') {
    const text = settings.text;
    if (text.includes('Testimonial') || text.includes('More')) {
      settings.text = 'View Our Work';
    }
    if (text.includes('Contact') || text.includes('Get')) {
      settings.text = 'Get In Touch';
    }
  }

  return newNode as TemplateNode as ElementorNode;
}

/**
 * Convert template to ElementorNode format
 */
function convertToElementorNode(node: TemplateNode): ElementorNode {
  return {
    id: node.id,
    elType: node.elType as ElementorNode['elType'],
    widgetType: node.widgetType,
    settings: node.settings as Record<string, unknown>,
    elements: node.elements?.map(convertToElementorNode),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const useMockContent = searchParams.get('mock') !== 'false';
    const businessName = searchParams.get('name') || SAMPLE_BUSINESS.name;

    console.log('[Demo] Loading Digicy template...');
    const template = loadTemplate();

    if (!template) {
      return new NextResponse(
        `<html><body><h1>Template Not Found</h1><p>The Digicy home template could not be loaded from: ${TEMPLATE_PATH}</p></body></html>`,
        { 
          status: 404,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    console.log('[Demo] Template loaded, processing...');
    
    // Apply content modifications
    const business = { ...SAMPLE_BUSINESS, name: businessName };
    const processedTemplate = template.map(node => applyContentToNode(node, business));
    
    // Convert to ElementorNode format
    const elements = processedTemplate.map(convertToElementorNode);

    // Define brand tokens
    const brandTokens: BrandTokens = {
      colors: {
        primary: '#2563eb',
        secondary: '#1e40af',
        accent: '#06b6d4',
      },
      typography: {
        headingFont: "'Kanit', system-ui, sans-serif",
        bodyFont: "'Inter', system-ui, sans-serif",
      },
    };

    // Render to HTML
    console.log('[Demo] Rendering HTML...');
    const html = renderElementorToHtml(elements, {
      title: business.name,
      brandTokens,
    });

    console.log('[Demo] Render complete, returning HTML');
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('[Demo] Error:', error);
    return new NextResponse(
      `<html><body>
        <h1>Error Rendering Template</h1>
        <pre>${error instanceof Error ? error.message : String(error)}</pre>
        <p>Check server logs for more details.</p>
      </body></html>`,
      { 
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}
