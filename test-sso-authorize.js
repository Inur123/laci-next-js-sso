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
        code_challenge: "W6OWtkj7hOtKg1JvyBDhV1vqEDcY74lB3OjBzUnYOOk"
    });

    // Test 1: with +
    let url1 = "https://api.pelajarnumagetan.id/oauth/authorize?" + baseParams.toString() + "&scope=openid+profile+email";
    await testUrl("Test 1 (Better Auth default)", url1);

    // Test 2: with %20
    let url2 = "https://api.pelajarnumagetan.id/oauth/authorize?" + baseParams.toString() + "&scope=openid%20profile%20email";
    await testUrl("Test 2 (%20)", url2);

    // Test 3: without scope
    let url3 = "https://api.pelajarnumagetan.id/oauth/authorize?" + baseParams.toString();
    await testUrl("Test 3 (no scope)", url3);

    // Test 4: openid only
    let url4 = "https://api.pelajarnumagetan.id/oauth/authorize?" + baseParams.toString() + "&scope=openid";
    await testUrl("Test 4 (openid only)", url4);
}
run();
