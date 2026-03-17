const { execSync } = require('child_process');
try {
  const output = execSync('npx prisma -v', { encoding: 'utf8' });
  console.log(output);
} catch (error) {
  console.error(error.message);
  console.error(error.stdout);
  console.error(error.stderr);
}
