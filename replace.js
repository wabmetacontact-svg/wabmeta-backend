const fs = require('fs');
const path = 'c:\\Users\\Sameer Thakur\\WabMeta\\src\\pages\\Billing.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      ₹{((invoice.amount ?? 0) / 100).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">`;

const replacement = `                  <div className="flex flex-col">
                    <p className="font-medium text-gray-900 dark:text-white capitalize">
                      {invoice.description || 'Payment'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        ₹{((invoice.amount ?? 0) / 100).toFixed(2)}
                      </p>
                      <span className="text-gray-300 dark:text-gray-600 text-xs">•</span>
                      <p className="text-sm text-gray-500 dark:text-gray-400">`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content, 'utf8');
console.log('Replaced successfully!');
