const fs = require('fs');
const path = require('path');

const saveExtractedData = (data, outputFileName) => {
    const outputPath = path.join(__dirname, '../../outputs', outputFileName);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    return outputPath;
};

const formatDataForOutput = (extractedData) => {
    const formattedData = {};
    for (const [key, value] of Object.entries(extractedData)) {
        formattedData[key] = value;
    }
    return formattedData;
};

module.exports = {
    saveExtractedData,
    formatDataForOutput
};