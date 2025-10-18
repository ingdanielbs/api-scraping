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
    page.setDefaultTimeout(30000); // 30 segundos por cada espera

    // 1) Navegar al sitio del inventario SENA
    console.log("Navegando al sitio...");
    await page.goto("https://miinventario.sena.edu.co/Inicio.aspx", {
      waitUntil: "networkidle2",
      timeout: 60000
    });
    console.log("Sitio cargado correctamente");

    // 2) Click en #IMAGE7 (abre el modal de búsqueda)
    console.log("Buscando botón de búsqueda...");
    await page.waitForSelector("#IMAGE7", { visible: true, timeout: 30000 });
    console.log("Botón encontrado, haciendo click...");
    await page.click("#IMAGE7");

    // 3) Esperar que aparezca el modal
    console.log("Esperando modal...");
    await page.waitForSelector(".gx-ct-body.Form-fx", { visible: true, timeout: 30000 });
    console.log("Modal abierto");

    // 4) Click en el radiobutton usando XPath
    console.log("Buscando radiobutton...");
    await page.waitForXPath("/html[1]/body[1]/form[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/span[1]/label[1]/input[1]", { visible: true, timeout: 30000 });
    console.log("Radiobutton encontrado, haciendo click...");
    const [radiobutton] = await page.$x("/html[1]/body[1]/form[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/span[1]/label[1]/input[1]");
    await radiobutton.click();

    // 5) Escribir la placa en el campo de búsqueda
    console.log("Buscando campo de placa...");
    await page.waitForSelector("#vIN_VINVEN1PLACA", { visible: true, timeout: 30000 });
    console.log("Campo encontrado, escribiendo placa...");
    await page.focus("#vIN_VINVEN1PLACA");
    await page.click("#vIN_VINVEN1PLACA", { clickCount: 3 });
    await page.type("#vIN_VINVEN1PLACA", String(placa), { delay: 30 });

    // 6) Click en el botón de buscar/aceptar
    console.log("Buscando botón de búsqueda...");
    await page.waitForSelector("#BUTTON2", { visible: true, timeout: 30000 });
    console.log("Botón encontrado, haciendo búsqueda...");
    await Promise.all([
      page.click("#BUTTON2"),
      page.waitForNetworkIdle({ idleTime: 1000, timeout: 30000 }).catch(() => {})
    ]);

    // 7) Leer la descripción del resultado
    console.log("Esperando resultado...");
    await page.waitForSelector("#span_vIN_VINVEN1DESCRIPCION", { visible: true, timeout: 30000 });
    console.log("Resultado encontrado, extrayendo descripción...");
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

