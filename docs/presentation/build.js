const pptxgen = require("pptxgenjs");

// ── Palette: Midnight Executive + flow accents ──
const NAVY = "1E2761";      // primary
const NAVY2 = "2D3A7C";     // lighter navy
const ICE = "CADCFC";       // secondary
const WHITE = "FFFFFF";
const INK = "0F172A";       // near-black text
const MUTE = "64748B";      // muted
const LIGHT = "F1F5F9";     // light panel
const TEAL = "0F766E";      // fixed flow
const BLUE = "2563EB";      // bpmn simple
const AMBER = "B45309";     // bpmn advanced
const GREEN = "047857";
const RED = "B91C1C";

const HEAD = "Tahoma";
const BODY = "Tahoma";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
pres.author = "BPMN POC";
pres.title = "BPMN Engine — ระบบอนุมัติบัตรเครดิต";

const W = 13.3, H = 7.5;

// helpers
const shadow = () => ({ type: "outer", color: "000000", blur: 8, offset: 3, angle: 135, opacity: 0.18 });

function pageNum(slide, n) {
  slide.addText(String(n).padStart(2, "0"), { x: W - 0.9, y: H - 0.55, w: 0.6, h: 0.35, fontFace: BODY, fontSize: 11, color: MUTE, align: "right" });
}

function kicker(slide, text, color) {
  slide.addText(text.toUpperCase(), { x: 0.7, y: 0.55, w: 8, h: 0.35, fontFace: HEAD, fontSize: 13, bold: true, color: color || BLUE, charSpacing: 3 });
}

function title(slide, text, color) {
  slide.addText(text, { x: 0.7, y: 0.95, w: 11.9, h: 0.9, fontFace: HEAD, fontSize: 30, bold: true, color: color || INK });
}

function chip(slide, x, y, w, label, color) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.4, fill: { color: color }, rectRadius: 0.2 });
  slide.addText(label, { x, y, w, h: 0.4, fontFace: HEAD, fontSize: 12, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });
}

function card(slide, x, y, w, h, fill) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: fill || WHITE }, line: { color: "E2E8F0", width: 1 }, shadow: shadow() });
}

// ════════════════════════════════════════════════════════════
// Slide 1 — Title
// ════════════════════════════════════════════════════════════
let s = pres.addSlide();
s.background = { color: NAVY };
// decorative big circles
s.addShape(pres.shapes.OVAL, { x: 10.2, y: -1.8, w: 5, h: 5, fill: { color: NAVY2 } });
s.addShape(pres.shapes.OVAL, { x: 11.6, y: 4.5, w: 3.2, h: 3.2, fill: { color: NAVY2 } });
s.addText("BPMN ENGINE POC", { x: 0.9, y: 1.5, w: 10, h: 0.4, fontFace: HEAD, fontSize: 15, bold: true, color: ICE, charSpacing: 4 });
s.addText("ระบบอนุมัติบัตรเครดิต", { x: 0.85, y: 2.05, w: 11.5, h: 1.1, fontFace: HEAD, fontSize: 46, bold: true, color: WHITE });
s.addText("BPMN engine เข้ามาแทน logic ที่ hardcode ได้อย่างไร", { x: 0.9, y: 3.25, w: 11, h: 0.6, fontFace: BODY, fontSize: 20, color: ICE });
// flow chips
chip(s, 0.9, 4.4, 2.7, "Fixed Flow (Hardcode)", TEAL);
chip(s, 3.8, 4.4, 2.7, "BPMN Simple", BLUE);
chip(s, 6.7, 4.4, 2.7, "BPMN Advanced", AMBER);
s.addShape(pres.shapes.LINE, { x: 0.9, y: 5.4, w: 4.5, h: 0, line: { color: ICE, width: 2 } });
s.addText("Flowable engine  ·  Express API  ·  React + Vite", { x: 0.9, y: 5.6, w: 11, h: 0.5, fontFace: BODY, fontSize: 14, color: ICE });

