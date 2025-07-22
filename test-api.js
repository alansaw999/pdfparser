const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testDocumentUpload() {
    try {
        console.log('🧪 Testing AI Document Intelligence API...\n');
        
        // You can place a test PDF in the files/ directory
        const pdfPath = path.join(__dirname, 'files', 'document.pdf');
        
        if (!fs.existsSync(pdfPath)) {
            console.log('📄 No test PDF found at:', pdfPath);
            console.log('💡 Place a PDF file at files/document.pdf to test the API');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', fs.createReadStream(pdfPath));
        
        console.log('📄 Uploading PDF file...');
        console.log('📁 File path:', pdfPath);
        console.log('📊 File size:', (fs.statSync(pdfPath).size / 1024).toFixed(1), 'KB');
        
        const response = await axios.post('http://localhost:3000/api/documents/upload', formData, {
            headers: {
                ...formData.getHeaders(),
            },
            timeout: 60000 // 60 second timeout
        });
        
        console.log('\n✅ Upload successful!');
        console.log('🤖 Processing method used:', response.data.data.extractedFields.metadata.processingMethod);
        console.log('📋 Message:', response.data.message);
        console.log('📄 Output file:', response.data.outputFile);
        
        if (response.data.data.extractedFields.keyValuePairs) {
            console.log('\n📊 Extracted Fields:');
            response.data.data.extractedFields.keyValuePairs.forEach(field => {
                console.log(`  ${field.key}: ${field.value} (confidence: ${field.confidence})`);
            });
        }
        
    } catch (error) {
        console.error('\n❌ Upload failed:');
        if (error.code === 'ECONNREFUSED') {
            console.error('🔗 Connection refused - make sure the server is running on http://localhost:3000');
            console.error('💡 Run: npm start');
        } else {
            console.error('Status:', error.response?.status);
            console.error('Message:', error.response?.data?.error || error.message);
        }
    }
}

// Check if server is running
console.log('🔍 Testing if server is running...');
testDocumentUpload();
