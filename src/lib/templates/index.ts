import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export interface Template {
  id: string;
  name: string;
  category: string;
  industry?: string;
  style?: string;
  filePath?: string;
  extractedPath?: string;
  previewImage?: string;
  metadata?: Record<string, unknown>;
  globalStyles?: Record<string, unknown>;
  compatibilityScore?: number;
  compatibilityNotes?: Record<string, unknown>;
  importStatus: string;
  createdAt: string;
}

export async function getTemplates(): Promise<Template[]> {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('Template')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching templates:', err);
    return [];
  }
}

export async function getTemplate(id: string): Promise<Template | null> {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from('Template')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching template:', err);
    return null;
  }
}

export async function getTemplateSections(templateId: string) {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('TemplateSection')
      .select('*')
      .eq('templateId', templateId);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching sections:', err);
    return [];
  }
}
