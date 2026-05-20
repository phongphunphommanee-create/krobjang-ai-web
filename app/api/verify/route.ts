import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { key } = await req.json();

  try {
    const res = await fetch(
      "https://script.google.com/macros/s/AKfycbwLoh_dxygeeHbWFtQsdGuX9utrxFrymw-b02nKy_XNjYFC815In3C5xy-EapDpd2kd/exec",
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "verify", key }),
        redirect: "follow",
      }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ success: false, message: "เชื่อมต่อไม่ได้ค่ะ" });
  }
}