// ════════════════════════════════════════════════════════════
// Slide 2 — ปัญหา
// ════════════════════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHITE };
kicker(s, "ปัญหา", RED);
title(s, "logic ของ workflow ฝังอยู่ใน code");
s.addText("เมื่อ business rule เปลี่ยน ต้องแก้โค้ด deploy ใหม่ทุกครั้ง", { x: 0.7, y: 1.75, w: 11.5, h: 0.5, fontFace: BODY, fontSize: 16, color: MUTE });

const pains = [
  ["if-else กระจายในไฟล์", "เกณฑ์อนุมัติ, ลำดับ approver ปนกับโค้ดระบบ"],
  ["เปลี่ยนเกณฑ์ = แก้ code", "ทุกการแก้ต้อง dev + test + deploy ใหม่"],
  ["มองภาพ flow ไม่ออก", "business user อ่าน flow จากโค้ดไม่ได้"],
  ["reuse ยาก", "logic ผูกกับ service เดียว เอาไปใช้ต่อไม่ได้"],
];
let px = 0.7, pw = 2.9, gap = 0.13;
pains.forEach((p, i) => {
  const x = px + i * (pw + gap);
  card(s, x, 2.5, pw, 2.9, WHITE);
  s.addShape(pres.shapes.RECTANGLE, { x, y: 2.5, w: pw, h: 0.09, fill: { color: RED } });
  s.addText(String(i + 1), { x: x + 0.25, y: 2.75, w: 0.7, h: 0.7, fontFace: HEAD, fontSize: 30, bold: true, color: RED });
  s.addText(p[0], { x: x + 0.25, y: 3.55, w: pw - 0.5, h: 0.7, fontFace: HEAD, fontSize: 16, bold: true, color: INK });
  s.addText(p[1], { x: x + 0.25, y: 4.25, w: pw - 0.5, h: 1.0, fontFace: BODY, fontSize: 13, color: MUTE });
});
pageNum(s, 2);

// ════════════════════════════════════════════════════════════
// Slide 3 — แนวคิด BPMN
// ════════════════════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHITE };
kicker(s, "แนวคิด", BLUE);
title(s, "BPMN engine แยก logic ออกจาก code");
s.addText([
  { text: "BPMN ", options: { bold: true, color: BLUE } },
  { text: "(Business Process Model and Notation) = มาตรฐานวาด workflow เป็นไดอะแกรม แล้วให้ ", options: {} },
  { text: "engine รันตามไดอะแกรมนั้น", options: { bold: true } },
], { x: 0.7, y: 1.8, w: 11.8, h: 0.8, fontFace: BODY, fontSize: 17, color: INK });

// before / after
card(s, 0.7, 2.9, 5.7, 3.4, LIGHT);
s.addText("เดิม — Hardcode", { x: 0.95, y: 3.1, w: 5, h: 0.5, fontFace: HEAD, fontSize: 18, bold: true, color: TEAL });
s.addText([
  { text: "logic อยู่ใน server.js", options: { bullet: true, breakLine: true } },
  { text: "เกณฑ์ = ตัวแปร + if-else", options: { bullet: true, breakLine: true } },
  { text: "แก้ rule → แก้โค้ด → deploy", options: { bullet: true, breakLine: true } },
  { text: "flow มองไม่เห็น", options: { bullet: true } },
], { x: 1.0, y: 3.7, w: 5.1, h: 2.4, fontFace: BODY, fontSize: 15, color: INK, paraSpaceAfter: 10 });

