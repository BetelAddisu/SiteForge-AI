import { NextResponse } from 'next/server';
import { getStorageProvider, STORAGE_BUCKET } from '@/lib/storage';
import { getZipFromR2, extractKitSlug, type Manifest } from '@/lib/templates/manifest';

export async function GET() {
  try {
    console.log('[Debug] STORAGE_BUCKET:', STORAGE_BUCKET);
    
    const provider = await getStorageProvider();
    const zipFiles = (await provider.listFiles()).map(f => f.key);
    const zipNames = zipFiles.filter(f => f.endsWith('.zip'));
    
    console.log('[Debug] Found', zipNames.length, 'ZIP files');
    
    // Process only first 3 ZIPs for debug
    const debugResults: any[] = [];
    
    for (let i = 0; i < Math.min(3, zipNames.length); i++) {
      const zipName = zipNames[i];
      
      try {
        console.log('[Debug] Processing:', zipName);
        
        const zip = await getZipFromR2(zipName);
        if (!zip) {
          debugResults.push({ zip: zipName, error: 'No data' });
          continue;
        }
        
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
      bucket: STORAGE_BUCKET,
      totalZipFiles: zipNames.length,
      firstFewZips: zipNames.slice(0, 5),
      debugResults
    });
    
  } catch (error) {
    console.error('[Debug] Error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      bucket: STORAGE_BUCKET,
    }, { status: 500 });
  }
}
