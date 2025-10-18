const chromium = require("@sparticuz/chromium");
const puppeteerCore = require("puppeteer-core");

module.exports = async function handler(req, res) {
  const { placa } = req.query || {};
  
  // Validación del parámetro placa
  if (!placa) {
    res.status(400).json({ 
      ok: false, 
      error: "Falta el parámetro 'placa'." 
    });
    return;
  }

  let browser;
  try {
    // Configuración para @sparticuz/chromium en Vercel
    const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // Producción: usar @sparticuz/chromium
      browser = await puppeteerCore.launch({
        args: [
          ...chromium.args,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--single-process'
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless
      });
    } else {
      // Desarrollo local: necesitarías puppeteer completo instalado
      throw new Error("Para desarrollo local, instala puppeteer y ajusta el código");
    }

    const page = await browser.newPage();
    page.setDefaultTimeout(20000); // 20 segundos por cada espera

    // 1) Navegar al sitio del inventario SENA
    await page.goto("https://miinventario.sena.edu.co/Inicio.aspx", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // 2) Click en #IMAGE7 (abre el modal de búsqueda)
    await page.waitForSelector("#IMAGE7", { visible: true });
    await page.click("#IMAGE7");

    // 3) Esperar que aparezca el modal
    await page.waitForSelector(".gx-ct-body.Form-fx", { visible: true });

    // 4) Click en el radiobutton #vOPTION1
    await page.waitForSelector("#vOPTION1", { visible: true });
    await page.click("#vOPTION1");

    // 5) Escribir la placa en el campo de búsqueda
    await page.waitForSelector("#vIN_VINVEN1PLACA", { visible: true });
    await page.focus("#vIN_VINVEN1PLACA");
    await page.click("#vIN_VINVEN1PLACA", { clickCount: 3 });
    await page.type("#vIN_VINVEN1PLACA", String(placa), { delay: 30 });

    // 6) Click en el botón de buscar/aceptar
    await page.waitForSelector("#BUTTON2", { visible: true });
    await Promise.all([
      page.click("#BUTTON2"),
      page.waitForNetworkIdle({ idleTime: 1000, timeout: 30000 }).catch(() => {})
    ]);

    // 7) Leer la descripción del resultado
    await page.waitForSelector("#span_vIN_VINVEN1DESCRIPCION", { visible: true });
    const descripcion = await page.$eval(
      "#span_vIN_VINVEN1DESCRIPCION", 
      el => el.textContent?.trim() || ""
    );

    // Respuesta exitosa
    res.status(200).json({ 
      ok: true, 
      placa, 
      descripcion 
    });

  } catch (err) {
    console.error("Error en el scraping:", err);
    res.status(500).json({ 
      ok: false, 
      error: err.message 
    });
  } finally {
    // Siempre cerrar el navegador para liberar recursos
    if (browser) {
      try { 
        await browser.close(); 
      } catch (closeErr) {
        console.error("Error cerrando el navegador:", closeErr);
      }
    }
  }
};