card(s, 6.9, 2.9, 5.7, 3.4, WHITE);
s.addShape(pres.shapes.RECTANGLE, { x: 6.9, y: 2.9, w: 0.1, h: 3.4, fill: { color: BLUE } });
s.addText("ใหม่ — BPMN engine", { x: 7.2, y: 3.1, w: 5, h: 0.5, fontFace: HEAD, fontSize: 18, bold: true, color: BLUE });
s.addText([
  { text: "logic อยู่ใน BPMN XML", options: { bullet: true, breakLine: true } },
  { text: "เกณฑ์ = gateway condition", options: { bullet: true, breakLine: true } },
  { text: "แก้ rule → แก้ XML → redeploy (ไม่แตะโค้ด)", options: { bullet: true, breakLine: true } },
  { text: "flow เห็นเป็นไดอะแกรม", options: { bullet: true } },
], { x: 7.25, y: 3.7, w: 5.1, h: 2.4, fontFace: BODY, fontSize: 15, color: INK, paraSpaceAfter: 10 });
pageNum(s, 3);

// ════════════════════════════════════════════════════════════
// Slide 4 — สถาปัตยกรรม
// ════════════════════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHITE };
kicker(s, "สถาปัตยกรรม", BLUE);
title(s, "องค์ประกอบของระบบ");

function archBox(x, y, w, h, name, sub, color, port) {
  card(s, x, y, w, h, WHITE);
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.09, fill: { color } });
  s.addText(name, { x: x + 0.2, y: y + 0.28, w: w - 0.4, h: 0.5, fontFace: HEAD, fontSize: 16, bold: true, color: INK });
  s.addText(sub, { x: x + 0.2, y: y + 0.8, w: w - 0.4, h: 0.8, fontFace: BODY, fontSize: 12, color: MUTE });
  if (port) s.addText(port, { x: x + 0.2, y: y + h - 0.5, w: w - 0.4, h: 0.4, fontFace: BODY, fontSize: 12, bold: true, color });
}
const ay = 2.6, ah = 1.9;
archBox(0.7, ay, 2.7, ah, "Frontend", "React + Vite\nฟอร์มสมัคร, task inbox, viewer", BLUE, "localhost:5173");
archBox(3.7, ay, 2.9, ah, "Backend API", "Express — proxy + fixed flow\nบาง flow คุย Flowable", GREEN, "localhost:3001");
archBox(6.9, ay, 2.9, ah, "Flowable Engine", "รัน BPMN, เก็บ task,\nประเมิน gateway", AMBER, "localhost:9000");
archBox(10.1, ay, 2.5, ah, "Mock Credit API", "ให้ข้อมูลเครดิต\n(hash nationalId)", RED, "/external/credit-check");

// arrows
function arrow(x1, x2) { s.addShape(pres.shapes.LINE, { x: x1, y: ay + ah / 2, w: x2 - x1, h: 0, line: { color: MUTE, width: 2, endArrowType: "triangle" } }); }
arrow(3.4, 3.7); arrow(6.6, 6.9); arrow(9.8, 10.1);

s.addText("ทุก request วิ่งผ่าน Frontend → Backend → (Flowable) → Credit API", { x: 0.7, y: 4.8, w: 11.8, h: 0.4, fontFace: BODY, fontSize: 14, color: MUTE, italic: true });

card(s, 0.7, 5.4, 11.9, 1.2, LIGHT);
s.addText([
  { text: "หัวใจ:  ", options: { bold: true, color: BLUE } },
  { text: "Backend ทำตัวเป็น API boundary — Flowable เรียกผ่าน HTTP ไม่รู้ว่า data มาจากไหน (mock / DB / external bureau)", options: {} },
], { x: 1.0, y: 5.65, w: 11.3, h: 0.7, fontFace: BODY, fontSize: 15, color: INK, valign: "middle" });
pageNum(s, 4);

// ════════════════════════════════════════════════════════════
// Slide 5 — 3 Flows overview
// ════════════════════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHITE };
kicker(s, "ภาพรวม", BLUE);
title(s, "3 Flows เพื่อเปรียบเทียบ");

