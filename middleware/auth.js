const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const client = jwksClient({
  jwksUri: "https://login.microsoftonline.com/common/discovery/v2.0/keys",
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

async function validateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(
    token,
    getKey,
    {
      audience: process.env.AZURE_CLIENT_ID,
      issuerPattern: /^https:\/\/login\.microsoftonline\.com\/.+\/v2\.0$/,
    },
    (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: "Invalid token", detail: err.message });
      }

      // Attach tenant ID and user info to request for use in routes
      req.tenantId = decoded.tid;
      req.userEmail = decoded.preferred_username;
      next();
    }
  );
}

module.exports = { validateToken };