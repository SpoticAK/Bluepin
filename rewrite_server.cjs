const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// 1. Add imports
code = code.replace(
  'import { GoogleGenAI, Type } from "@google/genai";',
  'import { GoogleGenAI, Type } from "@google/genai";\nimport pdfParse from "pdf-parse";\nimport sharp from "sharp";'
);

// 2. Fix the upload-chunk route
const oldUploadChunkStart = `      if (chunks.filter(Boolean).length === totalChunks) {
        const fullBase64 = chunks.join('');
        const estimatedSize = (fullBase64.length * 3) / 4;
        if (estimatedSize > 10 * 1024 * 1024) {
          chunkStore.delete(userScopedUploadId);
          return res.status(400).json({ error: "File too large. Maximum size is 10MB." });
        }
        chunkStore.delete(userScopedUploadId);
        
        let promptText = "";
        let schema: any = {};
        
        if (type === "glucose") {
          promptText = GLUCOSE_PROMPT;
          schema = {
            type: Type.OBJECT,
            properties: {
              success: { type: Type.BOOLEAN },
              value: { type: Type.NUMBER },
              unit: { type: Type.STRING },
              readingDate: { type: Type.STRING },
              readingTime: { type: Type.STRING },
              errorMsg: { type: Type.STRING }
            },
            required: ["success"]
          };
        } else {
          promptText = LAB_REPORT_PROMPT;
          schema = LAB_REPORT_SCHEMA;
        }

        let response;
        let fileInfo = null;
        try {
          if (fullBase64.length > 2 * 1024 * 1024) { // Use File API for base64 > 2MB
            const tmpFilePath = path.join('/tmp', \`\${userScopedUploadId.replace(/[^a-zA-Z0-9_]/g, '')}.tmp\`);
            fs.writeFileSync(tmpFilePath, Buffer.from(fullBase64, 'base64'));
            try {
              fileInfo = await getAiClient().files.upload({ file: tmpFilePath, config: { mimeType: mimeType } });
            } finally {
              if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
            }
            response = await generateContentWithRetry({
              model: "gemini-3.6-flash",
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
              model: "gemini-3.6-flash",
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

const newUploadChunk = `      if (chunks.filter(Boolean).length === totalChunks) {
        let fullBase64 = chunks.join('');
        const estimatedSize = (fullBase64.length * 3) / 4;
        if (estimatedSize > 10 * 1024 * 1024) {
          chunkStore.delete(userScopedUploadId);
          return res.status(400).json({ error: "File too large. Maximum size is 10MB." });
        }
        chunkStore.delete(userScopedUploadId);
        
        let promptText = "";
        let schema: any = {};
        let modelToUse = "gemini-2.5-flash"; // Default to cheaper capable model
        
        if (type === "glucose") {
          promptText = GLUCOSE_PROMPT;
          modelToUse = "gemini-2.5-flash-8b"; // Route simple tasks to cheapest 8b model
          schema = {
            type: Type.OBJECT,
            properties: {
              success: { type: Type.BOOLEAN },
              value: { type: Type.NUMBER },
              unit: { type: Type.STRING },
              readingDate: { type: Type.STRING },
              readingTime: { type: Type.STRING },
              errorMsg: { type: Type.STRING }
            },
            required: ["success"]
          };
        } else {
          promptText = LAB_REPORT_PROMPT;
          schema = LAB_REPORT_SCHEMA;
        }

        let response;
        let fileInfo = null;
        try {
          let extractedText = null;
          let activeMimeType = mimeType;
          let activeBase64 = fullBase64;
          
          // Optimization 1: Extract Text Locally First for PDFs to avoid expensive multimodal tokens
          if (mimeType === 'application/pdf') {
            try {
              const pdfBuffer = Buffer.from(fullBase64, 'base64');
              const pdfData = await pdfParse(pdfBuffer);
              if (pdfData.text && pdfData.text.trim().length > 50) {
                extractedText = pdfData.text;
              }
            } catch (err) {
              console.error("Local PDF parsing failed, falling back to Gemini multimodal.", err);
            }
          }
          
          // Optimization 2: Aggressive Image Compression for images (downscale before sending)
          if (mimeType.startsWith('image/')) {
            try {
              const imageBuffer = Buffer.from(fullBase64, 'base64');
              const compressedBuffer = await sharp(imageBuffer)
                .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }) // Downscale to max 1024x1024
                .jpeg({ quality: 65 }) // Heavily compress
                .toBuffer();
              activeBase64 = compressedBuffer.toString('base64');
              activeMimeType = 'image/jpeg';
            } catch (err) {
              console.error("Local image compression failed, proceeding with original.", err);
            }
          }

          if (extractedText) {
            // We successfully extracted text, send text tokens (costs pennies) instead of PDF tokens
            response = await generateContentWithRetry({
              model: modelToUse,
              contents: [{
                parts: [
                  { text: promptText },
                  { text: "\\n--- DOCUMENT CONTENT ---\\n" + extractedText }
                ]
              }],
              config: {
                responseMimeType: "application/json",
                responseSchema: schema
              }
            });
          } else {
            // Fallback: send the optimized image or original PDF
            if (activeBase64.length > 2 * 1024 * 1024) { // Use File API for base64 > 2MB
              const tmpFilePath = path.join('/tmp', \`\${userScopedUploadId.replace(/[^a-zA-Z0-9_]/g, '')}.tmp\`);
              fs.writeFileSync(tmpFilePath, Buffer.from(activeBase64, 'base64'));
              try {
                fileInfo = await getAiClient().files.upload({ file: tmpFilePath, config: { mimeType: activeMimeType } });
              } finally {
                if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
              }
              response = await generateContentWithRetry({
                model: modelToUse,
                contents: [{
                  parts: [
                    { text: promptText },
                    { fileData: { fileUri: fileInfo.uri, mimeType: activeMimeType } }
                  ]
                }],
                config: {
                  responseMimeType: "application/json",
                  responseSchema: schema
                }
              });
            } else {
              response = await generateContentWithRetry({
                model: modelToUse,
                contents: [{
                  parts: [
                    { text: promptText },
                    { inlineData: { data: activeBase64, mimeType: activeMimeType } }
                  ]
                }],
                config: {
                  responseMimeType: "application/json",
                  responseSchema: schema
                }
              });
            }
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

code = code.replace(oldUploadChunkStart, newUploadChunk);

// 3. Update generate-insights to use a cheaper model too (gemini-2.5-flash-8b is perfect for insights)
code = code.replace(
  'const response = await generateContentWithRetry({\n        model: "gemini-3.6-flash",\n        contents: [{ role: "user", parts: [{ text: promptText }] }],',
  'const response = await generateContentWithRetry({\n        model: "gemini-2.5-flash-8b", // Route insights to cheaper 8b model\n        contents: [{ role: "user", parts: [{ text: promptText }] }],'
);

// 4. Remove unused routes (extract-glucose, extract-glucose-url, extract-lab-report, extract-lab-report-url)
// We will just do a regex replace to remove them if they exist (already removed? let's check)

const toRemove = [
  /app\.post\("\/api\/extract-glucose"[\s\S]*?(?=app\.post\("\/api\/extract-glucose-url")/g,
  /app\.post\("\/api\/extract-glucose-url"[\s\S]*?(?=app\.post\("\/api\/extract-lab-report")/g,
  /app\.post\("\/api\/extract-lab-report"[\s\S]*?(?=app\.post\("\/api\/extract-lab-report-url")/g,
  /app\.post\("\/api\/extract-lab-report-url"[\s\S]*?(?=const chunkStore)/g
];

toRemove.forEach(regex => {
  code = code.replace(regex, '');
});


fs.writeFileSync('server.ts', code);
console.log('Patched server.ts successfully.');
