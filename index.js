import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: '/tmp/' });

app.post('/analyze', upload.any(), async (req, res) => {
    try {
        const file = req.files?.find(f => f.fieldname === 'image');
        if (!file) return res.status(400).json({ error: "No image file" });

        // The new SDK uses a Client-style initialization
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const answers = JSON.parse(req.body.user_answers || "{}");
        const imageBuffer = fs.readFileSync(file.path);
        const base64Image = imageBuffer.toString("base64");

        // New 2026 SDK "models.generateContent" syntax
        // ... inside your app.post('/analyze') ...

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: `Analyze this skin for acne...` },
                        { inlineData: { data: base64Image, mimeType: file.mimetype } }
                    ]
                }
            ]
        });

        // ✅ 2026 SDK FIXED PARSING
        if (!result || !result.text) {
            // This happens if the AI blocks the content for safety (e.g., sensitive body parts)
            console.error("AI returned an empty response. Check safety settings.");
            return res.status(500).json({ error: "AI could not generate a response for this image." });
        }

        // Clean up the file
        fs.unlinkSync(file.path);

        // In the new SDK, 'result.text' is a direct string
        const text = result.text.replace(/```json|```/g, "").trim();
        res.json(JSON.parse(text));

    } catch (error) {
        console.error("AI Error:", error.message);
        if (req.files) req.files.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path) });
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server ready on port ${PORT}`));