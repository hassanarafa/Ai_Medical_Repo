import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Log to help us see the start
console.log("Checking API Key...", process.env.GEMINI_API_KEY ? "Key Found" : "Key MISSING");

// ✅ CORRECT INITIALIZATION FOR 2026 SDK
const genAI = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY 
});
// Use /tmp/ for Railway's file system
const upload = multer({ dest: '/tmp/' });

app.get('/', (req, res) => res.send('🚀 Acne AI Backend is LIVE!'));

// Use upload.any() temporarily to solve the 'Unexpected Field' error
app.post('/analyze', upload.any(), async (req, res) => {
    try {
        // Find the image in the uploaded files
        const file = req.files.find(f => f.fieldname === 'image');
        if (!file) return res.status(400).json({ error: "No image file found in 'image' field" });

        // ✅ FIXED AI CALL
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const answers = JSON.parse(req.body.user_answers || "{}");
        const imageBuffer = fs.readFileSync(file.path);
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
            { inlineData: { data: imageBase64, mimeType: file.mimetype } }
        ]);

        const response = await result.response;
        const text = response.text().replace(/```json|```/g, "").trim();

        // Clean up
        fs.unlinkSync(file.path);
        
        res.json(JSON.parse(text));

    } catch (error) {
        console.error("CRITICAL ERROR:", error.message);
        // Clean up if error occurs
        if (req.files) req.files.forEach(f => fs.unlinkSync(f.path));
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});