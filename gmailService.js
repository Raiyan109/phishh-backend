require('dotenv').config();
const { google } = require('googleapis');

const CLIENT_ID = process.env.OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:5000/oauth2callback';
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

async function listEmails() {
    try {
        const res = await gmail.users.messages.list({ userId: 'me', maxResults: 5 });
        const messages = res.data.messages || [];

        // Fetch details for each email including the body
        const emailDetails = await Promise.all(
            messages.map(async (message) => {
                const email = await gmail.users.messages.get({ userId: 'me', id: message.id });
                const payload = email.data.payload;

                // Extract headers (From, Subject)
                const headers = payload.headers;
                const from = headers.find((h) => h.name === 'From')?.value || 'Unknown';
                const subject = headers.find((h) => h.name === 'Subject')?.value || 'No Subject';

                // Extract the body (HTML or plain text)
                const parts = payload.parts || [];
                let bodyContent = '';
                if (parts.length > 0) {
                    bodyContent = parts.find(part => part.mimeType === 'text/plain')?.body?.data || '';
                    if (!bodyContent) {
                        bodyContent = parts.find(part => part.mimeType === 'text/html')?.body?.data || '';
                    }
                }

                // Decode base64url encoded body
                const decodedBody = decodeBase64Url(bodyContent);

                return {
                    id: message.id,
                    threadId: message.threadId,
                    from,
                    subject,
                    body: decodedBody,
                };
            })
        );

        return emailDetails;
    } catch (error) {
        console.error('Error fetching emails:', error);
        return [];
    }
}

// Helper function to decode base64url-encoded body content
function decodeBase64Url(base64Url) {
    if (!base64Url) return '';
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    base64 += padding;
    return Buffer.from(base64, 'base64').toString('utf8');
}

module.exports = { gmail, listEmails };
