import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Initialize Gemini (Make sure GEMINI_API_KEY is in Vercel Settings)
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

// Vercel works best with memoryStorage for small/medium files
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 } // 4MB limit (Vercel's max is 4.5MB)
});

app.get('/', (req, res) => res.send('Acne AI Backend is Online 🚀'));

app.post('/api/analyze', upload.single('image'), async (req, res) => {
    try {
        // 1. Validation
        if (!req.file) return res.status(400).json({ error: "No image uploaded" });

        // 2. Prepare AI
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash" });
        const imageBase64 = req.file.buffer.toString("base64");
        
        // Parse answers safely
        let answers = {};
        try {
            answers = JSON.parse(req.body.user_answers || "{}");
        } catch (e) {
            console.warn("Could not parse user_answers, using defaults.");
        }

        const prompt = `
            Analyze this skin image for acne.
            Profile: ${answers.gender || 'Unknown'}, Age ${answers.age || 'Unknown'}.
            Symptoms: Painful? ${answers.painful || 'N/A'}, Pus? ${answers.pus || 'N/A'}.
            Return ONLY JSON: 
            {"diagnosis": "...", "suitability": "...", "reasoning": "...", "clinical_note": "..."}
        `;

        // 3. AI Execution
        const result = await model.generateContent([
            prompt,
            { inlineData: { data: imageBase64, mimeType: req.file.mimetype } }
        ]);

        const response = await result.response;
        const text = response.text().replace(/```json|```/g, "").trim();
        
        // 4. Send Response
        res.json(JSON.parse(text));

    } catch (error) {
        console.error("Vercel AI Error:", error.message);
        res.status(500).json({ error: "AI Analysis failed. Check Vercel logs for details." });
    }
});

export default app;