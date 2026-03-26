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
        const result = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: `Analyze this skin for acne. Profile: ${answers.gender}, Age ${answers.age}. Return ONLY JSON: {"diagnosis": "...", "suitability": "...", "reasoning": "...", "clinical_note": "..."}` },
                        { inlineData: { data: base64Image, mimeType: file.mimetype } }
                    ]
                }
            ]
        });

        fs.unlinkSync(file.path);
        
        // The result structure in the new SDK
        const text = result.response.text().replace(/```json|```/g, "").trim();
        res.json(JSON.parse(text));

    } catch (error) {
        console.error("AI Error:", error.message);
        if (req.files) req.files.forEach(f => { if(fs.existsSync(f.path)) fs.unlinkSync(f.path) });
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server ready on port ${PORT}`));