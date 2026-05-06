import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// The Unified SDK uses an options object
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No image" });

        // Direct call to models.generateContent
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
            config: { responseMimeType: "application/json" }
        });

        res.json(JSON.parse(result.text));
    } catch (error) {
        console.error("ANALYSIS ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server active on ${PORT}`));