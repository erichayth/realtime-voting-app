#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const DOMAIN_URL = 'https://vote.aicloudrun.com/';
const QR_SIZE = '400x400';
const OUTPUT_DIR = path.join(__dirname, 'public');
const OUTPUT_FILE = 'qr-code.png';

console.log('🎯 Generating QR Code for:', DOMAIN_URL);
console.log('📐 Size:', QR_SIZE);

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Generate QR code using qr-server.com API
const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}&data=${encodeURIComponent(DOMAIN_URL)}`;

console.log('📡 Fetching QR code from API...');

https.get(qrApiUrl, (response) => {
    if (response.statusCode !== 200) {
        console.error('❌ Failed to generate QR code. Status:', response.statusCode);
        process.exit(1);
    }

    const chunks = [];
    
    response.on('data', (chunk) => {
        chunks.push(chunk);
    });
    
    response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const outputPath = path.join(OUTPUT_DIR, OUTPUT_FILE);
        
        // Save the QR code
        fs.writeFileSync(outputPath, buffer);
        
        console.log('✅ QR code generated successfully!');
        console.log('📁 Saved to:', outputPath);
        console.log('🔗 URL encoded:', DOMAIN_URL);
        console.log('\n📋 Next steps:');
        console.log('1. The QR code has been saved to public/qr-code.png');
        console.log('2. Upload this to your R2 bucket or serve it directly');
        console.log('3. Update your Worker to serve this QR code');
        console.log('\nTo upload to R2:');
        console.log('wrangler r2 object put survey-qr-codes/survey-qr.png --file=public/qr-code.png');
    });
}).on('error', (err) => {
    console.error('❌ Error generating QR code:', err.message);
    process.exit(1);
});