const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf-8');

server = server.replace('import path from "path";', 'import path from "path";\nimport fs from "fs";');

const oldExtraction = `
        const response = await generateContentWithRetry({
          model: "gemini-2.5-flash",
          contents: [
            {
              parts: [
                { text: promptText },
                { inlineData: { data: fullBase64, mimeType: mimeType } }
              ]
            }
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: schema
          }
        });`;

const newExtraction = `
        let response;
        let fileInfo = null;
        try {
          if (fullBase64.length > 2 * 1024 * 1024) { // Use File API for base64 > 2MB
            const tmpFilePath = path.join('/tmp', \`\${userScopedUploadId.replace(/[^a-zA-Z0-9_]/g, '')}.tmp\`);
            fs.writeFileSync(tmpFilePath, Buffer.from(fullBase64, 'base64'));
            try {
              fileInfo = await getAiClient().files.upload({ file: tmpFilePath, mimeType: mimeType });
            } finally {
              if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
            }
            response = await generateContentWithRetry({
              model: "gemini-2.5-flash",
              contents: [{
                parts: [
                  { text: promptText },
                  { fileData: { fileUri: fileInfo.uri, mimeType: mimeType } }
                ]
              }],
              config: {
                responseMimeType: "application/json",
                responseSchema: schema
              }
            });
          } else {
            response = await generateContentWithRetry({
              model: "gemini-2.5-flash",
              contents: [{
                parts: [
                  { text: promptText },
                  { inlineData: { data: fullBase64, mimeType: mimeType } }
                ]
              }],
              config: {
                responseMimeType: "application/json",
                responseSchema: schema
              }
            });
          }
        } finally {
          if (fileInfo) {
            try {
              await getAiClient().files.delete({ name: fileInfo.name });
            } catch (e) {
              console.error("Failed to delete temp file from Gemini:", e);
            }
          }
        }`;

server = server.replace(oldExtraction, newExtraction);
fs.writeFileSync('server.ts', server);
console.log('Fixed server.ts');