const flows = [
  { c: TEAL, t: "Fixed Flow", st: "Hardcode (ไม่มี engine)", d: ["logic ทั้งหมดใน server.js", "เรียก credit function ตรง", "if-else routing", "in-memory store"], th: "≥700 ผ่าน · <400 ปฏิเสธ" },
  { c: BLUE, t: "BPMN Simple", st: "HTTP Task + 1 approver", d: ["engine เรียก HTTP Task", "gateway ใน XML", "Manager review", "เก็บใน H2 DB"], th: "≥700 ผ่าน · <450 ปฏิเสธ" },
  { c: AMBER, t: "BPMN Advanced", st: "Manager → Director", d: ["HTTP Task เดียวกัน", "เกณฑ์เข้มกว่า", "อนุมัติ 2 ชั้น", "เก็บใน H2 DB"], th: "≥750 ผ่าน · 2 ชั้น" },
];
let fx = 0.7, fw = 3.93, fgap = 0.15;
flows.forEach((f, i) => {
  const x = fx + i * (fw + fgap);
  card(s, x, 2.4, fw, 4.0, WHITE);
  s.addShape(pres.shapes.RECTANGLE, { x, y: 2.4, w: fw, h: 0.7, fill: { color: f.c } });
  s.addText(f.t, { x: x + 0.25, y: 2.5, w: fw - 0.5, h: 0.5, fontFace: HEAD, fontSize: 19, bold: true, color: WHITE, valign: "middle", margin: 0 });
  s.addText(f.st, { x: x + 0.25, y: 3.2, w: fw - 0.5, h: 0.4, fontFace: BODY, fontSize: 13, bold: true, color: f.c });
  s.addText(f.d.map((t, j) => ({ text: t, options: { bullet: true, breakLine: true, color: INK } })), { x: x + 0.3, y: 3.65, w: fw - 0.6, h: 2.0, fontFace: BODY, fontSize: 14, paraSpaceAfter: 8 });
  s.addShape(pres.shapes.RECTANGLE, { x: x + 0.25, y: 5.75, w: fw - 0.5, h: 0.45, fill: { color: LIGHT } });
  s.addText(f.th, { x: x + 0.25, y: 5.75, w: fw - 0.5, h: 0.45, fontFace: BODY, fontSize: 12, bold: true, color: f.c, align: "center", valign: "middle", margin: 0 });
});
pageNum(s, 5);

// ════════════════════════════════════════════════════════════
// Slide 6 — Flow 1 Fixed (hardcode)
// ════════════════════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHITE };
kicker(s, "FLOW 1", TEAL);
title(s, "Fixed Flow — Hardcode", TEAL);
s.addText("backend เรียก credit function ตรง แล้วตัดสินใจด้วย if-else ใน JS", { x: 0.7, y: 1.75, w: 11.8, h: 0.5, fontFace: BODY, fontSize: 16, color: MUTE });

// flow nodes
function node(x, y, w, label, color, fill) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.85, fill: { color: fill || WHITE }, line: { color, width: 2 }, rectRadius: 0.1, shadow: shadow() });
  s.addText(label, { x: x + 0.05, y, w: w - 0.1, h: 0.85, fontFace: HEAD, fontSize: 13, bold: true, color: color, align: "center", valign: "middle", margin: 0 });
}
function flowArrow(x1, y1, x2, y2, color) {
  s.addShape(pres.shapes.LINE, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color: color || MUTE, width: 2, endArrowType: "triangle" } });
}
const ny = 2.7;
node(0.7, ny, 1.9, "Submit\nใบสมัคร", TEAL);
flowArrow(2.6, ny + 0.42, 3.0, ny + 0.42, TEAL);
node(3.0, ny, 2.5, "getCreditData()\nเรียก function ตรง", TEAL, "E6F4F1");
flowArrow(5.5, ny + 0.42, 5.9, ny + 0.42, TEAL);
node(5.9, ny, 2.3, "if-else\nrouting (JS)", TEAL);
// branches
flowArrow(8.2, ny + 0.42, 8.7, ny + 0.1, GREEN);
flowArrow(8.2, ny + 0.42, 8.7, ny + 0.42, AMBER);
flowArrow(8.2, ny + 0.42, 8.7, ny + 0.85, RED);
node(8.7, ny - 0.55, 2.0, "≥700 Auto-approve", GREEN);
node(8.7, ny + 0.45, 2.0, "400–699 Task", AMBER);
node(8.7, ny + 1.45, 2.0, "<400 Auto-reject", RED);

