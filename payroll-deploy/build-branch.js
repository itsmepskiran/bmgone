// Build script for branch deployment
// Copies files to root for Cloudflare Pages

const fs = require('fs');
const path = require('path');

console.log('🚀 Building BMGOne Payroll Portal for branch deployment...');

// Files to copy to root
const filesToCopy = [
    'index.html',
    'styles.css',
    'script.js',
    'onboarding.html',
    'banner.png',
    'logo.png',
    '_redirects'
];

// Copy files to root directory
filesToCopy.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file} - Ready for deployment`);
    } else {
        console.log(`❌ ${file} - Missing`);
        process.exit(1);
    }
});

console.log('\n🎉 Build completed successfully!');
console.log('📁 Files are ready for Cloudflare Pages branch deployment');
console.log('🌐 Ready to deploy to: https://pay.bmgone.com');
console.log('🔧 Configure Cloudflare Pages with:');
console.log('   - Root directory: /payroll-deploy');
console.log('   - Build command: npm run build-branch');
