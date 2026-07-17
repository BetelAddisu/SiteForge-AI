import { NextResponse } from 'next/server';
import { listFiles, r2, R2_BUCKET } from '@/lib/storage/r2';
import { GetObjectCommand } from "@aws-sdk/client-s3";
import JSZip from 'jszip';

interface ManifestTemplate {
  name: string;
  screenshot: string;
  source: string;
  type: string;
  metadata?: Record<string, unknown>;
  elementor_pro_required: boolean;
}

interface Manifest {
  manifest_version: string;
  title: string;
  templates: ManifestTemplate[];
}

function extractKitSlug(filename: string): string {
  const withoutExt = filename.replace('.zip', '');
  const withoutTimestamp = withoutExt.replace(/-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-utc$/, '');
  const cleanName = withoutTimestamp
    .replace(/-elementor-template-kit$/i, '')
    .replace(/-elementor-pro-template-kit$/i, '')
    .replace(/-woocommerce-el$/i, '')
    .replace(/-wordpress-theme$/i, '')
    .replace(/-full$/i, '');
  return cleanName;
}

export async function GET() {
  try {
    console.log('[Debug] R2_BUCKET:', R2_BUCKET);
    
    const zipFiles = await listFiles('');
    const zipNames = zipFiles.filter(f => f.endsWith('.zip'));
    
    console.log('[Debug] Found', zipNames.length, 'ZIP files');
    
    // Process only first 3 ZIPs for debug
    const debugResults: any[] = [];
    
    for (let i = 0; i < Math.min(3, zipNames.length); i++) {
      const zipName = zipNames[i];
      
      try {
        console.log('[Debug] Processing:', zipName);
        
        const command = new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: zipName,
        });
        
        const response = await r2.send(command);
        const zipData = await response.Body?.transformToByteArray();
        
        if (!zipData) {
          debugResults.push({ zip: zipName, error: 'No data' });
          continue;
        }
        
        const zip = await JSZip.loadAsync(zipData);
        const manifestFile = zip.file('manifest.json');
        
        if (!manifestFile) {
          debugResults.push({ zip: zipName, error: 'No manifest.json', filesInZip: Object.keys(zip.files).slice(0, 10) });
          continue;
        }
        
        const manifestContent = await manifestFile.async('string');
        const manifest: Manifest = JSON.parse(manifestContent);
        const kitSlug = extractKitSlug(zipName);
        
        debugResults.push({
          zip: zipName,
          kitSlug,
          manifestTitle: manifest.title,
          templateCount: manifest.templates.length,
          templates: manifest.templates.slice(0, 5).map(t => ({
            name: t.name,
            screenshot: t.screenshot,
            elementor_pro_required: t.elementor_pro_required
          })),
          filesInZip: Object.keys(zip.files).slice(0, 20)
        });
        
      } catch (err) {
        console.error('[Debug] Error:', err);
        debugResults.push({ zip: zipName, error: String(err) });
      }
    }
    
    return NextResponse.json({
      success: true,
      bucket: R2_BUCKET,
      totalZipFiles: zipNames.length,
      firstFewZips: zipNames.slice(0, 5),
      debugResults
    });
    
  } catch (error) {
    console.error('[Debug] Error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      bucket: R2_BUCKET,
    }, { status: 500 });
  }
}
