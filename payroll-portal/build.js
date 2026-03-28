// Simple build script for Cloudflare Pages
// This script ensures all necessary files are in place for deployment

const fs = require('fs');
const path = require('path');

console.log('🚀 Building BMGOne Payroll Portal for deployment...');

// Check if all required files exist
const requiredFiles = [
    'index.html',
    'styles.css', 
    'script.js',
    'onboarding.html',
    'banner.png',
    'logo.png',
    '_redirects',
    'package.json'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file} - Found`);
    } else {
        console.log(`❌ ${file} - Missing`);
        allFilesExist = false;
    }
});

if (allFilesExist) {
    console.log('\n🎉 Build completed successfully!');
    console.log('📁 All files are ready for Cloudflare Pages deployment');
    console.log('🌐 Ready to deploy to: https://pay.bmgone.com');
} else {
    console.log('\n❌ Build failed - Some required files are missing');
    process.exit(1);
}
