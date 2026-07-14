/**
 * Static Website Exporter
 * 
 * Generates a standalone HTML/CSS website from generated content.
 * Can be uploaded to any hosting provider (Netlify, Vercel, GitHub Pages, cPanel, etc.)
 */

export interface ExportData {
  businessName: string;
  industry?: string;
  tagline?: string;
  description?: string;
  logo?: string;
  heroImage?: string;
  sections: ExportSection[];
  brandColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  contact?: {
    email?: string;
    phone?: string;
    address?: string;
    social?: Record<string, string>;
  };
}

export interface ExportSection {
  type: 'hero' | 'about' | 'services' | 'testimonials' | 'contact' | 'footer';
  title?: string;
  subtitle?: string;
  content?: string;
  items?: Array<{
    title: string;
    description?: string;
    image?: string;
    icon?: string;
  }>;
}

export function generateHTML(data: ExportData): string {
  const colors = data.brandColors || {};
  const primary = colors.primary || '#3B82F6';
  const secondary = colors.secondary || '#1E40AF';
  const accent = colors.accent || '#F59E0B';
  const background = colors.background || '#FFFFFF';
  const text = colors.text || '#1F2937';

  const sections = data.sections.map(section => generateSection(section)).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.businessName}${data.tagline ? ` - ${data.tagline}` : ''}</title>
  <meta name="description" content="${data.description || data.businessName}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; color: ${text}; background: ${background}; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
    header { background: ${background}; padding: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); position: sticky; top: 0; z-index: 100; }
    header .container { display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 24px; font-weight: 700; color: ${primary}; }
    nav a { margin-left: 30px; text-decoration: none; color: ${text}; font-weight: 500; }
    nav a:hover { color: ${primary}; }
    .hero { padding: 100px 0; text-align: center; background: linear-gradient(135deg, ${primary} 0%, ${secondary} 100%); color: white; }
    .hero h1 { font-size: 48px; margin-bottom: 20px; }
    .hero p { font-size: 20px; opacity: 0.9; max-width: 600px; margin: 0 auto 30px; }
    .btn { display: inline-block; padding: 15px 40px; background: ${accent}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; transition: transform 0.2s; }
    .btn:hover { transform: translateY(-2px); }
    section { padding: 80px 0; }
    section h2 { font-size: 36px; text-align: center; margin-bottom: 50px; color: ${primary}; }
    .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 30px; }
    .service-card { background: ${background}; border: 1px solid #E5E7EB; border-radius: 12px; padding: 30px; text-align: center; transition: box-shadow 0.2s; }
    .service-card:hover { box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
    .service-card h3 { font-size: 20px; margin-bottom: 15px; color: ${primary}; }
    .contact-form { max-width: 600px; margin: 0 auto; }
    .contact-form input, .contact-form textarea { width: 100%; padding: 15px; margin-bottom: 20px; border: 1px solid #E5E7EB; border-radius: 8px; font-size: 16px; }
    footer { background: ${primary}; color: white; padding: 40px 0; text-align: center; }
    footer a { color: white; margin: 0 15px; }
    @media (max-width: 768px) {
      .hero h1 { font-size: 32px; }
      section h2 { font-size: 28px; }
      nav a { display: block; margin: 10px 0; }
    }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <div class="logo">${data.businessName}</div>
      <nav>
        <a href="#services">Services</a>
        <a href="#about">About</a>
        <a href="#contact">Contact</a>
      </nav>
    </div>
  </header>
  ${sections}
  <footer>
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${data.businessName}. All rights reserved.</p>
      ${data.contact?.email ? `<p>Contact: ${data.contact.email}</p>` : ''}
    </div>
  </footer>
</body>
</html>`;
}

function generateSection(section: ExportSection): string {
  switch (section.type) {
    case 'hero':
      return `<section class="hero"><div class="container"><h1>${section.title || ''}</h1><p>${section.subtitle || ''}</p><a href="#contact" class="btn">Get Started</a></div></section>`;
    case 'about':
      return `<section id="about"><div class="container"><h2>${section.title || 'About Us'}</h2><p style="text-align: center; max-width: 800px; margin: 0 auto;">${section.content || ''}</p></div></section>`;
    case 'services':
      const items = section.items?.map(item => `<div class="service-card"><h3>${item.title}</h3><p>${item.description || ''}</p></div>`).join('') || '';
      return `<section id="services"><div class="container"><h2>${section.title || 'Our Services'}</h2><div class="services-grid">${items}</div></div></section>`;
    case 'contact':
      return `<section id="contact"><div class="container"><h2>${section.title || 'Contact Us'}</h2><div class="contact-form"><form><input type="text" placeholder="Your Name"><input type="email" placeholder="Your Email"><textarea rows="5" placeholder="Your Message"></textarea><button type="submit" class="btn" style="width: 100%; border: none; cursor: pointer;">Send Message</button></form></div></div></section>`;
    case 'testimonials':
      const testimonials = section.items?.map(item => `<div class="service-card"><p>"${item.description}"</p><strong>- ${item.title}</strong></div>`).join('') || '';
      return `<section><div class="container"><h2>${section.title || 'What Our Clients Say'}</h2><div class="services-grid">${testimonials}</div></div></section>`;
    default:
      return '';
  }
}
