import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai'; 
import fs from 'fs';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: '/tmp/' });

app.get('/', (req, res) => res.send('🚀 Backend is Online'));

app.post('/analyze', upload.any(), async (req, res) => {
    try {
        const file = req.files?.find(f => f.fieldname === 'image');
        if (!file) return res.status(400).json({ error: "No image file" });

        // ✅ DEFENSIVE INITIALIZATION
        if (!process.env.GEMINI_API_KEY) throw new Error("Missing API Key");
        
        const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);
        // Sometimes the SDK requires calling the model differently in ESM:
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const answers = JSON.parse(req.body.user_answers || "{}");
        const imageBuffer = fs.readFileSync(file.path);
        
        const result = await model.generateContent([
            `Analyze this skin for acne. Patient: ${answers.age}, ${answers.gender}. 
             Return ONLY JSON: {"diagnosis": "...", "suitability": "...", "reasoning": "...", "clinical_note": "..."}`,
            { inlineData: { data: imageBuffer.toString("base64"), mimeType: file.mimetype } }
        ]);

        const response = await result.response;
        const text = response.text().replace(/```json|```/g, "").trim();

        fs.unlinkSync(file.path);
        res.json(JSON.parse(text));

    } catch (error) {
        console.error("LOG:", error.message);
        if (req.files) req.files.forEach(f => fs.unlinkSync(f.path));
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Listening on ${PORT}`));