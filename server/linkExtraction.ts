// Link Extraction Service
// Extracts URLs and links from email body text

export interface ExtractedLink {
  url: string;
  type: 'web' | 'google_drive' | 'dropbox' | 'due_diligence' | 'other';
  description?: string;
}

/**
 * Extract all URLs from text
 */
export function extractLinksFromText(text: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  
  // Comprehensive URL regex that handles various formats
  const urlRegex = /(?:https?:\/\/|www\.)(?:[^\s<>"{}|\\^`\[\]]+)/gi;
  
  const matches = text.match(urlRegex);
  
  if (!matches) {
    return links;
  }
  
  for (const url of matches) {
    // Classify the link type
    let type: ExtractedLink['type'] = 'other';
    let description: string | undefined;
    
    if (url.includes('drive.google.com')) {
      type = 'google_drive';
      description = 'Google Drive document';
    } else if (url.includes('dropbox.com')) {
      type = 'dropbox';
      description = 'Dropbox file';
    } else if (url.includes('due') && url.includes('diligence')) {
      type = 'due_diligence';
      description = 'Due diligence link';
    } else if (url.match(/\.(pdf|doc|docx|xls|xlsx|csv)$/i)) {
      type = 'web';
      description = 'Document link';
    } else {
      type = 'web';
      description = 'Web link';
    }
    
    links.push({
      url: url.startsWith('www.') ? `https://${url}` : url,
      type,
      description
    });
  }
  
  // Remove duplicates
  const uniqueLinks = links.filter((link, index, self) =>
    index === self.findIndex((l) => l.url === link.url)
  );
  
  console.log(`🔗 Extracted ${uniqueLinks.length} unique links from text`);
  
  return uniqueLinks;
}
