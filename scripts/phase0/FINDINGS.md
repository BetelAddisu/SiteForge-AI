# Phase 0 - Feasibility Spike Findings

> **Status**: In Progress
> **Date**: TBD
> **Exit Criterion**: One real ZIP → parse → AI content → modified JSON → re-import → renders in WordPress

---

## Executive Summary

This document captures findings from the Phase 0 feasibility spike. It will be updated as templates are analyzed and WordPress import validation is performed.

---

## 1. Template Parsing

### Data Location Patterns

Elementor template data can be found in multiple locations within a ZIP file:

| Pattern | Description | Reliability |
|---------|-------------|-------------|
| `elementor/**/*.json` | Dedicated elementor data files | High |
| `theme.json` | Theme builder exports | High |
| `template.json` | Template exports | High |
| `*.php` (embedded) | PHP files with serialized data | Medium |
| `content.json` | Generic content files | Medium |

### Recommended Extraction Strategy

1. First pass: Look for explicit `elementor` named files ending in `.json`
2. Second pass: Check `theme.json`, `template.json`, `data.json`
3. Third pass: Scan PHP files for `_elementor_data` pattern
4. Last resort: Search for any file containing `elType` in JSON structure

---

## 2. Widget Compatibility Analysis

### Compatibility Categories

| Category | Score Range | Meaning |
|----------|-------------|---------|
| **Green** | 80-100 | Fully auto-modifiable |
| **Yellow** | 50-79 | Partial support, manual review recommended |
| **Red** | 0-49 | Repair required or skip |

### Easy Widgets (Green)

These Elementor core widgets are straightforward to modify:

| Widget Type | Modification Support |
|-------------|---------------------|
| `heading` | ✅ Text replacement, link updates |
| `text-editor` | ✅ Full HTML content replacement |
| `button` | ✅ Text, URL, style modifications |
| `image` | ✅ URL replacement, alt text |
| `icon` | ✅ Icon selection, color |
| `icon-box` | ✅ Text and icon modifications |
| `image-box` | ✅ Image and text replacement |
| `divider` | ✅ Style modifications |
| `spacer` | ✅ Height adjustments |
| `counter` | ✅ Number and label changes |
| `progress-bar` | ✅ Percentage and label updates |
| `tabs` | ✅ Tab titles and content |
| `accordion` | ✅ Title and content updates |
| `toggle` | ✅ Title and content updates |
| `social-icons` | ✅ URL and icon updates |
| `call-to-action` | ✅ Full content replacement |

### Brittle Widgets (Yellow/Red)

These widgets have complexities that may require special handling:

| Widget Type | Issues | Recommended Action |
|-------------|--------|-------------------|
| `form` | Nested repeater fields, complex validation | Manual review |
| `slides` | Carousel with multiple slides in repeater | Partial support |
| `testimonial-carousel` | Nested testimonials in repeater | Partial support |
| `image-carousel` | Multiple images in repeater | Partial support |
| `flip-box` | Front/back content pairs | Partial support |
| `price-table` | Multi-tier pricing structures | Manual review |
| `posts` / `loop-grid` | Dynamic content queries | Skip/modify settings only |
| `template` | Nested template references | Skip - modify source template |

### Third-Party Addon Widgets

Detected third-party widgets requiring bespoke handling:

| Addon | Widget Types Found | Repair Strategy |
|-------|-------------------|-----------------|
| **Essential Addons** | `ea-heading`, `ea-dual-header`, `ea-team-member`, `ea-testimonial` | Create mapping or skip |
| **Ultimate Addons** | `uael-*` variants | Create mapping or skip |
| **Premium Addons** | `ppe-*` variants | Create mapping or skip |
| **JetElements** | `jet-*` variants | Create mapping or skip |
| **Other** | Various third-party prefixes | Case-by-case assessment |

#### Known Mappings (to be expanded)

| Third-Party Widget | Native Equivalent |
|-------------------|-------------------|
| `ea-heading` | `heading` + `text-editor` |
| `ea-team-member` | Manual recreation |
| `eael-creative-button` | `button` with custom CSS |
| `uagb-*` | Skip (Gutenberg blocks) |

---

## 3. Elementor JSON Structure

### Standard Node Format

```typescript
interface ElementorNode {
  id: string;
  elType: 'section' | 'column' | 'container' | 'widget';
  widgetType?: string;
  settings: Record<string, unknown>;
  elements?: ElementorNode[];
}
```

### Common Settings Fields

| Field Type | Examples |
|------------|----------|
| Text | `title`, `heading`, `editor`, `subtitle` |
| URLs | `link`, `url`, `image`, `background_image` |
| Colors | `primary_color`, `background_color`, `text_color` |
| Numbers | `height`, `width`, `columns`, `gap` |
| Select | `layout`, `alignment`, `position` |