// code callout
card(s, 0.7, 4.9, 11.9, 1.7, "0F172A");
s.addText("// backend/server.js — fixedFlowSubmit()", { x: 1.0, y: 5.05, w: 11, h: 0.4, fontFace: "Consolas", fontSize: 13, color: ICE });
s.addText("const credit  = getCreditData(nationalId);        // เรียก logic in-process", { x: 1.0, y: 5.45, w: 11.3, h: 0.35, fontFace: "Consolas", fontSize: 14, color: "7DD3FC" });
s.addText("const decision = getCreditDecision(credit.creditScore, 700);  // if-else ฝังในโค้ด", { x: 1.0, y: 5.8, w: 11.3, h: 0.35, fontFace: "Consolas", fontSize: 14, color: "7DD3FC" });
s.addText("เปลี่ยนเกณฑ์ = แก้โค้ด + restart", { x: 1.0, y: 6.2, w: 11, h: 0.35, fontFace: BODY, fontSize: 13, bold: true, color: "FCA5A5" });
pageNum(s, 6);

// ════════════════════════════════════════════════════════════
// Slide 7 — Flow 2 BPMN Simple
// ════════════════════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHITE };
kicker(s, "FLOW 2", BLUE);
title(s, "BPMN Simple — HTTP Task", BLUE);
s.addText("Flowable engine เรียก API เอง ผ่าน HTTP Task แล้ว route ด้วย gateway ใน XML", { x: 0.7, y: 1.75, w: 11.8, h: 0.5, fontFace: BODY, fontSize: 16, color: MUTE });

function node2(x, y, w, label, color, fill) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.85, fill: { color: fill || WHITE }, line: { color, width: 2 }, rectRadius: 0.1, shadow: shadow() });
  s.addText(label, { x: x + 0.05, y, w: w - 0.1, h: 0.85, fontFace: HEAD, fontSize: 12, bold: true, color, align: "center", valign: "middle", margin: 0 });
}
const my = 2.7;
node2(0.7, my, 1.6, "Start", BLUE);
flowArrow(2.3, my + 0.42, 2.7, my + 0.42, BLUE);
node2(2.7, my, 2.6, "HTTP Task\nCredit Check API", BLUE, "E8EFFD");
flowArrow(5.3, my + 0.42, 5.7, my + 0.42, BLUE);
node2(5.7, my, 1.9, "Gateway\nคะแนน?", BLUE);
flowArrow(7.6, my + 0.42, 8.1, my + 0.05, GREEN);
flowArrow(7.6, my + 0.42, 8.1, my + 0.42, AMBER);
flowArrow(7.6, my + 0.42, 8.1, my + 0.85, RED);
node2(8.1, my - 0.6, 2.1, "≥700 Auto-approve", GREEN);
node2(8.1, my + 0.45, 2.1, "450–699 Manager", AMBER);
node2(8.1, my + 1.5, 2.1, "<450 Auto-reject", RED);
flowArrow(10.2, my + 0.87, 10.6, my + 0.87, AMBER);
node2(10.6, my + 0.45, 2.0, "อนุมัติ /\nปฏิเสธ", AMBER);

