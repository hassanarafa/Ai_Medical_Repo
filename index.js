import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai'; // Ensure this is '@google/genai'
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// 1. Correct Initialization for @google/genai
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No image provided" });

        // 2. Correct Method Call for this SDK version
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash", // Specify model here
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

        // 3. Directly access the text (the new SDK simplifies this)
        res.json(JSON.parse(response.text));

    } catch (error) {
        console.error("CRITICAL ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));