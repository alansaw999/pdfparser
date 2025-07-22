const DocumentIntelligenceService = require('../src/services/documentIntelligenceService');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

// Mock external dependencies
jest.mock('axios');
jest.mock('fs');
jest.mock('pdf-parse');

describe('DocumentIntelligenceService', () => {
    let service;
    let mockFile;
    let mockPdfData;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Setup environment variables
        process.env.AIFOUNDRY_API_KEY = 'test-api-key';
        process.env.AIFOUNDRY_API_URL = 'https://test-endpoint.openai.azure.com';
        process.env.AIFOUNDRY_DEPLOYMENT_NAME = 'test-deployment';
        process.env.AIFOUNDRY_API_VERSION = '2025-01-01-preview';

        // Create service instance
        service = new DocumentIntelligenceService();

        // Mock file object
        mockFile = {
            originalname: 'test-document.pdf',
            size: 98611,
            path: '/temp/test-document.pdf'
        };

        // Mock PDF data
        mockPdfData = {
            text: 'Test PDF content with PO Number PR028561 and vendor Barkman Honey, LLC',
            numpages: 1
        };

        // Setup default mocks
        fs.readFileSync.mockReturnValue(Buffer.from('mock pdf buffer'));
        fs.existsSync.mockReturnValue(true);
        fs.writeFileSync.mockImplementation(() => {});
        fs.unlinkSync.mockImplementation(() => {});
        pdfParse.mockResolvedValue(mockPdfData);
        
        // Mock Date.now for consistent timestamps
        jest.spyOn(Date, 'now').mockReturnValue(1234567890);
    });

    afterEach(() => {
        // Clean up environment variables
        delete process.env.AIFOUNDRY_API_KEY;
        delete process.env.AIFOUNDRY_API_URL;
        delete process.env.AIFOUNDRY_DEPLOYMENT_NAME;
        delete process.env.AIFOUNDRY_API_VERSION;
        
        jest.restoreAllMocks();
    });

    describe('Constructor', () => {
        it('should initialize with environment variables', () => {
            expect(service.apiKey).toBe('test-api-key');
            expect(service.apiUrl).toBe('https://test-endpoint.openai.azure.com');
            expect(service.deploymentName).toBe('test-deployment');
            expect(service.apiVersion).toBe('2025-01-01-preview');
        });

        it('should handle missing environment variables', () => {
            delete process.env.AIFOUNDRY_API_KEY;
            delete process.env.AIFOUNDRY_API_URL;
            
            const serviceWithoutEnv = new DocumentIntelligenceService();
            expect(serviceWithoutEnv.apiKey).toBeUndefined();
            expect(serviceWithoutEnv.apiUrl).toBeUndefined();
        });
    });

    describe('extractData', () => {
        it('should use local processing when API configuration is missing', async () => {
            // Remove API configuration
            service.apiKey = null;
            service.apiUrl = null;

            const result = await service.extractData(mockFile);

            expect(result.success).toBe(true);
            expect(result.message).toContain('local processing (AI Foundry not configured)');
            expect(result.data.fileName).toBe('test-document.pdf');
            expect(fs.unlinkSync).toHaveBeenCalledWith(mockFile.path);
        });

        it('should use AI Foundry when configuration is available', async () => {
            // Mock successful AI Foundry response
            const mockAiResponse = {
                data: {
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                vendorName: 'Barkman Honey, LLC',
                                poNumber: 'PR028561',
                                totalAmount: '689.25'
                            })
                        }
                    }]
                }
            };
            axios.post.mockResolvedValue(mockAiResponse);

            const result = await service.extractData(mockFile);

            expect(result.success).toBe(true);
            expect(result.message).toBe('Document processed successfully with AI Foundry');
            expect(axios.post).toHaveBeenCalled();
        });

        it('should fallback to local processing when AI Foundry fails', async () => {
            // Mock AI Foundry failure
            axios.post.mockRejectedValue(new Error('API Error'));

            const result = await service.extractData(mockFile);

            expect(result.success).toBe(true);
            expect(result.message).toContain('local processing (AI Foundry failed');
            expect(result.aiErrorDetails).toBeDefined();
            expect(result.aiErrorDetails.fallbackUsed).toBe(true);
        });

        it('should handle file cleanup on error', async () => {
            // Mock PDF parsing failure
            pdfParse.mockRejectedValue(new Error('PDF parsing failed'));

            await expect(service.extractData(mockFile)).rejects.toThrow('Error extracting data');
            expect(fs.unlinkSync).toHaveBeenCalledWith(mockFile.path);
        });
    });

    describe('callAIFoundryAPI', () => {
        beforeEach(() => {
            // Mock console methods to avoid spam in tests
            jest.spyOn(console, 'log').mockImplementation(() => {});
            jest.spyOn(console, 'warn').mockImplementation(() => {});
        });

        it('should successfully call AI Foundry with specific deployment', async () => {
            const mockAiResponse = {
                data: {
                    choices: [{
                        message: {
                            content: '```json\n{"vendorName": "Test Vendor", "poNumber": "123"}\n```'
                        }
                    }]
                }
            };
            axios.post.mockResolvedValue(mockAiResponse);

            const result = await service.callAIFoundryAPI(mockFile, Date.now());

            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/openai/deployments/test-deployment/chat/completions'),
                expect.objectContaining({
                    messages: expect.arrayContaining([
                        expect.objectContaining({ role: 'system' }),
                        expect.objectContaining({ role: 'user' })
                    ])
                }),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'api-key': 'test-api-key',
                        'Content-Type': 'application/json'
                    })
                })
            );

            expect(result.extractedFields.aiParsedData).toEqual({
                vendorName: 'Test Vendor',
                poNumber: '123'
            });
        });

        it('should try multiple deployments when specific deployment fails', async () => {
            // Remove specific deployment configuration
            service.deploymentName = null;
            service.apiVersion = null;

            // Mock first few failures, then success
            axios.post
                .mockRejectedValueOnce(new Error('404 DeploymentNotFound'))
                .mockRejectedValueOnce(new Error('404 DeploymentNotFound'))
                .mockResolvedValue({
                    data: {
                        choices: [{
                            message: {
                                content: '{"vendorName": "Success Vendor"}'
                            }
                        }]
                    }
                });

            const result = await service.callAIFoundryAPI(mockFile, Date.now());

            expect(axios.post).toHaveBeenCalledTimes(3);
            expect(result.extractedFields.aiParsedData.vendorName).toBe('Success Vendor');
        });

        it('should handle authentication errors appropriately', async () => {
            const authError = new Error('Authentication failed');
            authError.response = { status: 401, statusText: 'Unauthorized' };
            axios.post.mockRejectedValue(authError);

            await expect(service.callAIFoundryAPI(mockFile, Date.now()))
                .rejects.toThrow('Authentication failed');
        });

        it('should handle empty PDF text', async () => {
            pdfParse.mockResolvedValue({ text: '', numpages: 1 });

            await expect(service.callAIFoundryAPI(mockFile, Date.now()))
                .rejects.toThrow('No text content found in PDF');
        });
    });

    describe('convertAIResponseToFields', () => {
        it('should convert AI response to field format', () => {
            const aiData = {
                vendorName: 'Test Vendor',
                poNumber: 'PO123',
                totalAmount: '500.00'
            };

            const result = service.convertAIResponseToFields(aiData);

            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({
                key: 'Vendor Name',
                value: 'Test Vendor',
                confidence: 0.90
            });
            expect(result[1]).toEqual({
                key: 'PO Number',
                value: 'PO123',
                confidence: 0.90
            });
        });

        it('should handle nested objects', () => {
            const aiData = {
                vendor: {
                    name: 'Nested Vendor',
                    address: '123 Main St'
                }
            };

            const result = service.convertAIResponseToFields(aiData);

            expect(result.some(field => field.value === 'Nested Vendor')).toBe(true);
            expect(result.some(field => field.value === '123 Main St')).toBe(true);
        });
    });

    describe('parseAITextResponse', () => {
        it('should parse key-value pairs from text', () => {
            const aiText = `
                Vendor Name: Test Company
                PO Number: ABC123
                Total: $1,000.00
                Status: Not found
            `;

            const result = service.parseAITextResponse(aiText);

            expect(result).toHaveLength(3); // Should exclude "Not found"
            expect(result[0]).toEqual({
                key: 'Vendor Name',
                value: 'Test Company',
                confidence: 0.85
            });
        });

        it('should handle different separators', () => {
            const aiText = `
                Vendor Name - Test Company
                PO Number: ABC123
            `;

            const result = service.parseAITextResponse(aiText);

            expect(result).toHaveLength(2);
            expect(result[0].key).toBe('Vendor Name');
            expect(result[1].key).toBe('PO Number');
        });
    });

    describe('detectDocumentType', () => {
        it('should detect Purchase Order', () => {
            const text = 'This is a purchase order for items';
            const result = service.detectDocumentType(text);
            expect(result).toBe('Purchase Order');
        });

        it('should detect Invoice', () => {
            const text = 'Invoice #12345 for services rendered';
            const result = service.detectDocumentType(text);
            expect(result).toBe('Invoice');
        });

        it('should default to Business Document', () => {
            const text = 'Some random business text';
            const result = service.detectDocumentType(text);
            expect(result).toBe('Business Document');
        });
    });

    describe('calculateFieldConfidence', () => {
        it('should return 0 for missing values', () => {
            expect(service.calculateFieldConfidence('Test', null)).toBe(0.0);
            expect(service.calculateFieldConfidence('Test', 'Not found in document')).toBe(0.0);
        });

        it('should return high confidence for structured data', () => {
            expect(service.calculateFieldConfidence('PO Number', 'PR123456')).toBe(0.95);
            expect(service.calculateFieldConfidence('Phone Number', '555-123-4567')).toBe(0.95);
        });

        it('should return medium confidence for addresses', () => {
            expect(service.calculateFieldConfidence('Vendor Address', '123 Main St, City, ST 12345')).toBe(0.85);
        });

        it('should return default confidence for other fields', () => {
            expect(service.calculateFieldConfidence('Description', 'Some description')).toBe(0.80);
        });
    });

    describe('extractTablesFromText', () => {
        it('should extract table-like structures', () => {
            const text = `
Header1    Header2    Header3
Row1Col1   Row1Col2   Row1Col3
Row2Col1   Row2Col2   Row2Col3
            `;

            const result = service.extractTablesFromText(text);

            expect(result).toHaveLength(1);
            expect(result[0].rowCount).toBe(3);
            expect(result[0].cells).toHaveLength(3);
        });

        it('should ignore single-column data', () => {
            const text = `
Single line text
Another single line
            `;

            const result = service.extractTablesFromText(text);

            expect(result).toHaveLength(0);
        });
    });

    describe('parseDocumentFields', () => {
        it('should extract PO numbers', () => {
            const text = 'Document contains PO No. PR028561 for processing';
            const result = service.parseDocumentFields(text);
            
            const poField = result.find(field => field.key === 'PO Number');
            expect(poField).toBeDefined();
            expect(poField.value).toBe('PR028561');
            expect(poField.confidence).toBeGreaterThan(0.8);
        });

        it('should extract vendor information', () => {
            const text = 'Vendor: Barkman Honey, LLC\nAddress follows';
            const result = service.parseDocumentFields(text);
            
            const vendorField = result.find(field => field.key === 'Vendor Name');
            expect(vendorField).toBeDefined();
            expect(vendorField.value).toContain('Barkman Honey, LLC');
        });

        it('should extract financial amounts', () => {
            const text = 'Order Total: $689.25\nSub Total: $650.00';
            const result = service.parseDocumentFields(text);
            
            const totalField = result.find(field => field.key === 'Total Amount');
            expect(totalField).toBeDefined();
            expect(totalField.value).toBe('689.25');
        });

        it('should handle missing fields gracefully', () => {
            const text = 'Some document without standard fields';
            const result = service.parseDocumentFields(text);
            
            // Should still return all expected field keys, some with "Not found"
            expect(result.length).toBeGreaterThan(0);
            const notFoundFields = result.filter(field => field.value === 'Not found in document');
            expect(notFoundFields.length).toBeGreaterThan(0);
        });
    });

    describe('Additional Edge Cases and Coverage', () => {
        beforeEach(() => {
            jest.spyOn(console, 'log').mockImplementation(() => {});
            jest.spyOn(console, 'warn').mockImplementation(() => {});
        });

        it('should handle AI response parsing error and fallback to text parsing', async () => {
            // Mock AI response with invalid JSON
            const mockAiResponse = {
                data: {
                    choices: [{
                        message: {
                            content: 'Invalid JSON: {vendorName: "Test", invalid syntax}'
                        }
                    }]
                }
            };
            axios.post.mockResolvedValue(mockAiResponse);

            const result = await service.callAIFoundryAPI(mockFile, Date.now());

            expect(result).toBeDefined();
            expect(result.extractedFields.aiParsedData).toBeNull();
            // Should fallback to parseAITextResponse
            expect(console.warn).toHaveBeenCalledWith('AI response not in JSON format, parsing manually');
        });

        it('should handle very long addresses with truncation', () => {
            const longAddress = 'A'.repeat(350) + ' Very Long Street Name That Exceeds Limit';
            const text = `Vendor Address: ${longAddress}`;
            
            const result = service.parseDocumentFields(text);
            
            const addressField = result.find(field => field.key === 'Vendor Address');
            expect(addressField).toBeDefined();
            expect(addressField.value.endsWith('...')).toBe(true);
            expect(addressField.value.length).toBeLessThanOrEqual(303); // 300 + '...'
        });

        it('should clean up addresses with extra whitespace and newlines', () => {
            const messyAddress = 'Vendor Address:   123    Main   St\n\n   \n   City   ST   12345   \n\n';
            
            const result = service.parseDocumentFields(messyAddress);
            
            const addressField = result.find(field => field.key === 'Vendor Address');
            expect(addressField).toBeDefined();
            expect(addressField.value).toBe('123 Main St City ST 12345');
        });

        it('should test extractTextFromResponse utility method', () => {
            const responseWithContent = { content: 'Test content' };
            const responseWithoutContent = {};
            
            expect(service.extractTextFromResponse(responseWithContent)).toBe('Test content');
            expect(service.extractTextFromResponse(responseWithoutContent)).toBe('');
        });

        it('should test extractKeyValuePairs utility method', () => {
            const responseWithPairs = {
                keyValuePairs: [
                    { key: { content: 'Vendor' }, value: { content: 'Test Corp' }, confidence: 0.9 },
                    { key: { content: 'Amount' }, value: { content: '100' } }
                ]
            };
            const responseWithoutPairs = {};
            
            const result = service.extractKeyValuePairs(responseWithPairs);
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                key: 'Vendor',
                value: 'Test Corp',
                confidence: 0.9
            });
            expect(result[1]).toEqual({
                key: 'Amount',
                value: '100',
                confidence: 0
            });
            
            expect(service.extractKeyValuePairs(responseWithoutPairs)).toEqual([]);
        });

        it('should test extractTables utility method', () => {
            const responseWithTables = {
                tables: [
                    {
                        rowCount: 2,
                        columnCount: 3,
                        cells: [
                            { content: 'Cell1', rowIndex: 0, columnIndex: 0, confidence: 0.9 },
                            { content: 'Cell2', rowIndex: 0, columnIndex: 1 }
                        ]
                    }
                ]
            };
            const responseWithoutTables = {};
            
            const result = service.extractTables(responseWithTables);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                rowCount: 2,
                columnCount: 3,
                cells: [
                    { content: 'Cell1', rowIndex: 0, columnIndex: 0, confidence: 0.9 },
                    { content: 'Cell2', rowIndex: 0, columnIndex: 1, confidence: 0 }
                ]
            });
            
            expect(service.extractTables(responseWithoutTables)).toEqual([]);
        });

        it('should test calculateAverageConfidence utility method', () => {
            const responseWithConfidence = {
                keyValuePairs: [
                    { confidence: 0.8 },
                    { confidence: 0.9 }
                ],
                tables: [
                    {
                        cells: [
                            { confidence: 0.7 },
                            { confidence: 0.6 }
                        ]
                    }
                ]
            };
            const responseWithoutConfidence = {};
            
            const result = service.calculateAverageConfidence(responseWithConfidence);
            expect(result).toBe('75%'); // (0.8 + 0.9 + 0.7 + 0.6) / 4 = 0.75
            
            expect(service.calculateAverageConfidence(responseWithoutConfidence)).toBe('Unknown');
        });

        it('should handle edge cases in extractFieldWithSimplePattern', () => {
            // Test various field extraction scenarios
            const testCases = [
                {
                    text: 'Some text with PR123456 number',
                    field: 'PO Number',
                    expected: 'PR123456'
                },
                {
                    text: 'PO No.: ABC123',
                    field: 'PO Number',
                    expected: 'ABC123'
                },
                {
                    text: 'Company: Phenix Label Services',
                    field: 'Vendor Name',
                    expected: 'Phenix Label'
                },
                {
                    text: 'Order Total: 1234.56',
                    field: 'Total Amount',
                    expected: '1234.56'
                },
                {
                    text: 'Sub Total: 999.99',
                    field: 'Subtotal',
                    expected: '999.99'
                }
            ];

            testCases.forEach(({ text, field, expected }) => {
                const result = service.extractFieldWithSimplePattern(text, field);
                expect(result).toBe(expected);
            });

            // Test field that doesn't exist
            expect(service.extractFieldWithSimplePattern('no data', 'Unknown Field')).toBeNull();
        });

        it('should handle complex ship-to address extraction', () => {
            const text = `
                Bennett's Honey Farm
                3176 Honey Lane
                Filmore CA 93015
            `;
            
            const result = service.extractFieldWithSimplePattern(text, 'Ship To Address');
            expect(result).toContain("Bennett's Honey Farm");
            expect(result).toContain('3176 Honey Lane');
            expect(result).toContain('Filmore CA 93015');
        });

        it('should handle complex vendor address extraction', () => {
            const text = `
                Phenix Label
                Attn: Lori Hilton
                11610 S. Alden St
                Olathe KS 66062
            `;
            
            const result = service.extractFieldWithSimplePattern(text, 'Vendor Address');
            expect(result).toContain('Phenix Label');
            expect(result).toContain('Lori Hilton');
            expect(result).toContain('11610 S. Alden');
            expect(result).toContain('Olathe KS 66062');
        });

        it('should handle processWithLocalLogic with comprehensive data', async () => {
            // Create a more comprehensive PDF text for better coverage
            const comprehensivePdfData = {
                text: `
                    Purchase Order Document
                    PO No.: PR028561
                    
                    Vendor: Barkman Honey, LLC
                    Vendor Address: 123 Honey Street
                    City, State 12345
                    Phone: 555-123-4567
                    Fax: 555-123-4568
                    
                    Ship To: Bennett's Honey Farm
                    3176 Honey Lane
                    Filmore CA 93015
                    
                    Order Date: 01-15-2024
                    Required Date: 02-01-2024
                    Ship Via: UPS
                    
                    Item    Description    Qty    Price
                    001     Honey Jars     100    $5.00
                    002     Labels         500    $0.25
                    
                    Sub Total: $625.00
                    Tax: $64.25
                    Order Total: $689.25
                `,
                numpages: 2
            };
            
            pdfParse.mockResolvedValue(comprehensivePdfData);

            const result = await service.processWithLocalLogic(mockFile, Date.now());

            expect(result.fileName).toBe('test-document.pdf');
            expect(result.extractedFields.pageCount).toBe(2);
            expect(result.extractedFields.documentType).toBe('Purchase Order');
            expect(result.extractedFields.keyValuePairs.length).toBeGreaterThan(0);
            
            // Check that specific fields were extracted
            const poField = result.extractedFields.keyValuePairs.find(field => field.key === 'PO Number');
            expect(poField).toBeDefined();
            expect(poField.value).toBe('PR028561');
            
            expect(fs.writeFileSync).toHaveBeenCalled();
            expect(fs.unlinkSync).toHaveBeenCalledWith(mockFile.path);
        });

        it('should handle different document types with detectDocumentType', () => {
            const testCases = [
                { text: 'Receipt #12345 for payment', expected: 'Receipt' },
                { text: 'Bill of Lading for shipment', expected: 'Bill of Lading' },
                { text: 'Packing Slip for order', expected: 'Packing Slip' },
                { text: 'Random business document', expected: 'Business Document' }
            ];

            testCases.forEach(({ text, expected }) => {
                expect(service.detectDocumentType(text)).toBe(expected);
            });
        });

        it('should handle table extraction with single-row tables', () => {
            const textWithSingleRow = `
                Header1    Header2    Header3
                OnlyRow1   OnlyRow2   OnlyRow3
            `;

            const result = service.extractTablesFromText(textWithSingleRow);
            expect(result).toHaveLength(1);
            expect(result[0].rowCount).toBe(2);
        });

        it('should handle confidence calculation edge cases', () => {
            // Test edge cases for calculateFieldConfidence
            expect(service.calculateFieldConfidence('', '')).toBe(0.0);
            expect(service.calculateFieldConfidence('Test', '')).toBe(0.0);
            
            // Test structured data patterns
            expect(service.calculateFieldConfidence('Invoice Number', 'INV-123')).toBe(0.95);
            expect(service.calculateFieldConfidence('Date Field', '2024-01-15')).toBe(0.95);
            expect(service.calculateFieldConfidence('Random Field', 'abc def')).toBe(0.80); // Default confidence
            
            // Test address fields
            expect(service.calculateFieldConfidence('Home Address', 'Short')).toBe(0.60);
            expect(service.calculateFieldConfidence('Billing Address', 'This is a longer address with more details')).toBe(0.85);
        });
    });
});
