const express = require('express');
const cors = require('cors')
const dotenv = require('dotenv')
const axios = require('axios');
const { google } = require('googleapis');

const app = express();
dotenv.config();
app.use(express.json());

// Google Safe Browsing API setup
const safeBrowsing = google.safebrowsing('v4');
const API_KEY = process.env.GOOGLE_API_KEY;

// Endpoint to analyze email content
app.post('/analyze-email', async (req, res) => {
    const { emailContent } = req.body;

    console.log(emailContent);

    // Extract links from email content
    const links = extractLinks(emailContent);

    // Check links with Google Safe Browsing API
    const maliciousLinks = await checkLinksWithSafeBrowsing(links);

    res.json({ maliciousLinks });
});

// Helper function to extract links from email content
function extractLinks(content) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    return content.match(urlRegex) || [];
}

// Helper function to check links with Google Safe Browsing
async function checkLinksWithSafeBrowsing(links) {
    const requestBody = {
        client: { clientId: 'phishh', clientVersion: '1.0' },
        threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: links.map(url => ({ url })),
        },
    };

    try {
        const response = await safeBrowsing.threatMatches.find({
            key: API_KEY,
            requestBody,
        });
        return response.data.matches || [];
    } catch (error) {
        console.error('Error checking links:', error);
        return [];
    }
}

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});