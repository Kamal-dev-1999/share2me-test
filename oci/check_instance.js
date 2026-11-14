const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const tenancy = 'ocid1.tenancy.oc1..aaaaaaaa3apeakk5cat3uuzxp2xgbv3r5ux6cb2frdylillb7k3nl42ckc2a';
const user = 'ocid1.user.oc1..aaaaaaaabgmtwdnheozajrbr2waui4ghfwjunlvahfwl2dksqfazcjrshc2a';
const fingerprint = 'ea:9d:83:0f:86:79:80:6c:a6:ae:1f:c0:81:09:36:5e';
const privateKey = fs.readFileSync('d:/Downloads/ShareIt/oci/terraform/oci_api_key.pem', 'utf8');

const host = 'iaas.ap-mumbai-1.oraclecloud.com';
const path = '/20160918/instances?compartmentId=' + tenancy;
const date = new Date().toUTCString();

const signingString = `(request-target): get ${path}\ndate: ${date}\nhost: ${host}`;
const signer = crypto.createSign('RSA-SHA256');
signer.update(signingString);
const signature = signer.sign(privateKey, 'base64');
const keyId = `${tenancy}/${user}/${fingerprint}`;
const authHeader = `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",headers="(request-target) date host",signature="${signature}"`;

https.get({
  hostname: host,
  path: path,
  headers: { 'date': date, 'host': host, 'authorization': authHeader }
}, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    try {
      const instances = JSON.parse(body);
      console.log('Instances count:', instances.length);
      instances.forEach(i => console.log('Instance:', i.displayName, '| State:', i.lifecycleState, '| Shape:', i.shape, '| IP:', i.id));
    } catch(e) {
      console.log('Raw:', body);
    }
  });
}).on('error', e => console.error(e));

