const fs = require('fs');

// Read the CSV file
const csvContent = fs.readFileSync('LandLinq_Communication_Templates.csv', 'utf8');
const lines = csvContent.split('\n');

// Skip header
const dataLines = lines.slice(1).filter(line => line.trim());

const emailTemplates = [];
const smsTemplates = [];

dataLines.forEach((line, index) => {
  // Basic CSV parsing - handle quoted fields
  const fields = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (nextChar === '"') {
        // Handle escaped quote
        currentField += '"';
        i++; // Skip next quote
      } else {
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
    i++;
  }
  fields.push(currentField);
  
  if (fields.length >= 7) {
    const [templateType, templateId, templateName, subjectContent, fullContent, usageType, variablesUsed] = fields;
    
    if (templateType === 'EMAIL') {
      emailTemplates.push({
        id: `template-${templateId}`,
        name: templateName.trim(),
        type: usageType.trim(),
        subject: subjectContent.trim(),
        content: fullContent.trim(),
        event: usageType.trim()
      });
    } else if (templateType === 'SMS') {
      smsTemplates.push({
        id: `sms-${templateId}`,
        name: templateName.trim(),
        type: usageType.trim(),
        content: fullContent.trim(),
        event: usageType.trim()
      });
    }
  }
});

console.log('Parsed Templates:');
console.log(`Email Templates: ${emailTemplates.length}`);
console.log(`SMS Templates: ${smsTemplates.length}`);

// Output the templates in JSON format for database insertion
const templatesData = {
  emailTemplates,
  smsTemplates
};

fs.writeFileSync('restored_templates.json', JSON.stringify(templatesData, null, 2));

console.log('\nFirst few email templates:');
emailTemplates.slice(0, 3).forEach(template => {
  console.log(`- ${template.name} (${template.type})`);
  console.log(`  Subject: ${template.subject}`);
  console.log(`  Content: ${template.content.substring(0, 100)}...`);
});

console.log('\nFirst few SMS templates:');
smsTemplates.slice(0, 3).forEach(template => {
  console.log(`- ${template.name} (${template.type})`);
  console.log(`  Content: ${template.content}`);
});