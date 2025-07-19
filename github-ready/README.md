# AI Document Intelligence API

This project implements a RESTful API for uploading PDF documents and extracting structured data using advanced PDF parsing and AI-powered field recognition.

## 🚀 Features

- **PDF Upload & Processing**: Accept PDF files via REST API
- **Smart Field Extraction**: Automatically extract key fields like:
  - Vendor Name & Address
  - Ship To Address
  - PO Numbers
  - Invoice Numbers & Dates
  - Total Amounts & Subtotals
  - Phone & Fax Numbers
- **Document Type Detection**: Automatically identify document types (Invoice, Purchase Order, etc.)
- **Confidence Scoring**: Each extracted field includes a confidence score
- **JSON Output**: Structured data output saved to files
- **Error Handling**: Robust error handling with file cleanup

## 📁 Project Structure

```
ai-document-intelligence-api/
├── src/
│   ├── app.js                          # Main application entry point
│   ├── controllers/
│   │   └── documentController.js       # Handles document upload and processing
│   ├── routes/
│   │   └── documentRoutes.js          # API route definitions
│   ├── services/
│   │   └── documentIntelligenceService.js # PDF parsing and field extraction
│   ├── middleware/
│   │   └── upload.js                   # File upload middleware
│   └── utils/
│       └── fileProcessor.js            # Utility functions
├── uploads/                            # Temporary storage for uploaded PDFs
├── outputs/                            # Extracted data JSON files
├── package.json                        # Dependencies and scripts
├── .env.example                        # Environment variables template
└── README.md                           # Project documentation
```

## 🛠️ Setup Instructions

### 1. Clone the Repository
```bash
git clone <repository-url>
cd ai-document-intelligence-api
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your API credentials
AIFOUNDRY_API_KEY=your_api_key_here
AIFOUNDRY_API_URL=your_api_endpoint_here
PORT=3000
```

### 4. Start the Application
```bash
npm start
```

The server will start on `http://localhost:3000`

## 📚 API Usage

### Upload Document Endpoint

**Endpoint:** `POST /api/documents/upload`

**Description:** Upload a PDF document for data extraction

**Request:** 
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Form data with key `file` containing the PDF file

### Example Usage

#### Using cURL (Linux/Mac):
```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@path/to/your/document.pdf"
```

#### Using PowerShell (Windows):
```powershell
$uri = "http://localhost:3000/api/documents/upload"
$filePath = "path/to/your/document.pdf"
$fileBytes = [System.IO.File]::ReadAllBytes($filePath)
$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"
$bodyLines = @(
    "--$boundary",
    "Content-Disposition: form-data; name=`"file`"; filename=`"document.pdf`"",
    "Content-Type: application/pdf",
    "",
    [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($fileBytes),
    "--$boundary--",
    ""
)
$body = $bodyLines -join $LF
Invoke-RestMethod -Uri $uri -Method Post -ContentType "multipart/form-data; boundary=$boundary" -Body $body
```

### Response Format

```json
{
  "success": true,
  "message": "Document processed successfully",
  "outputFile": "extracted_1234567890_document.pdf.json",
  "data": {
    "fileName": "document.pdf",
    "fileSize": 98611,
    "uploadTime": "2025-07-19T01:41:20.944Z",
    "extractedFields": {
      "documentType": "Purchase Order",
      "pageCount": 1,
      "keyValuePairs": [
        {
          "key": "PO Number",
          "value": "PR028561",
          "confidence": 0.95
        },
        {
          "key": "Vendor Name",
          "value": "Barkman Honey, LLC",
          "confidence": 0.8
        },
        {
          "key": "Total Amount",
          "value": "689.25",
          "confidence": 0.8
        }
      ]
    }
  }
}
```

## 🏗️ Architecture

### Core Components

1. **Express.js Server**: RESTful API framework
2. **Multer Middleware**: Handles file uploads with PDF validation
3. **PDF-Parse**: Extracts text content from PDF files
4. **Document Intelligence Service**: 
   - Smart pattern matching for field extraction
   - Document type detection
   - Confidence scoring
5. **File Management**: Automatic cleanup of uploaded files

### Field Extraction Patterns

The service uses sophisticated regex patterns to extract:
- **PO Numbers**: `PR######` format and variations
- **Addresses**: Multi-line address blocks with proper formatting
- **Dates**: Various date formats (MM-DD-YYYY, DD-MMM-YYYY)
- **Financial Data**: Currency amounts with proper decimal handling
- **Contact Info**: Phone numbers, fax numbers
- **Company Names**: Business entity recognition

## 🔧 Dependencies

```json
{
  "express": "^4.17.1",      // Web framework
  "multer": "^1.4.2",        // File upload handling
  "pdf-parse": "^1.1.1",     // PDF text extraction
  "axios": "^0.21.1",        // HTTP client for API calls
  "dotenv": "^8.2.0",        // Environment variable management
  "form-data": "^4.0.4"      // Form data handling
}
```

## 📊 Output Files

Extracted data is saved in the `outputs/` directory with the following naming convention:
```
extracted_{timestamp}_{original_filename}.json
```

Each output file contains:
- Original file metadata
- Extracted text content
- Structured key-value pairs with confidence scores
- Processing metadata and timing information

## 🔒 Security Considerations

- PDF file validation (only PDF MIME types accepted)
- File size limitations through Multer configuration
- Automatic cleanup of uploaded files
- Environment variable protection (.env excluded from Git)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For issues and questions:
1. Check the existing issues in the GitHub repository
2. Create a new issue with detailed description
3. Include sample PDFs (with sensitive data removed) if relevant

---

**Note**: This implementation provides a foundation for document intelligence. For production use, consider adding authentication, rate limiting, and enhanced error handling.