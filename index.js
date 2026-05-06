import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// 1. Memory storage is safer for Railway (avoids WriteStream errors)
const upload = multer({ storage: multer.memoryStorage() });

// 2. Initialize with an options object (Required for @google/genai)
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image file provided" });
        }

        const answers = JSON.parse(req.body.user_answers || "{}");

        // 3. Use Unified SDK syntax: client.models.generateContent
        const result = await client.models.generateContent({
            model: 'gemini-3-flash', // Latest stable 2026 model
            contents: [
                {
                    role: 'user',
                    parts: [
                        { 
                            text: `Identify the type of acne. 
                                   Patient: ${answers.gender || 'Unknown'}, Age: ${answers.age || 'Unknown'}. 
                                   Assess if 'Clarino' treatment is safe and effective.` 
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

        // 4. Access result.text directly (No .response.text() needed)
        res.json(JSON.parse(result.text));

    } catch (error) {
        // Handle Rate Limits (429) specifically
        if (error.message?.includes('429')) {
            console.error("RATE LIMIT HIT");
            return res.status(429).json({ error: "High demand. Please wait 60 seconds." });
        }

        console.error("ANALYSIS FAILED:", error);
        res.status(500).json({ error: "Server failed to process image." });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Backend active on port ${PORT}`));