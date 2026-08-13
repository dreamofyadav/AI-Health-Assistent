"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNextAIResponse = getNextAIResponse;
var groq_sdk_1 = require("groq-sdk");
var groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY });
/**
 * Handles LLM turn-taking using Groq's fast Llama 3.3 model (Free Tier)
 */
function getNextAIResponse(history) {
    return __awaiter(this, void 0, void 0, function () {
        var systemPrompt, response, error_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    systemPrompt = {
                        role: 'system',
                        content: "You are an empathetic medical intake voice assistant conducting a health screening call.\nYour goal is to politely gather:\n1. Patient's Name\n2. Main concern or chief symptom\n3. Duration (how long it has been going on)\n4. Severity scale (1-10) or description\n5. Related/Associated symptoms\n\nRULES:\n- Ask ONLY ONE concise question per response.\n- Adapt to the user's language automatically (respond in Hindi if they speak Hindi, English if they speak English).\n- If an answer is unclear, ask a brief follow-up before moving on.\n- Keep responses short (1-2 sentences) so they convert well to spoken speech.\n- Never give a medical diagnosis or medical advice."
                    };
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, groq.chat.completions.create({
                            model: 'llama-3.3-70b-versatile',
                            messages: __spreadArray([systemPrompt], history, true),
                            temperature: 0.6,
                            max_tokens: 150,
                        })];
                case 2:
                    response = _c.sent();
                    return [2 /*return*/, ((_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || "Could you please tell me a bit more about how you're feeling?"];
                case 3:
                    error_1 = _c.sent();
                    console.error('Groq LLM Error:', error_1);
                    return [2 /*return*/, "I missed that. Could you please repeat what you said?"];
                case 4: return [2 /*return*/];
            }
        });
    });
}
