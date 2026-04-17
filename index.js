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

async function generateWithRetry(ai, config, contents, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await ai.models.generateContent({
                ...config,
                contents: contents
            });
        } catch (error) {
            // Retry on 503 (Overload) or 429 (Rate Limit)
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
        
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const config = {
            model: 'gemini-3.1-flash-preview', 
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
                { text: `Diagnose acne for ${answers.age}yo ${answers.gender}. Determine Clarino suitability.` },
                { inlineData: { data: base64Image, mimeType: file.mimetype } }
            ]
        }];

        const diagnosisData = await generateWithRetry(ai, config, contents);
        if (answers.senderEmail && answers.senderPass) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: answers.senderEmail, pass: answers.senderPass }
            });

            const mailOptions = {
                from: answers.senderEmail,
                to: answers.recipientEmail || answers.senderEmail,
                subject: `Clarino AI: Your Skin Analysis Report`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #C2E5D3; border-radius: 12px; background-color: #F1F8F4;">
                        <h2 style="color: #2D5A43;">Skin Analysis Results</h2>
                        <p><strong>Diagnosis:</strong> ${diagnosisData.diagnosis}</p>
                        <p><strong>Suitability:</strong> ${diagnosisData.suitability}</p>
                        <p><strong>Reasoning:</strong> ${diagnosisData.reasoning}</p>
                    </div>`
            };
            transporter.sendMail(mailOptions).catch(err => console.error("❌ Email Error:", err.message));
        }

        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        res.json(diagnosisData);

    } catch (error) {
        console.error("ANALYSIS FAILED:", error.message);
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        res.status(500).json({ error: "Analysis failed. Please try again." });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Clarino AI Backend Active on ${PORT}`));