import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// CORRECT INITIALIZATION: Pass the string directly, not an object
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No image" });

        // Get model from the genAI instance
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash", // or "gemini-2.0-flash" if available in your region
            generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent([
            { text: "Identify the acne type and treatment suitability." },
            { 
                inlineData: { 
                    data: req.file.buffer.toString("base64"), 
                    mimeType: req.file.mimetype 
                } 
            }
        ]);

        const response = await result.response;
        res.json(JSON.parse(response.text()));

    } catch (error) {
        console.error("CRITICAL ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(8080, () => console.log("🚀 Server running"));