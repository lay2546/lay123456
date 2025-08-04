export async function verifySlipWithEasySlip({
  slipUrl,
  expectedTotal,
  expectedName,
  docId,
  statusEl,
}) {
  if (!slipUrl || !window.axios) {
    if (statusEl)
      statusEl.innerText = "❌ ไม่สามารถโหลด axios หรือ URL ไม่ถูกต้อง";
    return;
  }

  try {
    const { data } = await window.axios.post(
      "https://developer.easyslip.com/api/v1/verify",
      { url: slipUrl },
      {
        headers: {
          Authorization: "Bearer 7381e96d-15f7-4d09-b4a5-3d5117a998a3",
        },
      }
    );

    const amount = parseFloat(data?.amount || 0);
    const name = data?.account?.name || "";
    const refNo = data?.ref_no || "-";
    const bank = data?.bank?.name || "-";
    const time = data?.datetime || "-";

    const matchAmount = Math.abs(amount - expectedTotal) < 1;
    const matchName = name && expectedName && name.includes(expectedName);

    let badge = "⏳";
    let resultText = "รอผลตรวจสอบ";
    let verified = false;

    if (!matchAmount && !matchName) {
      badge = "❌ ไม่ตรง";
      resultText = "❌ ชื่อและยอดเงินไม่ตรง";
    } else if (matchAmount && matchName) {
      badge = "✅ ตรงทั้งหมด";
      resultText = "✅ ยืนยันชื่อและยอดเงินถูกต้อง";
      verified = true;
    } else {
      badge = "⚠️ บางส่วนตรง";
      resultText = matchAmount
        ? "⚠️ ชื่อไม่ตรง แต่ยอดเงินตรง"
        : "⚠️ ชื่อตรง แต่ยอดเงินไม่ตรง";
    }

    if (statusEl) statusEl.innerText = badge;

    // 🔄 อัปเดต Firestore
    const { db } = await import("../firebase.js");
    const { doc, updateDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js"
    );
    await updateDoc(doc(db, "orders", docId), { paymentVerified: verified });

    // ✅ แสดงผลใน modal
    document.getElementById("modal-refNo")?.innerText = refNo;
    document.getElementById("modal-name")?.innerText = name || "-";
    document.getElementById("modal-bank")?.innerText = bank;
    document.getElementById("modal-amount")?.innerText = `฿${amount.toFixed(2)}`;
    document.getElementById("modal-datetime")?.innerText = time;
    const resultEl = document.getElementById("modal-result");
    if (resultEl) {
      resultEl.innerText = resultText;
      resultEl.className =
        resultText.includes("✅")
          ? "text-green-600 font-semibold"
          : resultText.includes("❌")
          ? "text-red-500 font-semibold"
          : "text-yellow-600 font-semibold";
    }

    // 📌 แสดง modal
    document.getElementById("slip-modal")?.classList.remove("hidden");
    document.getElementById("close-slip-modal")?.addEventListener("click", () => {
      document.getElementById("slip-modal")?.classList.add("hidden");
    });
  } catch (error) {
    console.error("❌ ตรวจสอบ EasySlip ล้มเหลว:", error);
    if (statusEl) statusEl.innerText = "❌ ตรวจสอบล้มเหลว";

    // ซ่อน modal ถ้า error
    document.getElementById("modal-result")?.innerText = "❌ ตรวจสอบล้มเหลว";
    document.getElementById("modal-result")?.className = "text-red-600 font-semibold";
    document.getElementById("slip-modal")?.classList.remove("hidden");
  }
}
