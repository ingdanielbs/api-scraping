const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Ruta de salud
app.get("/", (req, res) => {
  res.json({ 
    ok: true, 
    message: "API Scraping SENA - Funcionando",
    endpoints: {
      consultar: "/api/consultar?placa=TU_PLACA"
    }
  });
});

// Endpoint principal de consulta
app.get("/api/consultar", async (req, res) => {
  const { placa } = req.query || {};
  
  // Validación del parámetro placa
  if (!placa) {
    return res.status(400).json({ 
      ok: false, 
      error: "Falta el parámetro 'placa'." 
    });
  }

  let browser;
  try {
    console.log(`[${new Date().toISOString()}] Iniciando scraping para placa: ${placa}`);
    
    // Lanzar navegador con Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

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

    console.log(`[${new Date().toISOString()}] Scraping exitoso para placa: ${placa}`);
    
    // Respuesta exitosa
    res.status(200).json({ 
      ok: true, 
      placa, 
      descripcion 
    });

  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error en el scraping:`, err);
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
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📡 API disponible en: http://localhost:${PORT}/api/consultar`);
});