card(s, 0.7, 4.95, 11.9, 1.65, "0F172A");
s.addText("<!-- credit-card-simple.bpmn20.xml -->", { x: 1.0, y: 5.08, w: 11, h: 0.35, fontFace: "Consolas", fontSize: 12, color: ICE });
s.addText('<serviceTask flowable:type="http">  requestUrl = host.docker.internal:3001/api/external/credit-check/${nationalId}', { x: 1.0, y: 5.43, w: 11.5, h: 0.35, fontFace: "Consolas", fontSize: 12.5, color: "7DD3FC" });
s.addText('gateway:  ${creditScore >= 700}   ${creditScore >= 450 && < 700}   ${creditScore < 450}', { x: 1.0, y: 5.8, w: 11.5, h: 0.35, fontFace: "Consolas", fontSize: 12.5, color: "86EFAC" });
s.addText("เปลี่ยนเกณฑ์ = แก้ XML + redeploy — ไม่แตะโค้ด backend", { x: 1.0, y: 6.2, w: 11, h: 0.35, fontFace: BODY, fontSize: 13, bold: true, color: "93C5FD" });
pageNum(s, 7);

// ════════════════════════════════════════════════════════════
// Slide 8 — Flow 3 Advanced
// ════════════════════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHITE };
kicker(s, "FLOW 3", AMBER);
title(s, "BPMN Advanced — 2 ชั้นอนุมัติ", AMBER);
s.addText("HTTP Task เดียวกัน แต่เกณฑ์เข้มกว่า และโซน manual ต้องผ่าน Manager → Director", { x: 0.7, y: 1.75, w: 11.8, h: 0.5, fontFace: BODY, fontSize: 16, color: MUTE });

function node3(x, y, w, label, color, fill) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.85, fill: { color: fill || WHITE }, line: { color, width: 2 }, rectRadius: 0.1, shadow: shadow() });
  s.addText(label, { x: x + 0.05, y, w: w - 0.1, h: 0.85, fontFace: HEAD, fontSize: 12, bold: true, color, align: "center", valign: "middle", margin: 0 });
}
const vy = 2.75;
node3(0.7, vy, 1.5, "Start", AMBER);
flowArrow(2.2, vy + 0.42, 2.55, vy + 0.42, AMBER);
node3(2.55, vy, 2.4, "HTTP Task\nCredit Check", AMBER, "FDF1E3");
flowArrow(4.95, vy + 0.42, 5.3, vy + 0.42, AMBER);
node3(5.3, vy, 1.7, "Gateway\n≥750?", AMBER);
flowArrow(7.0, vy + 0.42, 7.4, vy + 0.0, GREEN);
flowArrow(7.0, vy + 0.42, 7.4, vy + 0.85, RED);
node3(7.4, vy - 0.55, 1.8, "≥750 อนุมัติ", GREEN);
node3(7.4, vy + 1.5, 1.8, "<450 ปฏิเสธ", RED);
// manual 2 layer
node3(7.4, vy + 0.47, 1.8, "450–749", AMBER, "FDF1E3");
flowArrow(9.2, vy + 0.89, 9.55, vy + 0.89, AMBER);
node3(9.55, vy + 0.47, 1.6, "Manager", AMBER);
flowArrow(11.15, vy + 0.89, 11.5, vy + 0.89, AMBER);
node3(11.5, vy + 0.47, 1.5, "Director", AMBER);

card(s, 0.7, 5.05, 11.9, 1.55, LIGHT);
s.addText("ต่างจาก Simple อย่างไร", { x: 1.0, y: 5.2, w: 11, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: AMBER });
s.addText([
  { text: "เกณฑ์ auto-approve สูงขึ้น 700 → 750", options: { bullet: true, breakLine: true } },
  { text: "โซน manual ต้องผ่าน 2 คน (Manager แล้ว Director) — เพิ่ม userTask ใน XML เท่านั้น", options: { bullet: true } },
], { x: 1.0, y: 5.6, w: 11.3, h: 0.95, fontFace: BODY, fontSize: 14, color: INK, paraSpaceAfter: 6 });
pageNum(s, 8);

