import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import cors from 'cors';
import nodemailer from 'nodemailer';

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: '/tmp/' });

// ✅ REWRITTEN HELPER: Using the 2026 SDK accessor
async function generateWithRetry(ai, config, contents, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            // In @google/genai, models are properties of the ai instance
            return await ai.models.generateContent({
                ...config,
                contents: contents
            });
        } catch (error) {
            // Retry on Overload (503) or Rate Limit (429)
            if ((error.message.includes("503") || error.message.includes("429")) && i < retries - 1) {
                console.log(`⚠️ AI Busy (Attempt ${i + 1}/${retries}). Retrying...`);
                await new Promise(res => setTimeout(res, delay));
                delay *= 2; 
                continue;
            }
            throw error;
        }
    }
}

app.post('/analyze', upload.any(), async (req, res) => {
    let file = null;
    try {
        file = req.files?.find(f => f.fieldname === 'image');
        if (!file) return res.status(400).json({ error: "No image provided" });

        const answers = JSON.parse(req.body.user_answers || "{}");
        
        // 1. Initialize Client
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        // 2. Updated Configuration (Gemini 2.0 Flash is the 2026 stable choice)
        const config = {
            model: 'gemini-1.5-flash-8b', 
            generationConfig: {
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
        };

        const imageBuffer = fs.readFileSync(file.path);
        const base64Image = imageBuffer.toString("base64");

        const contents = [{
            role: 'user',
            parts: [
                { text: `Identify acne type for ${answers.age}yo ${answers.gender}. Determine Clarino suitability.` },
                { inlineData: { data: base64Image, mimeType: file.mimetype } }
            ]
        }];

        // 3. Execute Analysis
        // Result is the parsed JSON object directly in this SDK
        const diagnosisData = await generateWithRetry(ai, config, contents);

        // 4. Send Email (Recipient from Frontend)
        if (answers.senderEmail && answers.senderPass) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: answers.senderEmail, pass: answers.senderPass }
            });

            const mailOptions = {
                from: answers.senderEmail,
                to: answers.recipientEmail || answers.senderEmail,
                subject: `Clarino AI Report`,
                html: `<h3>Diagnosis: ${diagnosisData.diagnosis}</h3><p>${diagnosisData.reasoning}</p>`
            };
            transporter.sendMail(mailOptions).catch(err => console.error("Email failed:", err.message));
        }

        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        res.json(diagnosisData);

    } catch (error) {
        console.error("ANALYSIS FAILED:", error.message);
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        
        // Map common errors to user-friendly messages
        const status = error.message.includes("404") ? 404 : 503;
        res.status(status).json({ error: "System update in progress or high demand. Please try again." });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Clarino AI Backend Active on ${PORT}`));