import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Set up temporary storage for Railway
const upload = multer({ dest: '/tmp/' });

app.post('/analyze', upload.any(), async (req, res) => {
    try {
        // 1. Validate Input
        const file = req.files?.find(f => f.fieldname === 'image');
        if (!file) return res.status(400).json({ error: "No image file provided" });

        // 2. Initialize AI Client
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // 3. Prepare Data
        const answers = JSON.parse(req.body.user_answers || "{}");
        const imageBuffer = fs.readFileSync(file.path);
        const base64Image = imageBuffer.toString("base64");

        // 4. Request Structured Analysis
        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            config: {
                // FORCE JSON FORMAT
                responseMimeType: 'application/json',
                // DEFINE THE STRUCTURE BLUEPRINT
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
            },
            contents: [
                {
                    role: 'user',
                    parts: [
                        { 
                            text: `Identify the type of acne in this image. 
                                   Patient Profile: ${answers.gender}, Age ${answers.age}. 
                                   Determine if 'Clarino' treatment is safe and effective for this specific case.` 
                        },
                        { 
                            inlineData: { 
                                data: base64Image, 
                                mimeType: file.mimetype 
                            } 
                        }
                    ]
                }
            ]
        });

        // 5. Ephemeral Cleanup (Delete file immediately after AI receives it)
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

        // 6. Final Output Check
        if (!result || !result.text) {
            throw new Error("AI failed to generate a diagnostic text response.");
        }

        // result.text is now a clean JSON string, no cleaning/regex needed!
        res.json(JSON.parse(result.text));

    } catch (error) {
        console.error("ANALYSIS FAILED:", error.message);
        
        // Ensure cleanup if process failed mid-way
        if (req.files) {
            req.files.forEach(f => {
                if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
            });
        }
        
        res.status(500).json({ error: "Server failed to process image analysis." });
    }
});

// Use Railway's dynamic port
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Medical AI Backend Active on Port ${PORT}`));