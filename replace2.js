const fs = require('fs');
const path = 'c:\\Users\\Sameer Thakur\\WabMeta\\src\\pages\\Billing.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  date: string;
  downloadUrl?: string;
}`;

const replacement = `interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | string;
  date: string;
  description?: string;
  type?: string;
  downloadUrl?: string;
}`;

content = content.replace(target, replacement);

// Alternative string replace to bypass newlines
content = content.replace(/status: 'paid' \| 'pending' \| 'failed';\s*date: string;\s*downloadUrl\?: string;/g, "status: 'paid' | 'pending' | 'failed' | string;\n  date: string;\n  description?: string;\n  type?: string;\n  downloadUrl?: string;");

fs.writeFileSync(path, content, 'utf8');
console.log('Replaced successfully!');
