const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf-8');
server = server.replace('return res.status(500).json({ error: "Failed to extract from chunks" });', 'return res.status(500).json({ error: "Failed to extract from chunks: " + (error.message || "Unknown error") });');
fs.writeFileSync('server.ts', server);
