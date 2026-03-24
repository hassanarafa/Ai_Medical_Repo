import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ 
    apiKey: "AIzaSyAIQEs3_bPQ_lcUX9Yv1xwvEwhN3ygokAU" 
});

// 🟢 Switch to memoryStorage (Faster on Vercel)
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const answers = JSON.parse(req.body.user_answers || "{}");
        const imageBase64 = req.file.buffer.toString("base64");

        const prompt = `
            Analyze this skin image for acne.
            Patient Profile: ${answers.gender}, Age ${answers.age}, Skin Type: ${answers.skinType}.
            Symptoms: Painful? ${answers.painful}, Contains Pus? ${answers.pus}, Redness? ${answers.redness}.
            History: Location: ${answers.location}, Allergy: ${answers.allergy}, Persistent? ${answers.longDuration}.
            Diet/Medical: Fast Food? ${answers.fastFood}, Pregnant? ${answers.pregnant}.

            1. Identify acne type (BLACKHEADS, WHITEHEADS, PAPULES, PUSTULES, CYSTS, NODULAR).
            2. Evaluate suitability of 'Clarino' (Basil, Tea Tree, Thyme, Lavender, Jojoba, Aloe).
            
            Return ONLY JSON: 
            {"diagnosis": "...", "suitability": "...", "reasoning": "...", "clinical_note": "..."}
        `;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{
                role: "user",
                parts: [
                    { text: prompt },
                    { inlineData: { data: imageBase64, mimeType: req.file.mimetype } }
                ]
            }],
            // 🟢 Forces Gemini to use more detail for small acne spots
            generationConfig: {
                media_resolution: "HIGH"
            }
        });

        const text = response.text.replace(/```json|```/g, "").trim();
        res.json(JSON.parse(text));

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

export default app;