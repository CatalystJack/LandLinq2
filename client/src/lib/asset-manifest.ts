export const assetManifest: Record<string, string> = {
  "LL Header Email_1761148707803.png": "/assets/LL Header Email_1761148707803-4UdwW7pH.png",
  "White Icon_1760628698254.png": "/assets/White Icon_1760628698254-DYbV7iSt.png",
  "image_1759236402608.png": "/assets/image_1759236402608-O_ED1ccX.png",
  "LL Header_1761765577419.png": "/assets/LL Header_1761765577419-D9d1BiPF.png",
  "Catalyst_LandLinq_logo_1761753258508.png": "/assets/Catalyst_LandLinq_logo_1761753258508-BwtvyY_t.png",
  "image_1761050916067.png": "/assets/image_1761050916067-DxmIcWIT.png",
  "image_1761050933524.png": "/assets/image_1761050933524-D8PFtJS6.png",
  "image_1761050946547.png": "/assets/image_1761050946547-D5iTACAO.png",
  "image_1761050957386.png": "/assets/image_1761050957386-C-5WZWt1.png",
  "image_1761051021533.png": "/assets/image_1761051021533-C38aDlGu.png",
  "image_1761052606952.png": "/assets/image_1761052606952-DHOgiEmY.png",
  "image_1761054294500.png": "/assets/image_1761054294500-CtnNjyEO.png",
  "image_1761054394660.png": "/assets/image_1761054394660-Bz5Nm6tU.png",
  "image_1761053734909.png": "/assets/image_1761053734909-DD4K2nMy.png",
  "image_1761054355099.png": "/assets/image_1761054355099-DoxbSEE2.png",
  "image_1761058466027.png": "/assets/image_1761058466027-Cq327TQC.png",
  "image_1761058419203.png": "/assets/image_1761058419203-BCtM-rU3.png",
  "image_1761052822981.png": "/assets/image_1761052822981-CsSq3BBD.png",
  "image_1761052704036.png": "/assets/image_1761052704036-CqlfWvPI.png",
  "image_1761052745124.png": "/assets/image_1761052745124-CU_rLxwQ.png",
  "image_1761052729311.png": "/assets/image_1761052729311-CNFlUHBx.png",
  "image_1761052758767.png": "/assets/image_1761052758767-SqjN4OTz.png",
  "image_1761052778479.png": "/assets/image_1761052778479-CIjM3DWo.png",
  "image_1761052803480.png": "/assets/image_1761052803480-iD7EKw7B.png",
  "image_1761052842092.png": "/assets/image_1761052842092-CGE8L7Jm.png",
  "image_1761052881155.png": "/assets/image_1761052881155-BXbFBiZc.png",
  "image_1761052895999.png": "/assets/image_1761052895999-DRyNxHlg.png",
  "image_1761052909620.png": "/assets/image_1761052909620-C5kAwHR6.png",
  "image_1761052929840.png": "/assets/image_1761052929840-DjhdHwFa.png",
  "image_1761052971862.png": "/assets/image_1761052971862-DXaoKkeA.png",
  "image_1761052990859.png": "/assets/image_1761052990859-B4hEsqwo.png",
  "image_1761053007194.png": "/assets/image_1761053007194-CXNct0Bt.png",
  "image_1761053022067.png": "/assets/image_1761053022067-CDY6x4yG.png",
  "image_1761053044228.png": "/assets/image_1761053044228-DSBnSk3H.png",
  "image_1761053057986.png": "/assets/image_1761053057986-CJekHi-L.png",
  "landlinq-email-logo.png": "/assets/landlinq-email-logo.png",
  "catalyst-logo.png": "/assets/catalyst-logo.png"
};

export function getAssetUrl(assetKey: string): string {
  const path = assetManifest[assetKey];
  if (path) {
    return path;
  }
  
  for (const [key, value] of Object.entries(assetManifest)) {
    if (key.includes(assetKey) || assetKey.includes(key.split('_')[0])) {
      return value;
    }
  }
  
  console.warn(`Asset not found in manifest: ${assetKey}`);
  return '/assets/catalyst-logo.png';
}
