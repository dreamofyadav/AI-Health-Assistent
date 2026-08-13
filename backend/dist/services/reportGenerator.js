"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReport = generateReport;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY });
async function generateReport(history) {
    const transcript = history.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const prompt = `Analyze this medical intake conversation transcript and produce a structured JSON summary for a healthcare professional.
If the call was short or incomplete, capture whatever details were provided and set callCompleteness to 'Incomplete'.

Transcript:
${transcript}`;
    try {
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `You synthesize medical transcripts into JSON conforming strictly to this format:
{
  "patientName": string | null,
  "chiefComplaint": string,
  "duration": string | null,
  "severity": string | null,
  "associatedSymptoms": string[],
  "flaggedForFollowUp": string[],
  "callCompleteness": "Complete" | "Incomplete",
  "summaryNotes": string
}`
                },
                { role: 'user', content: prompt }
            ]
        });
        const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
        return {
            patientName: parsed.patientName || null,
            chiefComplaint: parsed.chiefComplaint || 'No specific complaint captured',
            duration: parsed.duration || null,
            severity: parsed.severity || null,
            associatedSymptoms: Array.isArray(parsed.associatedSymptoms) ? parsed.associatedSymptoms : [],
            flaggedForFollowUp: Array.isArray(parsed.flaggedForFollowUp) ? parsed.flaggedForFollowUp : [],
            callCompleteness: parsed.callCompleteness === 'Complete' ? 'Complete' : 'Incomplete',
            summaryNotes: parsed.summaryNotes || 'Limited interaction recorded.'
        };
    }
    catch (error) {
        console.error('Report Generation Error:', error);
        return {
            patientName: null,
            chiefComplaint: 'Error parsing interaction',
            duration: null,
            severity: null,
            associatedSymptoms: [],
            flaggedForFollowUp: ['Unable to complete automated report generation'],
            callCompleteness: 'Incomplete',
            summaryNotes: 'System error during report compilation.'
        };
    }
}
