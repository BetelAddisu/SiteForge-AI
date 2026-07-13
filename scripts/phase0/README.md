# Phase 0: Feasibility Spike

This directory contains the scripts and findings from the Phase 0 feasibility spike.

## Scripts

### parse-elementor.ts
Analyzes Elementor template ZIPs and generates compatibility reports.

```bash
# Single template
npx tsx parse-elementor.ts ./sample-templates/template.zip

# Multiple templates
npx tsx parse-elementor.ts ./sample-templates/template1.zip ./sample-templates/template2.zip

# All templates in directory
npx tsx parse-elementor.ts ./sample-templates/

# Save JSON output
OUTPUT_PATH=./report.json npx tsx parse-elementor.ts ./sample-templates/
```

**Output**: Compatibility report with widget types, third-party addons, and modification scores.

### modify-elementor.ts
Programmatically modifies Elementor templates.

```bash
# Replace heading
npx tsx modify-elementor.ts template.zip --heading "New Heading"

# Replace multiple elements
npx tsx modify-elementor.ts template.zip \
  --heading "Welcome to Our Business" \
  --paragraph "We provide excellent services..." \
  --color "#FF5733" \
  --output modified-template.zip
```

**Output**: Modified ZIP ready for WordPress re-import.

### test-ai-replacement.ts
Tests AI content generation with Zod validation.

```bash
# Set API key
export GEMINI_API_KEY=your_api_key

# Run tests
npx tsx test-ai-replacement.ts --count 3

# With custom business context
npx tsx test-ai-replacement.ts \
  --business "Acme Corp" \
  --industry "Technology" \
  --count 3 \
  --verbose
```

**Output**: Test results with success rates and cost estimates.

## Sample Templates

Place Elementor template ZIPs in `sample-templates/` for testing. Recommended variety:
- 3-5 page templates
- 3-5 theme builder templates
- Mix of old and new templates
- Templates from different creators

## Findings

See [FINDINGS.md](./FINDINGS.md) for detailed compatibility analysis and widget mappings.

## Exit Criteria

✅ **Phase 0 Complete When**:
1. One real template ZIP successfully parses
2. AI content generation produces valid Zod output
3. Modified JSON can be imported into WordPress
4. FINDINGS.md documents widget compatibility

## Prerequisites

```bash
cd scripts/phase0
npm install
```

Required environment variables:
- `GEMINI_API_KEY` - For AI testing
- `OUTPUT_PATH` - Optional, for JSON report output
