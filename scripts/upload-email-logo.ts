import { objectStorageClient } from '../server/objectStorage';
import fs from 'fs';
import path from 'path';

async function uploadEmailLogo() {
  try {
    console.log('📤 Uploading email logo to object storage...');
    
    // Get the public directory from environment
    const publicDir = process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    if (!publicDir) {
      throw new Error('PUBLIC_OBJECT_SEARCH_PATHS not set');
    }
    
    // Parse the public directory path
    let publicPath = publicDir;
    try {
      const paths = JSON.parse(publicDir);
      publicPath = paths[0];
    } catch {
      // Already a string, use as-is
    }
    
    // Extract bucket name and create full path
    const bucketName = publicPath.replace(/^\//, '').split('/')[0];
    const logoFileName = 'landlinq-email-logo.png';
    const objectName = `public/${logoFileName}`;
    
    console.log(`📦 Bucket: ${bucketName}`);
    console.log(`📍 Destination: ${objectName}`);
    
    // Read the logo file
    const logoPath = path.join(process.cwd(), 'attached_assets/LL Header_1761765577419.png');
    const logoBuffer = fs.readFileSync(logoPath);
    
    console.log(`📄 Logo file size: ${logoBuffer.length} bytes`);
    
    // Upload to object storage
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    await file.save(logoBuffer, {
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000', // Cache for 1 year
      },
      // Don't set public: true - files in public/ directory are accessible via public path
    });
    
    // Construct the public URL
    const publicUrl = `https://objstore.replit.com/${bucketName}/${objectName}`;
    
    console.log('✅ Logo uploaded successfully!');
    console.log(`📍 Public URL: ${publicUrl}`);
    console.log('');
    console.log('Next step: Update your business settings with this URL');
    console.log(`SQL: UPDATE business_settings SET logo_url = '${publicUrl}' WHERE id IS NOT NULL;`);
    
    return publicUrl;
    
  } catch (error) {
    console.error('❌ Upload failed:', error);
    throw error;
  }
}

// Run the upload
uploadEmailLogo()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
