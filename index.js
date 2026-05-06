import express from 'express';
import multer from 'multer';
import { GoogleGenAI, SchemaType } from '@google/genai'; // Added SchemaType for safety
import fs from 'fs';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: '/tmp/' });

// 1. Initialize GenAI once outside the route
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

app.post('/analyze', upload.any(), async (req, res) => {
    let filePath = '';
    try {
        const file = req.files?.find(f => f.fieldname === 'image');
        if (!file) return res.status(400).json({ error: "No image file provided" });
        filePath = file.path;

        // 2. Get the specific model instance correctly
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                // Use the correct schema definition for the SDK
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        diagnosis: { type: SchemaType.STRING },
                        suitability: { type: SchemaType.STRING },
                        reasoning: { type: SchemaType.STRING },
                        clinical_note: { type: SchemaType.STRING }
                    },
                    required: ["diagnosis", "suitability", "reasoning", "clinical_note"],
                },
            }
        });

        const answers = JSON.parse(req.body.user_answers || "{}");
        const imageBuffer = fs.readFileSync(filePath);
        const base64Image = imageBuffer.toString("base64");

        // 3. Call generateContent on the model instance
        const result = await model.generateContent([
            {
                text: `Identify the type of acne in this image. 
                       Patient Profile: ${answers.gender}, Age ${answers.age}. 
                       Determine if 'Clarino' treatment is safe and effective.`
            },
            {
                inlineData: {
                    data: base64Image,
                    mimeType: file.mimetype
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();

        // 4. Cleanup and Respond
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json(JSON.parse(text));

    } catch (error) {
        console.error("ANALYSIS FAILED:", error);
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ error: "Analysis failed", details: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server on Port ${PORT}`));