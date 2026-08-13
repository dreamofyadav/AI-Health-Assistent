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
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var http_1 = require("http");
var ws_1 = require("ws");
var dotenv_1 = require("dotenv");
var cors_1 = require("cors");
var aiPipeline_1 = require("./services/aiPipeline");
var reportGenerator_1 = require("./services/reportGenerator");
dotenv_1.default.config();
var app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
var server = http_1.default.createServer(app);
var wss = new ws_1.WebSocketServer({ server: server });
var activeSessions = new Map();
wss.on('connection', function (ws) {
    console.log('Client connected');
    ws.on('message', function (data) { return __awaiter(void 0, void 0, void 0, function () {
        var payload, session, initialGreeting, session, userText, aiResponse, session, report, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    payload = JSON.parse(data.toString());
                    if (payload.type === 'START_CALL') {
                        session = {
                            id: Date.now().toString(),
                            history: [],
                            status: 'active',
                            startedAt: new Date()
                        };
                        activeSessions.set(ws, session);
                        initialGreeting = "Hello! I'm your health intake assistant. May I start with your full name and what brings you in today?";
                        session.history.push({ role: 'assistant', content: initialGreeting });
                        ws.send(JSON.stringify({
                            type: 'AI_RESPONSE',
                            text: initialGreeting
                        }));
                    }
                    if (!(payload.type === 'USER_SPEECH')) return [3 /*break*/, 2];
                    session = activeSessions.get(ws);
                    if (!session || session.status !== 'active')
                        return [2 /*return*/];
                    userText = payload.text;
                    if (!(userText === null || userText === void 0 ? void 0 : userText.trim()))
                        return [2 /*return*/];
                    session.history.push({ role: 'user', content: userText });
                    return [4 /*yield*/, (0, aiPipeline_1.getNextAIResponse)(session.history)];
                case 1:
                    aiResponse = _a.sent();
                    session.history.push({ role: 'assistant', content: aiResponse });
                    ws.send(JSON.stringify({
                        type: 'AI_RESPONSE',
                        text: aiResponse
                    }));
                    _a.label = 2;
                case 2:
                    if (!(payload.type === 'END_CALL')) return [3 /*break*/, 4];
                    session = activeSessions.get(ws);
                    if (!session) return [3 /*break*/, 4];
                    session.status = 'ended';
                    return [4 /*yield*/, (0, reportGenerator_1.generateReport)(session.history)];
                case 3:
                    report = _a.sent();
                    ws.send(JSON.stringify({ type: 'REPORT_READY', report: report }));
                    activeSessions.delete(ws);
                    _a.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    err_1 = _a.sent();
                    console.error('Socket error:', err_1);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); });
    ws.on('close', function () {
        activeSessions.delete(ws);
    });
});
var PORT = process.env.PORT || 8080;
server.listen(PORT, function () {
    console.log("Server running on http://localhost:".concat(PORT));
});
