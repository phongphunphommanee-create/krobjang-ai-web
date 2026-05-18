import { NextResponse } from "next/server";

export const maxDuration = 60;

let totalUsage = 0;

const MODEL_CONFIG = {
    vip: "google/gemini-2.0-flash-001",
    free_google: "gemini-2.0-flash",
    free_openrouter_models: [
        "openrouter/free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "deepseek/deepseek-r1:free",
        "google/gemini-2.0-flash-exp:free",
    ],
};

const TIMEOUT_MS = 30000;

const SYSTEM_PROMPT = `คุณคือแม่ค้าออนไลน์ไทยที่เก่งเรื่องการตลาด TikTok Shop มีประสบการณ์ขายของออนไลน์มากกว่า 5 ปี
พูดภาษาไทยแบบชาวบ้านทั่วไป กระชับ โดน เข้าใจง่าย อ่านแล้วอยากซื้อ
ห้ามแปลตรงตัวจากภาษาอังกฤษเด็ดขาด
ห้ามใช้คำแปลกหรือเป็นทางการ เช่น "อุดมสมบูรณ์" "แบบจำลอง" "ผู้ใช้บริการ" "แพลตฟอร์ม" "สำหรับคุณ" "เหมาะกับคุณ"
เขียนเหมือนคนไทยจริงๆ พูดในชีวิตประจำวัน`;

async function unshortenUrl(url: string): Promise<string> {
    if (!url.includes("vt.tiktok.com") && !url.includes("vm.tiktok.com")) {
        return url;
    }
    try {
        console.log("🔗 ตรวจพบลิงก์ย่อ กำลังแปลงเป็นลิงก์เต็ม...");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
        clearTimeout(timeout);
        const fullUrl = res.url;
        if (fullUrl && fullUrl.includes("tiktok.com")) {
            console.log("✅ แปลงลิงก์สำเร็จ:", fullUrl);
            return fullUrl;
        }
        return url;
    } catch (err: any) {
        if (err.name === "AbortError") console.log("⏱️ Unshorten timeout ใช้ลิงก์เดิม");
        else console.log("⚠️ Unshorten ไม่ได้:", err);
        return url;
    }
}

async function getTikTokData(url: string) {
    try {
        const finalUrl = await unshortenUrl(url);
        console.log("🔍 กำลังดึงข้อมูลคลิปจาก TikTok...");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch(
                `https://www.tikwm.com/api/?url=${encodeURIComponent(finalUrl)}`,
                { signal: controller.signal }
            );
            clearTimeout(timeout);
            const data = await response.json();

            if (data.code === 0 && data.data) {
                const d = data.data;
                const parts: string[] = [];

                if (d.title) parts.push(`ชื่อคลิป: ${d.title}`);
                if (d.desc && d.desc !== d.title) parts.push(`คำบรรยาย: ${d.desc}`);
                if (d.author?.nickname) parts.push(`เจ้าของร้าน: ${d.author.nickname}`);
                if (d.author?.signature) parts.push(`โปรไฟล์ร้าน: ${d.author.signature}`);
                if (d.music?.title) parts.push(`เพลงประกอบ: ${d.music.title}`);

                if (d.desc) {
                    const tags = (d.desc.match(/#\S+/g) || []).join(" ");
                    if (tags) parts.push(`แฮชแท็กในคลิป: ${tags}`);
                }

                const result = parts.join("\n");
                console.log("📦 TikTok data ที่ดึงได้:\n", result);
                return result || null;
            }

            console.log("⚠️ tikwm ตอบกลับแต่ไม่มีข้อมูล:", JSON.stringify(data).substring(0, 200));
            return null;

        } catch (err: any) {
            clearTimeout(timeout);
            if (err.name === "AbortError") console.log("⏱️ TikTok API timeout");
            return null;
        }
    } catch (error) {
        console.log("⚠️ TikTok Error:", error);
        return null;
    }
}

async function callAPI(apiKey: string, modelName: string, prompt: string): Promise<string | null> {
    const isOpenRouter = apiKey.startsWith("sk-or-");

    const apiUrl = isOpenRouter
        ? "https://openrouter.ai/api/v1/chat/completions"
        : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isOpenRouter) {
        headers["Authorization"] = `Bearer ${apiKey}`;
        headers["HTTP-Referer"] = "https://krobjang-ai-web.vercel.app";
        headers["X-Title"] = "Krobjang AI";
    }

    const requestBody = isOpenRouter
        ? {
            model: modelName,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: prompt }
            ]
          }
        : {
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ parts: [{ text: prompt }] }]
          };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        const data = await response.json();

        if (!response.ok) {
            const errMsg = data?.error?.message || data?.error?.status || JSON.stringify(data);
            console.log(`⚠️ [${response.status}] ${modelName} -> ${errMsg}`);
            return null;
        }

        const rawText = isOpenRouter
            ? data.choices?.[0]?.message?.content
            : data.candidates?.[0]?.content?.parts?.[0]?.text;

        return rawText || null;

    } catch (err: any) {
        clearTimeout(timeout);
        if (err.name === "AbortError") {
            console.log(`⏱️ Timeout ${TIMEOUT_MS / 1000}s! ${modelName} -> ข้าม`);
        } else {
            console.log(`❌ ${modelName} Error:`, err);
        }
        return null;
    }
}

function extractJSON(text: string): object | null {
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    if (s === -1 || e === -1) return null;
    try {
        return JSON.parse(text.substring(s, e + 1));
    } catch {
        return null;
    }
}

