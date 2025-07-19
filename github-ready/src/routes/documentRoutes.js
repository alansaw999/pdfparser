const express = require('express');
const DocumentController = require('../controllers/documentController');
const upload = require('../middleware/upload');

const router = express.Router();
const documentController = new DocumentController();

router.post('/upload', upload.single('file'), documentController.uploadDocument.bind(documentController));

module.exports = router;
