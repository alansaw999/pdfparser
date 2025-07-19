class DocumentController {
    async uploadDocument(req, res) {
        try {
            // Assuming the file is uploaded successfully and available in req.file
            const file = req.file;
            if (!file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const extractedData = await this.processDocument(file);
            return res.status(200).json(extractedData);
        } catch (error) {
            return res.status(500).json({ error: 'An error occurred while uploading the document' });
        }
    }

    async processDocument(file) {
        const DocumentIntelligenceService = require('../services/documentIntelligenceService');
        const documentIntelligenceService = new DocumentIntelligenceService();

        const extractedData = await documentIntelligenceService.extractData(file);
        return extractedData;
    }
}

module.exports = DocumentController;
