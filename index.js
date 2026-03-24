import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Pulling from Render Environment Variables
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

const upload = multer({ storage: multer.memoryStorage() });

app.get('/', (req, res) => res.send('🚀 Acne AI Backend is LIVE on Render!'));

app.post('/api/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No image uploaded" });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Stable 2026 model
        const imageBase64 = req.file.buffer.toString("base64");
        const answers = JSON.parse(req.body.user_answers || "{}");

        const prompt = `
            Analyze this skin image for acne.
            Profile: ${answers.gender}, Age ${answers.age}, Skin Type: ${answers.skinType}.
            Symptoms: Painful? ${answers.painful}, Pus? ${answers.pus}, Redness? ${answers.redness}.
            1. Identify acne type.
            2. Evaluate suitability of 'Clarino' (Basil, Tea Tree, Thyme, Lavender).
            Return ONLY JSON: 
            {"diagnosis": "...", "suitability": "...", "reasoning": "...", "clinical_note": "..."}
        `;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: imageBase64, mimeType: req.file.mimetype } }
        ]);

        const response = await result.response;
        const rawText = response.text();
        
        // Safety: Extract JSON even if AI adds extra text
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            res.json(JSON.parse(jsonMatch[0]));
        } else {
            res.status(500).json({ error: "AI returned invalid format", raw: rawText });
        }

    } catch (error) {
        console.error("AI Error:", error.message);
        res.status(500).json({ error: "AI Analysis failed." });
    }
});

// --- RENDER SPECIFIC: The Listener ---
const PORT = process.env.PORT || 10000; 
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});