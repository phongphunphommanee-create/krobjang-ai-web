"use client";
import { useState, useEffect } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [count, setCount] = useState(0);
  const [dailyUsage, setDailyUsage] = useState(0);
  const [isVIP, setIsVIP] = useState(false);
  const [vipExpiry, setVipExpiry] = useState<string | null>(null); // ✅ เก็บวันหมดอายุ
  const [showPayment, setShowPayment] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [loadingText, setLoadingText] = useState("✨ วิเคราะห์ทันที");

  // 1. โหลดข้อมูลเมื่อเปิดหน้าเว็บ
  useEffect(() => {
    const today = new Date().toDateString();

    // โควต้าประจำวัน
    const localUsage = JSON.parse(localStorage.getItem("krobjang_usage") || "{}");
    if (localUsage.date === today) {
      const savedCount = parseInt(localUsage.count);
      setDailyUsage(isNaN(savedCount) || savedCount < 0 ? 0 : savedCount);
    } else {
      setDailyUsage(0);
    }

    // ✅ เช็คสถานะ VIP พร้อมวันหมดอายุ
    const vipData = JSON.parse(localStorage.getItem("krobjang_vip_data") || "{}");
    if (vipData.expiry) {
      const expiryDate = new Date(vipData.expiry);
      const now = new Date();
      if (expiryDate > now) {
        // ยังไม่หมดอายุ
        setIsVIP(true);
        setVipExpiry(vipData.expiry);
      } else {
        // ✅ หมดอายุแล้ว — ล้างออกอัตโนมัติ
        localStorage.removeItem("krobjang_vip_data");
        localStorage.removeItem("krobjang_vip"); // ล้างของเก่าด้วย
        setIsVIP(false);
        setVipExpiry(null);
        console.log("VIP หมดอายุแล้ว ล้างข้อมูลเรียบร้อย");
      }
    } else {
      // รองรับของเก่าที่เก็บแค่ "true" ไม่มี expiry
      const oldVip = localStorage.getItem("krobjang_vip");
      if (oldVip === "true") {
        // ✅ ถ้าเจอของเก่า ให้ล้างออกด้วย (ไม่รู้วันหมดอายุ)
        localStorage.removeItem("krobjang_vip");
        setIsVIP(false);
      }
    }
  }, []);

  // 2. ฟังก์ชันวิเคราะห์สินค้า
  const handleAnalyze = async () => {
    if (!url) return alert("วางลิงก์สินค้าก่อนนะคะ");

    if (isVIP) {
      if (dailyUsage >= 50) {
        alert("👑 โควต้า VIP วันนี้ครบ 50 ครั้งแล้วค่ะ พรุ่งนี้มาร่วมสนุกกันใหม่นะคะ!");
        return;
      }
    } else {
      if (dailyUsage >= 5) {
        setShowPayment(true);
        return;
      }
    }

    setLoading(true);
    setResult(null);

    const messages = [
      "🔍 กำลังสแกนข้อมูลสินค้าจากลิงก์...",
      "🧠 AI กำลังเจาะลึกจุดขายที่คนอยากซื้อ...",
      "✍️ กำลังคิดแคปชั่นสะกดจิตลูกค้า...",
      "📈 กำลังคัดแฮชแท็กเปิดการมองเห็น...",
      "✨ ใกล้เสร็จแล้ว กูรูกำลังสรุปผล..."
    ];

    let step = 0;
    setLoadingText(messages[step]);
    const interval = setInterval(() => {
      step = (step + 1) % messages.length;
      setLoadingText(messages[step]);
    }, 2500);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: JSON.stringify({ productUrl: url, isVIP }),
      });
      const json = await res.json();

      clearInterval(interval);
      setLoadingText("✨ วิเคราะห์ทันที");

      if (json.success) {
        setResult(json.data);
        setCount(json.usage);

        const today = new Date().toDateString();
        const newCount = dailyUsage + 1;
        setDailyUsage(newCount);
        localStorage.setItem("krobjang_usage", JSON.stringify({ date: today, count: newCount }));
      } else {
        alert(json.error);
      }
    } catch (e) {
      clearInterval(interval);
      setLoadingText("✨ วิเคราะห์ทันที");
      alert("⚠️ การเชื่อมต่อขัดข้อง กรุณาลองใหม่อีกครั้งค่ะ");
    } finally {
      setLoading(false);
    }
  };

  // 3. ✅ ฟังก์ชันตรวจสอบรหัส VIP พร้อมรับวันหมดอายุจาก Google Sheet
  const verifyLicense = async () => {
    if (!licenseKey) return alert("กรุณากรอกรหัสก่อนนะคะ");

    try {
      alert("กำลังตรวจสอบรหัส VIP กรุณารอสักครู่นะคะ...");
      const res = await fetch("https://script.google.com/macros/s/AKfycbx8hstNylnPcp0s-gDyOOBurS5DxFX1xFYPwY2hLyCSIUwG7dUGcgtiYzOC3aHZkUz5/exec", {
        method: "POST",
        body: JSON.stringify({ action: "verify", key: licenseKey })
      });
      const data = await res.json();

      if (data.success) {
        // ✅ รับวันหมดอายุจาก Google Apps Script
        const expiry = data.expiry; // เช่น "2026-03-26"

        if (!expiry) {
          alert("❌ ระบบไม่ได้ส่งวันหมดอายุมา กรุณาติดต่อแอดมินค่ะ");
          return;
        }

        // ✅ เช็คว่า key หมดอายุหรือยัง
        const expiryDate = new Date(expiry);
        const now = new Date();
        if (expiryDate <= now) {
          alert("❌ รหัส VIP นี้หมดอายุแล้วค่ะ กรุณาต่ออายุใหม่นะคะ");
          return;
        }

        // ✅ บันทึกพร้อมวันหมดอายุ
        const vipData = { expiry: expiry };
        localStorage.setItem("krobjang_vip_data", JSON.stringify(vipData));
        localStorage.removeItem("krobjang_vip"); // ล้างของเก่า

        setIsVIP(true);
        setVipExpiry(expiry);

        // รีเซ็ตโควต้าวันนี้เป็น 0 เริ่มนับ 50 ใหม่
        const today = new Date().toDateString();
        setDailyUsage(0);
        localStorage.setItem("krobjang_usage", JSON.stringify({ date: today, count: 0 }));
        setShowPayment(false);

        // ✅ แสดงวันหมดอายุให้ลูกค้าเห็น
        const expiryDisplay = new Date(expiry).toLocaleDateString("th-TH", {
          year: "numeric", month: "long", day: "numeric"
        });
        alert(`🎉 ยินดีด้วยค่ะ! อัปเกรดเป็น PRO เรียบร้อยแล้ว\n👑 ใช้งานได้ถึง: ${expiryDisplay}`);

      } else {
        alert("❌ " + data.message);
      }
    } catch (error) {
      alert("ไม่สามารถเชื่อมต่อระบบตรวจสอบได้ กรุณาลองใหม่ค่ะ");
    }
  };

  // ✅ คำนวณวันเหลือ VIP
  const vipDaysLeft = () => {
    if (!vipExpiry) return 0;
    const diff = new Date(vipExpiry).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("คัดลอกสำเร็จ! ✅");
  };

  return (
    <div className="relative min-h-screen bg-[#050510] text-white p-6 md:p-10 flex flex-col items-center overflow-hidden font-sans">

      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#fe2c55]/10 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#ff6b35]/10 blur-[150px] rounded-full pointer-events-none"></div>

      {/* ส่วนหัวเว็บ */}
      <div className="relative z-10 text-center mt-12 mb-14 px-4">
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[#fe2c55] via-[#ff6b35] to-[#ff9f43] pb-4">
          Krobjang AI
        </h1>
        <p className="text-gray-400 font-medium text-lg md:text-xl max-w-lg mx-auto leading-relaxed">
          ปั้นแคปชั่นขายดีด้วยระบบ <span className="text-white font-bold">GURU AI</span>
          <br />
          {isVIP ? (
            // ✅ แสดงวันหมดอายุและวันเหลือ
            <span className="text-xs opacity-70 tracking-[0.2em] font-bold">
              👑 PRO: เหลือ {vipDaysLeft()} วัน | โควต้าวันนี้: {Math.max(0, 50 - dailyUsage)} / 50
            </span>
          ) : (
            <span className="text-xs opacity-70 tracking-[0.2em] font-bold">
              โควต้าฟรีวันนี้: {Math.max(0, 5 - dailyUsage)} / 5
            </span>
          )}
        </p>
      </div>

      {/* ช่องใส่ลิงก์ */}
      <div className="relative z-10 w-full max-w-2xl space-y-4 px-2">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#111122]/80 backdrop-blur-2xl transition-all focus-within:border-[#fe2c55]/50 shadow-2xl">
          <input
            className="w-full p-6 pl-8 bg-transparent focus:outline-none text-lg placeholder:text-gray-600"
            placeholder="วางลิงก์สินค้าจาก TikTok"
            value={url} onChange={(e) => setUrl(e.target.value)}
onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleAnalyze(); }}
          />
          {loading && <div className="absolute bottom-0 left-0 h-[3px] w-full bg-gradient-to-r from-transparent via-[#fe2c55] to-transparent animate-shimmer"></div>}
        </div>

        <button
          onClick={handleAnalyze} disabled={loading}
          className={`w-full p-6 rounded-3xl font-black text-2xl shadow-[0_10px_40px_rgba(254,44,85,0.3)] transition-all flex items-center justify-center gap-4 ${
            loading
              ? "bg-[#111122] border-2 border-[#fe2c55] text-[#fe2c55] animate-pulse cursor-wait"
              : "bg-gradient-to-r from-[#fe2c55] to-[#ff6b35] hover:scale-[1.01] active:scale-95 cursor-pointer"
          }`}
        >
          {loadingText}
        </button>
      </div>

      {/* ผลลัพธ์ */}
      {result && (
        <div className="relative z-10 mt-12 w-full max-w-2xl space-y-6 pb-20 px-2 animate-in fade-in zoom-in-95">
          {[
            { label: "📍 จุดเด่นสินค้า", value: result.highlights, color: "text-pink-400" },
            { label: "💰 แคปชั่นทำเงิน", value: result.caption, color: "text-orange-400" },
            { label: "🔍 แฮชแท็กแนะนำ", value: result.hashtags, color: "text-blue-400" },
            { label: "💡 คำแนะนำกูรู", value: result.advice, color: "text-yellow-400" },
          ].map((item, idx) => (
            <div key={idx} className="bg-white/5 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 hover:border-white/20 transition-all shadow-2xl group">
              <div className="flex justify-between items-center mb-4">
                <span className={`text-xs font-bold uppercase tracking-widest ${item.color}`}>{item.label}</span>
                <button onClick={() => copyToClipboard(item.value)} className="text-[11px] font-bold bg-white/5 hover:bg-white hover:text-black px-4 py-2 rounded-full border border-white/5 transition-all">คัดลอก</button>
              </div>
              <p className="text-xl leading-relaxed whitespace-pre-wrap font-medium">{item.value}</p>
            </div>
          ))}
          <div className="flex gap-4">
            <button onClick={() => copyToClipboard(Object.values(result).join('\n\n'))} className="flex-[2] p-6 bg-white text-black font-black text-lg rounded-3xl hover:bg-gray-200 transition-all shadow-xl">📋 คัดลอกทั้งหมด</button>
            <button onClick={() => setResult(null)} className="flex-1 p-6 bg-white/5 text-gray-400 font-bold rounded-3xl hover:bg-red-500/20 hover:text-red-400 transition-all">❌ ล้าง</button>
          </div>
        </div>
      )}

      {/* ป๊อปอัพจ่ายเงิน VIP */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="bg-[#111122] border border-white/10 p-8 rounded-[2.5rem] max-w-md w-full text-center relative shadow-2xl animate-in zoom-in-95 duration-300">
            <button onClick={() => setShowPayment(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white text-xl">✕</button>

            <h2 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-[#fe2c55] to-[#ff6b35]">อัปเกรดเป็น PRO</h2>
            <p className="text-gray-400 mb-6 font-medium">ใช้งานจุใจ 50 ครั้ง/วัน พร้อมระบบ VIP<br />เพียง <span className="text-white font-bold text-lg">149.-</span> / 30 วัน</p>

            <div className="bg-white p-4 rounded-3xl mb-6 inline-block shadow-inner">
              <img
                src="/payment-qr.jpg"
                alt="QR Code Payment"
                className="w-48 h-48 object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex'; }}
              />
              <div className="hidden w-48 h-48 items-center justify-center text-black font-bold text-sm text-center">ไม่พบรูป QR Code<br />(เช็คไฟล์ payment-qr.jpg)</div>
              <p className="text-black text-[10px] font-bold mt-2 uppercase tracking-wider">สแกนเพื่อโอนเงิน (พร้อมเพย์)</p>
            </div>

            <div className="space-y-4">
              <a
                href="https://line.me/R/ti/p/@vfk5903b" target="_blank" rel="noreferrer"
                className="block w-full p-4 bg-[#06c755] rounded-2xl font-bold text-white hover:opacity-90 transition-all shadow-[0_0_20px_rgba(6,199,85,0.4)] animate-pulse"
              >
                💬 แจ้งโอนเงินรับรหัสที่นี่
              </a>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                <div className="relative flex justify-center text-xs uppercase font-bold tracking-widest"><span className="bg-[#111122] px-4 text-gray-500">หรือกรอกรหัส VIP</span></div>
              </div>

              <input
                type="text" placeholder="กรอก License Key ของคุณ..."
                className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-center outline-none focus:border-[#fe2c55] font-medium tracking-wider uppercase"
                value={licenseKey} onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              />
              <button
                onClick={verifyLicense}
                className="w-full p-4 bg-gradient-to-r from-gray-100 to-white text-black font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
              >
                🔓 ปลดล็อคระบบ PRO
              </button>
            </div>
          </div>
        </div>
      )}

      {count > 0 && (
        <div className="mt-auto py-10 text-gray-500 text-xs font-bold tracking-widest uppercase opacity-40">
          ⚡ วิเคราะห์ไปแล้วทั้งสิ้น: {count} ครั้ง
        </div>
      )}

      <style jsx>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .animate-shimmer { animation: shimmer 2s infinite linear; }
      `}</style>
    </div>
  );
}