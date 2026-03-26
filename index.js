import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Add this log to debug in Railway
console.log("Checking API Key...", process.env.GEMINI_API_KEY ? "Key Found" : "Key MISSING");

if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not defined in Environment Variables");
}

const genAI = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY 
});
// ✅ CLOUD FRIENDLY: Use memory storage or the /tmp directory
const upload = multer({ dest: '/tmp/' });

app.get('/', (req, res) => res.send('🚂 Railway Backend is Running!'));

app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const answers = JSON.parse(req.body.user_answers || "{}");
        const imageBuffer = fs.readFileSync(req.file.path);
        const imageBase64 = imageBuffer.toString("base64");

        const prompt = `
            Analyze this skin image for acne.
            Profile: ${answers.gender}, Age ${answers.age}, Skin Type: ${answers.skinType}.
            1. Identify acne type.
            2. Evaluate suitability of 'Clarino'.
            Return ONLY JSON: 
            {"diagnosis": "...", "suitability": "...", "reasoning": "...", "clinical_note": "..."}
        `;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: imageBase64, mimeType: req.file.mimetype } }
        ]);

        const response = await result.response;
        const text = response.text().replace(/```json|```/g, "").trim();

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        
        res.json(JSON.parse(text));

    } catch (error) {
        console.error(error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: error.message });
    }
});

// ✅ RAILWAY REQUIREMENT: Use process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});