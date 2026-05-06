import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// 1. Unified SDK requires an object with apiKey
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No image" });

        // 2. Call generateContent directly from the client.models object
        const result = await client.models.generateContent({
            model: "gemini-1.5-flash",
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: "Identify the acne type and treatment suitability." },
                        {
                            inlineData: {
                                data: req.file.buffer.toString("base64"),
                                mimeType: req.file.mimetype
                            }
                        }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json"
            }
        });

        // 3. result.text is a direct string in the Unified SDK
        res.json(JSON.parse(result.text));

    } catch (error) {
        // Handle the specific Quota/Rate Limit error gracefully
        if (error.message?.includes('429')) {
            return res.status(429).json({ error: "Rate limit exceeded. Please wait a moment." });
        }
        
        console.error("CRITICAL ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));