### Repeater Fields

Some widgets use repeater fields for multiple items:

```json
{
  "settings": {
    "slides": [
      { "title": "Slide 1", "image": "url1" },
      { "title": "Slide 2", "image": "url2" }
    ]
  }
}
```

**Warning**: Repeater fields require special handling to correctly identify and replace individual items.

---

## 4. WordPress Import Validation

### Recommended Import Method

**Step 1**: Create a new WordPress page:
```bash
curl -X POST https://example.com/wp-json/wp/v2/pages \
  -H "Authorization: Basic $(echo -n 'user:app_password' | base64)" \
  -H "Content-Type: application/json" \
  -d '{"title": "Page Title", "status": "draft"}'
```

**Step 2**: Write `_elementor_data` to post meta:
```bash
curl -X POST https://example.com/wp-json/wp/v2/pages/{id}/meta \
  -H "Authorization: Basic $(echo -n 'user:app_password' | base64)" \
  -H "Content-Type: application/json" \
  -d '{"key": "_elementor_data", "value": "<json_string>"}'
```

**Step 3**: Trigger CSS regeneration:
```bash
# Option A: Via WP-CLI (if available)
wp elementor flush-css

# Option B: Via admin AJAX endpoint
curl -X POST https://example.com/wp-admin/admin-ajax.php \
  -d "action=elementor_update_css"

# Option C: Via Elementor REST API (if plugin exposes it)
curl -X POST https://example.com/wp-json/elementor/v1/post/{id}
```

### Validation Checklist

- [ ] Page created successfully with correct ID
- [ ] `_elementor_data` meta written correctly
- [ ] Page loads in WordPress without errors
- [ ] Elementor editor opens without errors
- [ ] CSS is properly generated
- [ ] Frontend renders correctly

---

## 5. AI Content Generation

### Recommended Approach

1. **Use Gemini function calling** with Zod schemas for structured output
2. **Validate all responses** against schemas before database writes
3. **Retry once on failure**, then surface error to user
4. **Log all API calls** to `AIUsage` table for cost tracking

### Schema Strategy

Each content type has a dedicated Zod schema:
- `ContentReplacementSchema`: Simple replacements (heading, paragraph, image, color)
- `HomepageContentSchema`: Full homepage sections
- `AboutPageContentSchema`: About page sections
- `ServiceContentSchema`: Service page content

### Token Budget Guidelines

| Content Type | Estimated Tokens | Est. Cost (gemini-2.0-flash) |
|--------------|-----------------|------------------------------|
| Single replacement | 200-500 | $0.0001-0.0003 |
| Homepage content | 1000-2000 | $0.0005-0.0010 |
| About page | 1500-3000 | $0.0008-0.0015 |
| Service page | 2000-4000 | $0.0010-0.0020 |

---

## 6. Open Issues & Risks

### High Priority

| Issue | Impact | Mitigation |
|-------|--------|------------|
| No clean import API | Blocked Phase 13 | Manual R&D with cPanel WP |
| Third-party widgets | 30%+ templates affected | Expand mapping table over time |
| Nested repeaters | Complex content | Implement repeater-aware walker |

### Medium Priority

| Issue | Impact | Mitigation |
|-------|--------|------------|
| Template age variations | Older templates may use deprecated widgets | Create repair handlers for common cases |
| CSS regeneration timing | Race conditions | Add delay/retry logic |
| Image URL stability | Broken links after modification | Validate URLs, use placeholder |

### Low Priority

| Issue | Impact | Mitigation |
|-------|--------|------------|
| Template naming inconsistencies | Difficulty matching templates | Fuzzy search, metadata enrichment |
| Unicode in widget types | Parsing issues | Normalize encoding |

---

## 7. Next Steps

### Immediate (Post-Phase 0)

1. **Validate WordPress import** in cPanel environment
2. **Create widget mapping table** from analyzed templates
3. **Build Phase 3C repair handlers** for most common brittle widgets
4. **Implement repeater-aware walker** for carousel/slides widgets

### Deferred (Post-MVP)

1. **Third-party widget handlers** as new template families are discovered
2. **Dynamic content widget support** (posts, loop-grid)
3. **Multi-language template adaptation**

---

## Appendix: Sample Template Analysis

### Template 1: [TEMPLATE_NAME]
- **File**: `path/to/template.zip`
- **Compatibility Score**: [SCORE]/100
- **Level**: [GREEN/YELLOW/RED]
- **Widget Types**: [LIST]
- **Third-Party Addons**: [LIST]
- **Repair Actions Needed**: [LIST]

### Template 2: [TEMPLATE_NAME]
... (continue for each analyzed template)

---

*This document will be updated as more templates are analyzed and WordPress import is validated.*
