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

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const answers = JSON.parse(req.body.user_answers || "{}");
        const imageBuffer = fs.readFileSync(file.path);
        const base64Image = imageBuffer.toString("base64");

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            // ✅ THE FIX: Force Structured JSON Output
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'object',
                    properties: {
                        diagnosis: { type: 'string' },
                        suitability: { type: 'string' },
                        reasoning: { type: 'string' },
                        clinical_note: { type: 'string' }
                    },
                    required: ['diagnosis', 'suitability', 'reasoning', 'clinical_note']
                }
            },
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: `Analyze this skin for acne. Profile: ${answers.gender}, Age ${answers.age}.` },
                        { inlineData: { data: base64Image, mimeType: file.mimetype } }
                    ]
                }
            ]
        });

        // Clean up the file immediately after sending to AI
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

        if (!result || !result.text) {
            return res.status(500).json({ error: "AI returned an empty response." });
        }

        // With 'responseMimeType', result.text is already a clean JSON string
        res.json(JSON.parse(result.text));

    } catch (error) {
        console.error("AI Error:", error.message);
        if (req.files) req.files.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path) });
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server ready on port ${PORT}`));