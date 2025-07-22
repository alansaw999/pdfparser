const DocumentController = require('../src/controllers/documentController');

// Mock the DocumentIntelligenceService
jest.mock('../src/services/documentIntelligenceService');

describe('Document Controller Unit Tests', () => {
    let documentController;

    beforeEach(() => {
        documentController = new DocumentController();
        
        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('uploadDocument', () => {
        it('should handle successful document processing', async () => {
            // Mock successful response from DocumentIntelligenceService
            const mockService = require('../src/services/documentIntelligenceService');
            mockService.prototype.extractData = jest.fn().mockResolvedValue({
                success: true,
                message: 'Document processed successfully with AI Foundry',
                outputFile: 'extracted_test.json',
                data: {
                    fileName: 'test.pdf',
                    extractedFields: {
                        keyValuePairs: [
                            { key: 'PO Number', value: 'PR123456', confidence: 0.95 }
                        ]
                    }
                }
            });

            const mockReq = {
                file: {
                    originalname: 'test.pdf',
                    size: 1024,
                    mimetype: 'application/pdf'
                }
            };

            const mockRes = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await documentController.uploadDocument(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: expect.stringContaining('AI Foundry')
                })
            );
            expect(mockService.prototype.extractData).toHaveBeenCalledWith(mockReq.file);
        });

        it('should handle missing file', async () => {
            const mockReq = { file: null };
            const mockRes = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await documentController.uploadDocument(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.stringContaining('No file uploaded')
                })
            );
        });

        it('should handle service errors', async () => {
            const mockService = require('../src/services/documentIntelligenceService');
            mockService.prototype.extractData = jest.fn().mockRejectedValue(
                new Error('Service error')
            );

            const mockReq = {
                file: {
                    originalname: 'test.pdf',
                    size: 1024,
                    mimetype: 'application/pdf'
                }
            };

            const mockRes = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await documentController.uploadDocument(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'An error occurred while uploading the document'
                })
            );
        });

        it('should handle invalid file type through service error', async () => {
            // Mock service to throw error for invalid file type
            const mockService = require('../src/services/documentIntelligenceService');
            mockService.prototype.extractData = jest.fn().mockRejectedValue(
                new Error('Invalid file type')
            );

            const mockReq = {
                file: {
                    originalname: 'test.txt',
                    size: 1024,
                    mimetype: 'text/plain'
                }
            };

            const mockRes = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await documentController.uploadDocument(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'An error occurred while uploading the document'
                })
            );
        });
    });
});
