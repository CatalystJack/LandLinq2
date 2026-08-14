import { Client } from "@replit/object-storage";
import * as fs from "fs";
import * as path from "path";

const ESSENTIAL_IMAGES = [
  "LL Header Email_1761148707803.png",
  "ian-aw8c-nqCOyc-unsplash_1761664267477.jpg",
  "stock_images/construction_site_ap_014957d6.jpg",
  "stock_images/modern_completed_apa_b09d8609.jpg",
  "White Icon_1760628698254.png",
  "Add a heading_1762187075044.png",
  "image_1759236402608.png",
  "LL Header_1761765577419.png",
  "Catalyst:LandLinq_logo_1761758327453.png",
  "Add a heading copy_1762196498512.png",
  "image_1760625447005.png",
  "image_1761050916067.png",
  "image_1761050933524.png",
  "image_1761050946547.png",
  "image_1761050957386.png",
  "image_1761051021533.png",
  "image_1761052558234.png",
  "image_1761052606952.png",
  "image_1761054294500.png",
  "image_1761054394660.png",
  "image_1761053734909.png",
  "image_1761054355099.png",
  "image_1761058466027.png",
  "image_1761058419203.png",
  "image_1761052822981.png",
  "image_1761052704036.png",
  "image_1761052745124.png",
  "image_1761052729311.png",
  "image_1761052758767.png",
  "image_1761052778479.png",
  "image_1761052803480.png",
  "image_1761052842092.png",
  "image_1761052881155.png",
  "image_1761052895999.png",
  "image_1761052909620.png",
  "image_1761052929840.png",
  "image_1761052971862.png",
  "image_1761052990859.png",
  "image_1761053007194.png",
  "image_1761053022067.png",
  "image_1761053044228.png",
  "image_1761053057986.png"
];

async function uploadAssets() {
  const client = new Client();
  const manifestData: Record<string, string> = {};
  const basePath = path.join(process.cwd(), "attached_assets");
  
  console.log("🚀 Starting asset upload to Object Storage...\n");
  
  for (const imagePath of ESSENTIAL_IMAGES) {
    const fullPath = path.join(basePath, imagePath);
    const fileName = imagePath.replace(/\//g, "_");
    const storagePath = `public/assets/${fileName}`;
    
    try {
      if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  File not found: ${imagePath}`);
        continue;
      }
      
      const fileBuffer = fs.readFileSync(fullPath);
      await client.uploadFromBytes(storagePath, fileBuffer);
      
      const publicUrl = `https://replit.com/public/images/${process.env.REPLIT_ID}/${storagePath}`;
      manifestData[imagePath] = storagePath;
      
      const size = (fileBuffer.length / 1024).toFixed(1);
      console.log(`✅ Uploaded: ${imagePath} (${size} KB)`);
    } catch (error) {
      console.error(`❌ Error uploading ${imagePath}:`, error);
    }
  }
  
  const tsContent = `export const assetManifest: Record<string, string> = ${JSON.stringify(manifestData, null, 2)};

export function getAssetUrl(assetKey: string): string {
  const storagePath = assetManifest[assetKey];
  if (!storagePath) {
    console.warn(\`Asset not found in manifest: \${assetKey}\`);
    return '';
  }
  return \`/api/assets/\${encodeURIComponent(storagePath)}\`;
}
`;
  
  const manifestPath = path.join(process.cwd(), "client/src/lib/asset-manifest.ts");
  fs.writeFileSync(manifestPath, tsContent);
  console.log(`\n📄 Manifest written to: ${manifestPath}`);
  console.log(`\n✅ Upload complete! ${Object.keys(manifestData).length} assets uploaded.`);
}

uploadAssets().catch(console.error);
