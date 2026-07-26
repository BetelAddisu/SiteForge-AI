/**
 * Phase 0 smoke test.
 *
 * Runs the real parse -> classify -> modify -> validate chain against a
 * fixture template, using the actual production modules - no database,
 * no Vercel deployment, no Gemini API call required. Run this any time
 * modifier.ts, section-classifier.ts, or validator.ts change, BEFORE
 * pushing - this is the check that would have caught the empty-target
 * bug, the wrong-content-source bug, and the always-failing-validation
 * bug months earlier than they were actually found, because each of
 * those made a step "succeed" while doing nothing real.
 *
 * Usage:
 *   npm run test:phase0
 *
 * To test against a REAL template instead of the built-in fixture:
 *   npm run test:phase0 -- --content=./path/to/real-template-content.json
 * (a JSON file containing just the `content`/`elements` array extracted
 * from one TemplateSection row or template.metadata.content)
 */
import { readFileSync } from 'fs';
import { classifySections } from '../../src/lib/elementor/section-classifier';
import { applyModifications, findAllNodesByWidgetType, setNodeContent } from '../../src/lib/elementor/modifier';
import { validateElementorJson } from '../../src/lib/elementor/validator';
import type { ElementorNode } from '../../src/lib/elementor/parser';

const FIXTURE_CONTENT: ElementorNode[] = [
  {
    id: 'hero-section',
    elType: 'section',
    elements: [
      {
        id: 'hero-col',
        elType: 'column',
        elements: [
          { id: 'hero-heading', elType: 'widget', widgetType: 'heading', settings: { heading: 'Placeholder Hero Heading' } },
          { id: 'hero-text', elType: 'widget', widgetType: 'text-editor', settings: { editor: '<p>Placeholder subheading</p>' } },
          { id: 'hero-btn', elType: 'widget', widgetType: 'button', settings: { text: 'Placeholder CTA' } },
        ],
      },
    ],
  },
  {
    id: 'about-section',
    elType: 'section',
    elements: [
      {
        id: 'about-col',
        elType: 'column',
        elements: [
          { id: 'about-heading', elType: 'widget', widgetType: 'heading', settings: { heading: 'About Us' } },
          { id: 'about-text', elType: 'widget', widgetType: 'text-editor', settings: { editor: '<p>Placeholder about text</p>' } },
        ],
      },
    ],
  },
  {
    id: 'services-section',
    elType: 'section',
    elements: [
      { id: 'svc-col-1', elType: 'column', elements: [
        { id: 'svc-h-1', elType: 'widget', widgetType: 'heading', settings: { heading: 'Service One' } },
        { id: 'svc-t-1', elType: 'widget', widgetType: 'text-editor', settings: { editor: '<p>Service one description</p>' } },
      ] },
      { id: 'svc-col-2', elType: 'column', elements: [
        { id: 'svc-h-2', elType: 'widget', widgetType: 'heading', settings: { heading: 'Service Two' } },
        { id: 'svc-t-2', elType: 'widget', widgetType: 'text-editor', settings: { editor: '<p>Service two description</p>' } },
      ] },
      { id: 'svc-col-3', elType: 'column', elements: [
        { id: 'svc-h-3', elType: 'widget', widgetType: 'heading', settings: { heading: 'Service Three' } },
        { id: 'svc-t-3', elType: 'widget', widgetType: 'text-editor', settings: { editor: '<p>Service three description</p>' } },
      ] },
    ],
  },
];

const FIXTURE_GENERATED_CONTENT = {
  hero: { heading: 'Real Business Name', subheading: 'A real generated subheading', ctaText: 'Get a Quote' },
  about: { heading: 'Our Story', description: 'Real generated about-section copy.' },
  services: [
    { title: 'Real Service A', description: 'Real generated description A' },
    { title: 'Real Service B', description: 'Real generated description B' },
    { title: 'Real Service C', description: 'Real generated description C' },
  ],
};

