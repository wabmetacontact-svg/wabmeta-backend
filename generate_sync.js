const { execSync } = require('child_process');
const fs = require('fs');

try {
    console.log('Running prisma migrate diff...');
    const result = execSync('npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script', { 
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10 // 10MB
    });
    fs.writeFileSync('sync.sql', result);
    console.log('Successfully wrote sync.sql');
} catch (error) {
    console.error('Error:', error.message);
    if (error.stdout) console.error('STDOUT:', error.stdout);
    if (error.stderr) console.error('STDERR:', error.stderr);
}
