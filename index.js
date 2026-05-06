import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: '/tmp/' });
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

app.post('/analyze', upload.any(), async (req, res) => {
    let filePath = '';
    try {
        const file = req.files?.find(f => f.fieldname === 'image');
        if (!file) return res.status(400).json({ error: "No image file provided" });
        filePath = file.path;

        // Use the stable model name
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash", 
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "object",
                    properties: {
                        diagnosis: { type: "string" },
                        suitability: { type: "string" },
                        reasoning: { type: "string" },
                        clinical_note: { type: "string" }
                    },
                    required: ["diagnosis", "suitability", "reasoning", "clinical_note"]
                }
            }
        });

        const answers = JSON.parse(req.body.user_answers || "{}");
        const imageBuffer = fs.readFileSync(filePath);

        const result = await model.generateContent([
            { text: `Analyze acne for: ${answers.gender}, Age ${answers.age}. Assess 'Clarino' treatment.` },
            { inlineData: { data: imageBuffer.toString("base64"), mimeType: file.mimetype } }
        ]);

        const response = await result.response;
        res.json(JSON.parse(response.text()));

    } catch (error) {
        // SPECIFIC LOGIC FOR RATE LIMITS
        if (error.message?.includes('429') || error.status === 429) {
            console.error("RATE LIMIT HIT: Too many requests.");
            return res.status(429).json({ 
                error: "The AI is currently busy. Please wait about 30 seconds and try again.",
                retryAfter: "30s"
            });
        }

        console.error("ANALYSIS FAILED:", error.message);
        res.status(500).json({ error: "Server failed to process analysis." });
    } finally {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Backend Active on Port ${PORT}`));