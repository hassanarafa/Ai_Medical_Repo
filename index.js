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

// ✅ HELPER: Corrected parameters to handle the payload properly
async function generateWithRetry(model, payload, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            // Note: contents must be passed directly in the latest SDK version
            return await model.generateContent(payload);
        } catch (error) {
            if (error.message.includes("503") && i < retries - 1) {
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
        if (!file) return res.status(400).json({ error: "No image file provided" });

        const answers = JSON.parse(req.body.user_answers || "{}");
        
        // ✅ 1. Initialize with the API Key
        const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);
        
        // ✅ 2. Get the model instance
        const model = genAI.getGenerativeModel({ 
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

        // ✅ 3. Corrected Payload Structure
        const payload = {
            contents: [{
                role: 'user',
                parts: [
                    { text: `Identify acne type. Patient Profile: ${answers.gender}, Age ${answers.age}. Check Clarino suitability.` },
                    { inlineData: { data: base64Image, mimeType: file.mimetype } }
                ]
            }]
        };

        // 4. Execute
        const result = await generateWithRetry(model, payload);
        const diagnosisData = JSON.parse(result.response.text());

        // 📧 DYNAMIC EMAIL DELIVERY (Remains the same)
        if (answers.senderEmail && answers.senderPass) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: answers.senderEmail, pass: answers.senderPass }
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

            transporter.sendMail(mailOptions).catch(err => console.error("❌ Email Error:", err.message));
        }

        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        res.json(diagnosisData);

    } catch (error) {
        console.error("ANALYSIS FAILED:", error.message);
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        const status = error.message.includes("503") ? 503 : 500;
        res.status(status).json({ error: "Service unavailable or overloaded. Try again." });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Backend running on ${PORT}`));