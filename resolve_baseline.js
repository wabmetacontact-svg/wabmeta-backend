const { execSync } = require('child_process');
try {
    console.log('Resolving baseline migration...');
    const result = execSync('npx prisma migrate resolve --applied 20260317000000_baseline_fix_drift', { encoding: 'utf8' });
    console.log(result);
} catch (error) {
    console.error('Error:', error.message);
    if (error.stdout) console.error('STDOUT:', error.stdout);
    if (error.stderr) console.error('STDERR:', error.stderr);
}
