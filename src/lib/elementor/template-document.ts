/**
 * Elementor Template Document helpers
 *
 * Single source of truth for parsing the several real-world shapes a template
 * kit ships its Elementor data in, and for emitting Elementor-import-compatible
 * documents and manifest summaries.
 *
 * The shapes we normalize are derived from actual kit exports on disk and from
 * Elementor Pro's import/export runners
 * (reference/elementor-pro/core/app/modules/import-export):
 *
 *   1. Bare element array:
 *        [ { id, elType: 'section', elements: [...] }, ... ]
 *
 *   2. Inner template document (acatrade-style export):
 *        { version, title, type, metadata, content: ElementorNode[] }
 *      where `content` IS the element array.
 *
 *   3. Full document wrapper (digicy/saras-style kit template):
 *        { ...kitFields, content: { version, title, type, metadata,
 *          page_settings, content: ElementorNode[] } }
 *      where `content.content` is the element array.
 *
 * Elementor's export runner writes one file per template
 * (`get_export_data()` => { content, page_settings, version, metadata }) and a
 * manifest summary per template (`get_export_summary()` => title/doc_type).
 */

import type { ElementorNode } from './parser';

// ============================================================================
// Types
// ============================================================================

/** Canonical in-memory representation of a template document. */
export interface ElementorDocument {
  /** Elementor data format version (e.g. '0.4'). */
  version?: string;
  /** Human-readable template title. */
  title?: string;
  /** Elementor document type key (e.g. 'page', 'single-page'). */
  type?: string;
  metadata?: Record<string, unknown>;
  page_settings?: Record<string, unknown>;
  content: ElementorNode[];
}

/** Which on-disk shape the raw JSON took. */
export type TemplateDocumentShape =
  | 'element-array'
  | 'document'
  | 'kit-wrapper'
  | 'none';

export interface ParsedTemplateDocument {
  document: ElementorDocument;
  shape: TemplateDocumentShape;
}

// ============================================================================
// Parsing
// ============================================================================

function isElementNode(value: unknown): value is ElementorNode {
  if (typeof value !== 'object' || value === null) return false;
  const node = value as Record<string, unknown>;
  return (
    typeof node.id === 'string' &&
    typeof node.elType === 'string' &&
    ['section', 'column', 'container', 'widget'].includes(node.elType as string)
  );
}

function isElementArray(value: unknown): value is ElementorNode[] {
  return Array.isArray(value) && value.every(isElementNode);
}

/**
 * Normalize any of the known Elementor template shapes into a canonical
 * document. Returns `shape: 'none'` when the payload is unrecognized.
 */
export function parseTemplateDocument(data: unknown): ParsedTemplateDocument {
  if (isElementArray(data)) {
    return { document: { content: data }, shape: 'element-array' };
  }

  if (typeof data !== 'object' || data === null) {
    return { document: { content: [] }, shape: 'none' };
  }

  const root = data as Record<string, unknown>;

  // Inner document (or acatrade-style export): content IS the element array.
  if (isElementArray(root.content)) {
    return {
      document: {
        version: typeof root.version === 'string' ? root.version : undefined,
        title: typeof root.title === 'string' ? root.title : undefined,
        type: typeof root.type === 'string' ? root.type : undefined,
        metadata: asRecord(root.metadata),
        page_settings: asRecord(root.page_settings),
        content: root.content,
      },
      shape: 'document',
    };
  }

  // Kit wrapper: content is itself the inner template document.
  if (typeof root.content === 'object' && root.content !== null) {
    const inner = root.content as Record<string, unknown>;
    if (isElementArray(inner.content)) {
      return {
        document: {
          version: typeof inner.version === 'string' ? inner.version : undefined,
          title: typeof inner.title === 'string' ? inner.title : undefined,
          type: typeof inner.type === 'string' ? inner.type : undefined,
          metadata: asRecord(inner.metadata),
          page_settings: asRecord(inner.page_settings),
          content: inner.content,
        },
        shape: 'kit-wrapper',
      };
    }
  }

  return { document: { content: [] }, shape: 'none' };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

// ============================================================================
// Accessors
// ============================================================================

/** The element array, or an empty array when the payload is unrecognized. */
export function getTemplateElements(data: unknown): ElementorNode[] {
  return parseTemplateDocument(data).document.content;
}

/**
 * Resolve the template's display name: page_title setting on the first
 * section takes priority (matches kit exports), then the document title.
 */
export function getTemplateName(data: unknown, fallback = ''): string {
  const { document } = parseTemplateDocument(data);

  const firstSectionTitle = document.content[0]?.settings?.page_title;
  if (typeof firstSectionTitle === 'string' && firstSectionTitle.trim()) {
    return firstSectionTitle;
  }
  return (document.title || fallback).trim();
}

/** Elementor document type (doc_type): metadata.template_type > type > 'page'. */
export function getTemplateType(data: unknown): string {
  const { document } = parseTemplateDocument(data);
  const metadataType = document.metadata?.template_type;
  if (typeof metadataType === 'string' && metadataType.trim()) return metadataType;
  if (document.type && document.type.trim()) return document.type;
  return 'page';
}

// ============================================================================
// Elementor-import-compatible output
// ============================================================================

/**
 * Emit the per-template file payload in the shape Elementor's export runner
 * writes (`Document::get_export_data()`): content / page_settings / version /
 * metadata. Omitting empty sections keeps output stable and round-trippable.
 */
export function toElementorTemplateFile(
  document: ElementorDocument
): Record<string, unknown> {
  const file: Record<string, unknown> = { content: document.content };
  if (document.page_settings) file.page_settings = document.page_settings;
  if (document.version) file.version = document.version;
  if (document.metadata) file.metadata = document.metadata;
  return file;
}

/**
 * Emit the per-template manifest summary in the shape Elementor's export
 * runner writes (`Document::get_export_summary()`): title / doc_type, with
 * Theme-Builder conditions/location carried through when present so the import
 * runner can re-attach them.
 */
export function toElementorManifestTemplate(
  document: ElementorDocument,
  id: string
): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    title: document.title || 'Template',
    doc_type: getTemplateType({ content: document.content, type: document.type, metadata: document.metadata }),
  };
  const conditions = document.metadata?.conditions;
  if (Array.isArray(conditions)) summary.conditions = conditions;
  const location = document.metadata?.location;
  if (typeof location === 'string') summary.location = location;
  return { id, ...summary };
}