// ════════════════════════════════════════════════════════════
// Slide 9 — Credit check node (หัวใจที่คุยกัน)
// ════════════════════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHITE };
kicker(s, "หัวใจ", BLUE);
title(s, "Credit check node — API เดียว ใครเรียกต่างกัน");

card(s, 0.7, 2.3, 11.9, 1.0, NAVY);
s.addText("GET  /api/external/credit-check/:nationalId", { x: 1.0, y: 2.45, w: 8.5, h: 0.7, fontFace: "Consolas", fontSize: 17, bold: true, color: WHITE, valign: "middle" });
s.addText("→ { creditScore, riskLevel, existingCards, monthlyDebt, recommendation }", { x: 1.0, y: 2.45, w: 11.4, h: 0.7, fontFace: "Consolas", fontSize: 12, color: ICE, align: "right", valign: "middle" });

const rows = [
  ["", "เรียก credit API ที่ไหน", "logic ตัดสินใจอยู่ที่ไหน", "เปลี่ยนเกณฑ์"],
  ["Fixed", "backend เรียก function ตรง (in-process)", "if-else ใน server.js", "แก้โค้ด + restart"],
  ["BPMN Simple", "engine เรียก HTTP จริง (host.docker.internal)", "gateway condition ใน XML", "แก้ XML + redeploy"],
  ["BPMN Advanced", "engine เรียก HTTP จริง (เหมือน Simple)", "gateway + userTask ใน XML", "แก้ XML + redeploy"],
];
const rowColors = [NAVY, TEAL, BLUE, AMBER];
const tbl = rows.map((r, i) => r.map((c, j) => ({
  text: c,
  options: {
    fill: { color: i === 0 ? NAVY : (j === 0 ? rowColors[i] : WHITE) },
    color: i === 0 ? WHITE : (j === 0 ? WHITE : INK),
    bold: i === 0 || j === 0,
    fontSize: i === 0 ? 13 : 13,
    align: j === 0 ? "center" : "left",
    valign: "middle",
    fontFace: BODY,
    margin: 4,
  }
})));
s.addTable(tbl, { x: 0.7, y: 3.55, w: 11.9, colW: [2.2, 4.0, 3.5, 2.2], rowH: [0.45, 0.7, 0.7, 0.7], border: { pt: 1, color: "E2E8F0" } });

s.addText([
  { text: "data source เดียวกัน ", options: { bold: true, color: BLUE } },
  { text: "(hash nationalId → score คงที่). ต่างแค่จุดเรียก + จุดตัดสินใจ", options: {} },
], { x: 0.7, y: 6.5, w: 11.8, h: 0.4, fontFace: BODY, fontSize: 14, color: INK, italic: true });
pageNum(s, 9);

// ════════════════════════════════════════════════════════════
// Slide 10 — DB ตรง vs API boundary
// ════════════════════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHITE };
kicker(s, "คำถามที่พบบ่อย", AMBER);
title(s, "BPMN เรียก DB ตรงได้ไหม?");
s.addText("ได้หลายทาง — แต่ production แนะนำผ่าน API boundary", { x: 0.7, y: 1.75, w: 11.8, h: 0.5, fontFace: BODY, fontSize: 16, color: MUTE });

const opts = [
  ["HTTP Task", "ไม่ตรง", "เรียก REST → API คุย DB (ใช้อยู่)", GREEN],
  ["Java Service Task", "ตรงได้", "เขียน JavaDelegate รัน JDBC/JPA", AMBER],
  ["Delegate Expression", "ตรงได้", "inject Spring bean / Repository", AMBER],
  ["Script Task", "ตรงได้ (เลี่ยง)", "ฝัง SQL ใน XML = แย่", RED],
];
let oy = 2.5;
opts.forEach((o, i) => {
  const y = oy + i * 0.72;
  card(s, 0.7, y, 6.6, 0.62, i % 2 ? LIGHT : WHITE);
  s.addText(o[0], { x: 0.9, y, w: 2.3, h: 0.62, fontFace: HEAD, fontSize: 14, bold: true, color: INK, valign: "middle", margin: 0 });
  chip(s, 3.1, y + 0.13, 1.55, o[1], o[3]);
  s.addText(o[2], { x: 4.8, y, w: 2.4, h: 0.62, fontFace: BODY, fontSize: 11.5, color: MUTE, valign: "middle", margin: 0 });
});

