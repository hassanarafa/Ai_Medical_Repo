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

// HELPER: Retry logic for 503 "Service Unavailable" errors
async function generateWithRetry(model, payload, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await model.generateContent(payload);
        } catch (error) {
            if (error.message.includes("503") && i < retries - 1) {
                console.log(`⚠️ AI Busy (Attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`);
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
        if (!file) return res.status(400).json({ error: "No image file provided" });

        const answers = JSON.parse(req.body.user_answers || "{}");
        const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);
        
        // Use 1.5-flash if 2.5-flash is experiencing high demand
        const model = ai.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
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
        });

        const imageBuffer = fs.readFileSync(file.path);
        const base64Image = imageBuffer.toString("base64");

        const payload = {
            contents: [{
                role: 'user',
                parts: [
                    { text: `Identify acne type. Patient Profile: ${answers.gender}, Age ${answers.age}. Check Clarino suitability.` },
                    { inlineData: { data: base64Image, mimeType: file.mimetype } }
                ]
            }]
        };

        // Execute AI request with Retry Logic
        const result = await generateWithRetry(model, payload);
        const diagnosisData = JSON.parse(result.response.text());

        // 📧 DYNAMIC EMAIL DELIVERY
        // Only triggers if user provided their Gmail + App Password in the frontend
        if (answers.senderEmail && answers.senderPass) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { 
                    user: answers.senderEmail, 
                    pass: answers.senderPass 
                }
            });

            const mailOptions = {
                from: answers.senderEmail,
                to: answers.recipientEmail || answers.senderEmail,
                subject: `Clarino AI: Skin Analysis Report`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #C2E5D3; border-radius: 12px; background-color: #F1F8F4;">
                        <h2 style="color: #2D5A43;">Skin Analysis Results</h2>
                        <p><strong>Diagnosis:</strong> ${diagnosisData.diagnosis}</p>
                        <p><strong>Suitability:</strong> ${diagnosisData.suitability}</p>
                        <hr style="border: 0; border-top: 1px solid #C2E5D3; margin: 20px 0;">
                        <p><strong>AI Reasoning:</strong> ${diagnosisData.reasoning}</p>
                        <p style="background: white; padding: 10px; border-radius: 8px;"><strong>Note:</strong> ${diagnosisData.clinical_note}</p>
                    </div>
                `
            };

            // Send mail in background
            transporter.sendMail(mailOptions)
                .then(() => console.log(`✅ Email sent to ${mailOptions.to}`))
                .catch(err => console.error("❌ Email Error:", err.message));
        }

        // Cleanup and respond
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        res.json(diagnosisData);

    } catch (error) {
        console.error("ANALYSIS FAILED:", error.message);
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        
        const status = error.message.includes("503") ? 503 : 500;
        res.status(status).json({ error: "The AI is currently busy. Please try again in a few moments." });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Medical AI Backend Active on Port ${PORT}`));