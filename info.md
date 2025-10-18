
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export default async function handler(req, res) {
  const { placa } = req.query || {};
  if (!placa) {
    res.status(400).json({ ok: false, error: "Falta el parámetro 'placa'." });
    return;
  }

  let browser;
  try {
    // Config serverless-friendly
    const executablePath = await chromium.executablePath();

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,            // 'new' para versiones recientes, true suele ser estable en Vercel
      defaultViewport: { width: 1280, height: 900 }
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(20000); // 20s por cada espera

    // 1) Ir al sitio
    await page.goto("https://miinventario.sena.edu.co/Inicio.aspx", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // 2) Click en #IMAGE7 (abre modal)
    await page.waitForSelector("#IMAGE7", { visible: true });
    await page.click("#IMAGE7");

    // 3) Esperar modal: .gx-ct-body.Form-fx
    await page.waitForSelector(".gx-ct-body.Form-fx", { visible: true });

    // 4) Click en radiobutton #vOPTION1
    await page.waitForSelector("#vOPTION1", { visible: true });
    // A veces los radios necesitan "click" en el input o su label:
    await page.click("#vOPTION1");

    // 5) Escribir en #vIN_VINVEN1PLACA
    await page.waitForSelector("#vIN_VINVEN1PLACA", { visible: true });
    await page.focus("#vIN_VINVEN1PLACA");
    await page.click("#vIN_VINVEN1PLACA", { clickCount: 3 });
    await page.type("#vIN_VINVEN1PLACA", String(placa), { delay: 30 });

    // 6) Click en #BUTTON2 (buscar/aceptar)
    await page.waitForSelector("#BUTTON2", { visible: true });
    await Promise.all([
      page.click("#BUTTON2"),
      page.waitForNetworkIdle({ idleTime: 1000, timeout: 30000 }).catch(() => {})
    ]);

    // 7) Leer #span_vIN_VINVEN1DESCRIPCION
    await page.waitForSelector("#span_vIN_VINVEN1DESCRIPCION", { visible: true });
    const descripcion = await page.$eval("#span_vIN_VINVEN1DESCRIPCION", el => el.textContent?.trim() || "");

    res.status(200).json({ ok: true, placa, descripcion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}