export async function POST(req: Request) {
    try {
        const { productUrl, isVIP } = await req.json();

        const productText = await getTikTokData(productUrl);
        if (!productText) throw new Error("PRODUCT_NOT_FOUND");

        let keysToTry: string[] = [];
        if (isVIP) {
            keysToTry = [process.env.VIP_API_KEY || ""];
        } else {
            const keyString = process.env.FREE_API_KEYS || "";
            const allKeys = keyString.split(",").map(k => k.trim()).filter(k => k !== "");
            const openRouterKeys = allKeys.filter(k => k.startsWith("sk-or-"));
            const googleKeys = allKeys.filter(k => !k.startsWith("sk-or-"));
            // ✅ แก้ไข: Google ขึ้นก่อน ถ้า quota หมดค่อยใช้ OpenRouter
            keysToTry = [...googleKeys, ...openRouterKeys];
        }

        if (keysToTry.length === 0 || !keysToTry[0]) throw new Error("KEYS_MISSING");

        console.log(`🔑 กุญแจ ${keysToTry.length} ดอก:`, keysToTry.map(k => k.substring(0, 10) + "..."));

        // ✅ Prompt ที่แก้ไขแล้ว — บังคับ AI ใช้ข้อมูลจริงเท่านั้น
        const prompt = `วิเคราะห์สินค้าจากข้อมูลคลิป TikTok นี้:

${productText}

กฎเหล็กที่ต้องทำตามเสมอ:
1. ใช้ข้อมูลจากคลิปข้างต้นเท่านั้น ห้ามเดาหรือแต่งขึ้นเอง
2. ชื่อสินค้าและแบรนด์ต้อง copy ตรงๆ จากข้อมูล ห้ามสะกดใหม่หรือแปลงเสียงเอง
3. จุดเด่นต้องมีในคลิปจริงเท่านั้น ถ้าไม่แน่ใจว่าคลิปพูดถึง ห้ามใส่
4. ห้ามใช้คำว่า "แรง" ให้ใช้ "โดน" หรือ "ปัง" แทน
5. ห้ามพูดเรื่องโปรโมชั่น ส่วนลด หรือการจัดส่ง ถ้าคลิปไม่ได้กล่าวถึง
6. ห้ามใช้ประโยคเชิงลบ เช่น "ไม่ทำร้ายผ้า" ให้เปลี่ยนเป็นบวก เช่น "ถนอมเนื้อผ้า"
7. Hashtag ต้องเป็นที่คนไทยค้นหาจริงบน TikTok ไม่ใช่แต่งขึ้นมาเอง

ตอบเฉพาะ JSON นี้เท่านั้น ห้ามมีข้อความอื่นนอก JSON:
{
  "highlights": "• จุดเด่นข้อ1\\n• จุดเด่นข้อ2\\n• จุดเด่นข้อ3",
  "caption": "แคปชั่น 1 ประโยค เน้นปิดการขาย ภาษาแม่ค้าไทย",
  "hashtags": "#แฮชแท็ก1 #แฮชแท็ก2 #แฮชแท็ก3 #แฮชแท็ก4 #แฮชแท็ก5 #แฮชแท็ก6",
  "advice": "• คำแนะนำข้อ1\\n• คำแนะนำข้อ2"
}`;

        let finalResult = null;

        for (const apiKey of keysToTry) {
            if (finalResult) break;
            const isOpenRouter = apiKey.startsWith("sk-or-");

            if (isVIP) {
                console.log(`🚀 [VIP] ${apiKey.substring(0, 10)}... / ${MODEL_CONFIG.vip}`);
                const rawText = await callAPI(apiKey, MODEL_CONFIG.vip, prompt);
                if (rawText) finalResult = extractJSON(rawText);
                if (finalResult) console.log("✅ สำเร็จ! VIP");

            } else if (isOpenRouter) {
                console.log(`🚀 [FREE-OR] ยิงพร้อมกัน ${MODEL_CONFIG.free_openrouter_models.length} models...`);
                const results = await Promise.allSettled(
                    MODEL_CONFIG.free_openrouter_models.map(modelName =>
                        callAPI(apiKey, modelName, prompt).then(text => ({ text, modelName }))
                    )
                );

                for (const result of results) {
                    if (result.status === "fulfilled" && result.value?.text) {
                        const parsed = extractJSON(result.value.text);
                        if (parsed) {
                            finalResult = parsed;
                            console.log(`✅ สำเร็จ! ${result.value.modelName}`);
                            break;
                        }
                    }
                }

            } else {
                console.log(`🚀 [FREE-GG] ${apiKey.substring(0, 10)}... / ${MODEL_CONFIG.free_google}`);
                const rawText = await callAPI(apiKey, MODEL_CONFIG.free_google, prompt);
                if (rawText) finalResult = extractJSON(rawText);
                if (finalResult) console.log("✅ สำเร็จ! Google");
            }
        }

        if (!finalResult) throw new Error("ALL_KEYS_FAILED");

        totalUsage++;
        return NextResponse.json({ success: true, data: finalResult, usage: totalUsage });

    } catch (error: any) {
        console.log("🚨 FINAL ERROR:", error.message);
        let errorMessage = "⚠️ ระบบขัดข้อง กรุณาลองใหม่นะคะ";

        if (error.message === "ALL_KEYS_FAILED") {
            errorMessage = "⚠️ คิวฟรีเต็มชั่วคราวค่ะ กรุณาอัปเกรดเป็น PRO เพื่อใช้เลนด่วนทันทีนะคะ!";
        } else if (error.message === "PRODUCT_NOT_FOUND") {
            errorMessage = "⚠️ AI อ่านข้อมูลคลิปนี้ไม่ได้ (อาจเป็นส่วนตัว) ลองคลิปอื่นดูนะคะ";
        } else if (error.message === "KEYS_MISSING") {
            errorMessage = "⚠️ ระบบยังไม่ได้ตั้งค่า API Key ค่ะ";
        }

        return NextResponse.json({ success: false, error: errorMessage });
    }
}