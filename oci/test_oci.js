const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const tenancy = 'ocid1.tenancy.oc1..aaaaaaaa3apeakk5cat3uuzxp2xgbv3r5ux6cb2frdylillb7k3nl42ckc2a';
const userOcid = 'ocid1.user.oc1..aaaaaaaabgmtwdnheozajrbr2waui4ghfwjunlvahfwl2dksqfazcjrshc2a';
const fingerprint = 'ea:9d:83:0f:86:79:80:6c:a6:ae:1f:c0:81:09:36:5e';
const privateKey = fs.readFileSync('d:/Downloads/ShareIt/oci/adivishwakarma.work@gmail.com-2026-11-13T15_49_45.328Z.pem', 'utf8');

const candidateUsers = [
  userOcid,
  'adivishwakarma.work@gmail.com',
  'Default/adivishwakarma.work@gmail.com',
  'idcs-5b2f9e9fb3f047f8820daecafc74f77f/adivishwakarma.work@gmail.com'
];

async function testCandidate(candidate) {
  return new Promise((resolve) => {
    const host = 'identity.ap-mumbai-1.oci.oraclecloud.com';
    const path = '/20160918/availabilityDomains?compartmentId=' + tenancy;
    const date = new Date().toUTCString();

    const signingString = '(request-target): get ' + path + '\ndate: ' + date + '\nhost: ' + host;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingString);
    const signature = signer.sign(privateKey, 'base64');

    const keyId = [tenancy, candidate, fingerprint].join('/');
    const authHeader = `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",headers="(request-target) date host",signature="${signature}"`;

    const req = https.request({
      hostname: host,
      path: path,
      method: 'GET',
      headers: {
        'date': date,
        'host': host,
        'authorization': authHeader
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        resolve({ candidate, status: res.statusCode, body: body.substring(0, 100) });
      });
    });
    req.on('error', e => resolve({ candidate, error: e.message }));
    req.end();
  });
}

(async () => {
  for (const c of candidateUsers) {
    const res = await testCandidate(c);
    console.log(`Candidate: ${c} -> Status: ${res.status} | Body: ${res.body}`);
  }
})();