function loadContent(): ElementorNode[] {
  const arg = process.argv.find(a => a.startsWith('--content='));
  if (!arg) return FIXTURE_CONTENT;
  const path = arg.split('=')[1];
  console.log(`Loading real template content from ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

let failures = 0;
function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}`);
    failures++;
  }
}

function main() {
  console.log('=== SiteForge Phase 0 Smoke Test ===\n');

  const original = loadContent();
  const contentTree = JSON.parse(JSON.stringify(original)) as ElementorNode[];

  // --- Step 1: classify sections ---
  console.log('Step 1: classify sections');
  const classified = classifySections(contentTree);
  classified.forEach(c => console.log(`  section[${c.index}] -> ${c.role}`));
  check('at least one section classified as hero', classified.some(c => c.role === 'hero'));
  console.log('');

  // --- Step 2: apply generated content, section-scoped ---
  console.log('Step 2: apply generated content within classified sections');
  const hero = classified.find(c => c.role === 'hero');
  if (hero) {
    const headings = findAllNodesByWidgetType(hero.node.elements || [], 'heading');
    const textEditors = findAllNodesByWidgetType(hero.node.elements || [], 'text-editor');
    const buttons = findAllNodesByWidgetType(hero.node.elements || [], 'button');
    if (headings[0]) setNodeContent(headings[0], FIXTURE_GENERATED_CONTENT.hero.heading);
    if (textEditors[0]) setNodeContent(textEditors[0], FIXTURE_GENERATED_CONTENT.hero.subheading);
    if (buttons[0]) setNodeContent(buttons[0], FIXTURE_GENERATED_CONTENT.hero.ctaText);
  }
  const about = classified.find(c => c.role === 'about');
  if (about) {
    const headings = findAllNodesByWidgetType(about.node.elements || [], 'heading');
    const textEditors = findAllNodesByWidgetType(about.node.elements || [], 'text-editor');
    if (headings[0]) setNodeContent(headings[0], FIXTURE_GENERATED_CONTENT.about.heading);
    if (textEditors[0]) setNodeContent(textEditors[0], FIXTURE_GENERATED_CONTENT.about.description);
  }
  const services = classified.find(c => c.role === 'services');
  if (services) {
    const headings = findAllNodesByWidgetType(services.node.elements || [], 'heading');
    const textEditors = findAllNodesByWidgetType(services.node.elements || [], 'text-editor');
    FIXTURE_GENERATED_CONTENT.services.forEach((svc, i) => {
      if (headings[i]) setNodeContent(headings[i], svc.title);
      if (textEditors[i]) setNodeContent(textEditors[i], svc.description);
    });
  }

  const flatText = JSON.stringify(contentTree);
  check('hero heading was actually applied', flatText.includes(FIXTURE_GENERATED_CONTENT.hero.heading));
  check('about description was actually applied', flatText.includes(FIXTURE_GENERATED_CONTENT.about.description));
  check('all 3 service titles were actually applied', FIXTURE_GENERATED_CONTENT.services.every(s => flatText.includes(s.title)));
  check('the ORIGINAL template is untouched (deep-clone worked)', JSON.stringify(original).includes('Placeholder Hero Heading'));
  console.log('');

  // --- Step 3: validate the modified tree ---
  console.log('Step 3: validate modified content');
  const validation = validateElementorJson(contentTree);
  check('modified content passes validation', validation.valid);
  if (!validation.valid) {
    validation.errors.forEach(e => console.log(`    - ${e.path}: ${e.message}`));
  }
  console.log('');

  // --- Step 4: run applyModifications' own empty-target guard ---
  console.log('Step 4: confirm empty-target modifications are rejected, not silently accepted');
  const guardResult = applyModifications(JSON.parse(JSON.stringify(original)), {
    elements: [{ type: 'modify', target: {}, changes: { heading: 'should not apply' } }],
  });
  check('empty target correctly fails instead of silently succeeding', guardResult.success === false);
  console.log('');

  console.log('=== Summary ===');
  if (failures === 0) {
    console.log('All checks passed.');
    process.exit(0);
  } else {
    console.log(`${failures} check(s) failed.`);
    process.exit(1);
  }
}

main();
