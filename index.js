const express = require('express');
const cors = require('cors')
const dotenv = require('dotenv')
const axios = require('axios');
const { google } = require('googleapis');
const { listEmails } = require('./gmailService');

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

const CLIENT_ID = process.env.OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:5000/oauth2callback';
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

// Google Safe Browsing API setup
const safeBrowsing = google.safebrowsing('v4');
const API_KEY = process.env.GOOGLE_API_KEY;

// 
const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

// Fetch unread emails
app.get('/fetch-emails', async (req, res) => {
    const emails = await listEmails();
    res.json({ emails });
});

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

app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send('Error: Missing authorization code.');
    }

    try {
        const { tokens } = await oAuth2Client.getToken(code);
        console.log('✅ Access Token:', tokens.access_token);
        console.log('✅ Refresh Token:', tokens.refresh_token);

        // Save tokens for later use
        oAuth2Client.setCredentials(tokens);

        // Send response to the user
        res.send('Authentication successful! You can close this window.');
    } catch (error) {
        console.error('❌ Error exchanging code:', error);
        res.status(500).send('Error during authentication.');
    }
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