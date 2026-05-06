import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// 1. Use Memory Storage to avoid Railway "WriteStream" disk errors
const upload = multer({ storage: multer.memoryStorage() });

// 2. NEW SDK INITIALIZATION: Use an options object
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image file provided" });
        }

        // Parse patient data from the request body
        const answers = JSON.parse(req.body.user_answers || "{}");

        // 3. UNIFIED SDK METHOD: client.models.generateContent
        const response = await client.models.generateContent({
            model: 'gemini-3-flash-preview', // The 2026 stable-preview model
            contents: [
                {
                    role: 'user',
                    parts: [
                        { 
                            text: `Identify the type of acne. 
                                   Patient Profile: ${answers.gender}, Age: ${answers.age}. 
                                   Determine if 'Clarino' treatment is safe and effective.` 
                        },
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
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'object',
                    properties: {
                        diagnosis: { type: 'string' },
                        suitability: { type: 'string' },
                        reasoning: { type: 'string' },
                        clinical_note: { type: 'string' }
                    },
                    required: ['diagnosis', 'suitability', 'reasoning', 'clinical_note']
                }
            }
        });

        // 4. NEW SDK OUTPUT: The text is directly on the response object
        // No need to call .response.text()
        res.json(JSON.parse(response.text));

    } catch (error) {
        // Handle the common 429 Quota error gracefully
        if (error.message?.includes('429')) {
            console.error("RATE LIMIT EXCEEDED");
            return res.status(429).json({ error: "Model is busy. Please wait 1 minute." });
        }

        console.error("CRITICAL ERROR:", error);
        res.status(500).json({ error: "Analysis failed", details: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Unified AI Backend Active on Port ${PORT}`));