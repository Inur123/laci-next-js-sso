const url = require('url');
const https = require('https');

function testUrl(testName, testUrl) {
    return new Promise((resolve) => {
        https.get(testUrl, (res) => {
            console.log(`[${testName}] Status:`, res.statusCode);
            if (res.statusCode === 302) {
                console.log(`[${testName}] Redirect:`, res.headers.location);
            }
            resolve();
        });
    });
}

async function run() {
    const baseParams = new URLSearchParams({
        response_type: "code",
        client_id: "3572ad87-8086-40c2-902b-a0d187fa04c3",
        state: "D8MPkrMlsNWccMui8CIbrjPYLHXPA8JV",
        redirect_uri: "http://localhost:3000/api/auth/oauth2/callback/sso-ipnu",
        code_challenge_method: "S256",
        code_challenge: "W6OWtkj7hOtKg1JvyBDhV1vqEDcY74lB3OjBzUnYOOk",
        nonce: "test-nonce-12345"
    });

    let url1 = "https://api.pelajarnumagetan.id/oauth/authorize?" + baseParams.toString() + "&scope=openid+profile+email";
    await testUrl("Test with nonce", url1);
}
run();
