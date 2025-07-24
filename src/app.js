require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const documentRoutes = require('./routes/documentRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());

app.use('/api/documents', documentRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});