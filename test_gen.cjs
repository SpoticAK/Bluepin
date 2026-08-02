const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res = await ai.models.generateContent({ model: "gemini-3.6-flash", contents: "Hello" });
    console.log("3.6 flash ok:", res.text.slice(0, 50));
  } catch (e) {
    console.error("3.6 err:", e.message);
  }
}
run();