// right column — why API boundary
card(s, 7.6, 2.5, 5.0, 3.6, NAVY);
s.addText("ทำไมแนะนำ API boundary", { x: 7.85, y: 2.7, w: 4.6, h: 0.5, fontFace: HEAD, fontSize: 17, bold: true, color: WHITE });
s.addText([
  { text: "ลด coupling — schema เปลี่ยนไม่กระทบ process", options: { bullet: true, breakLine: true } },
  { text: "reuse ได้ — service อื่นเรียก API เดียวกัน", options: { bullet: true, breakLine: true } },
  { text: "BPMN ไม่ต้องรู้ว่า data มาจาก DB / bureau / cache", options: { bullet: true, breakLine: true } },
  { text: "เปลี่ยน mock → DB จริง โดย BPMN ไม่ต้องแก้เลย", options: { bullet: true } },
], { x: 7.9, y: 3.3, w: 4.5, h: 2.7, fontFace: BODY, fontSize: 14, color: ICE, paraSpaceAfter: 12 });
pageNum(s, 10);

// ════════════════════════════════════════════════════════════
// Slide 11 — ข้อดี / สรุป
// ════════════════════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: NAVY };
s.addShape(pres.shapes.OVAL, { x: -1.5, y: 4.8, w: 4.5, h: 4.5, fill: { color: NAVY2 } });
s.addText("สรุป", { x: 0.9, y: 0.7, w: 8, h: 0.4, fontFace: HEAD, fontSize: 13, bold: true, color: ICE, charSpacing: 3 });
s.addText("BPMN ทำให้ logic แก้ได้โดยไม่แตะโค้ด", { x: 0.85, y: 1.2, w: 11.5, h: 0.9, fontFace: HEAD, fontSize: 30, bold: true, color: WHITE });

const sums = [
  ["แยก logic", "business rule อยู่ใน XML ไม่ปนกับโค้ดระบบ"],
  ["มองเห็น flow", "ไดอะแกรมอ่านได้ทั้ง dev และ business"],
  ["แก้เร็ว", "เปลี่ยนเกณฑ์/ลำดับ approver = redeploy XML"],
  ["API boundary", "data source สลับได้โดย flow ไม่ต้องแก้"],
];
sums.forEach((it, i) => {
  const x = 0.9 + (i % 2) * 6.0;
  const y = 2.5 + Math.floor(i / 2) * 1.7;
  card(s, x, y, 5.7, 1.45, NAVY2);
  s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.35, w: 0.75, h: 0.75, fill: { color: ICE } });
  s.addText(String(i + 1), { x: x + 0.25, y: y + 0.35, w: 0.75, h: 0.75, fontFace: HEAD, fontSize: 26, bold: true, color: NAVY, align: "center", valign: "middle", margin: 0 });
  s.addText(it[0], { x: x + 1.2, y: y + 0.2, w: 4.3, h: 0.5, fontFace: HEAD, fontSize: 18, bold: true, color: WHITE });
  s.addText(it[1], { x: x + 1.2, y: y + 0.7, w: 4.3, h: 0.65, fontFace: BODY, fontSize: 13, color: ICE });
});
s.addText("Frontend :5173   ·   Backend :3001   ·   Flowable :9000", { x: 0.9, y: 6.7, w: 11.5, h: 0.4, fontFace: BODY, fontSize: 13, color: ICE });

pres.writeFile({ fileName: "BPMN-Credit-Card-Presentation.pptx" }).then(f => console.log("WROTE", f));
