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

    // 2) Click en #IMAGE7 (abre el modal en iframe)
    console.log("Buscando botón de búsqueda...");
    await page.waitForSelector("#IMAGE7", { visible: true, timeout: 30000 });
    console.log("Botón encontrado, haciendo click...");
    await page.click("#IMAGE7");

    // 3) Esperar que aparezca el iframe del modal
    console.log("Esperando iframe del modal...");
    await page.waitForSelector('iframe[title="Pop_buscar_placa"]', { visible: true, timeout: 30000 });
    console.log("Iframe encontrado");

    // 4) Obtener el frame del modal
    let frame = null;
    
    // Buscar el iframe por title
    const iframeElement = await page.$('iframe[title="Pop_buscar_placa"]');
    if (iframeElement) {
      frame = await iframeElement.contentFrame();
    }
    
    // Si no se encuentra, buscar en todos los frames
    if (!frame) {
      const frames = page.frames();
      frame = frames.find(f => f.name() === 'Pop_buscar_placa') ||
              frames.find(f => f.url().includes('Pop_buscar_placa'));
    }

    if (!frame) {
      throw new Error("No se pudo encontrar el iframe del modal");
    }

    console.log("Frame del modal obtenido");

    // 5) Click en el radiobutton "Placa" dentro del iframe
    console.log("Buscando radiobutton 'Placa' en el iframe...");
    await frame.waitForSelector('input[type="radio"]', { visible: true, timeout: 30000 });
    console.log("Radiobutton encontrado, haciendo click...");
    await frame.click('input[type="radio"]');

    // 6) Escribir la placa en el campo de búsqueda
    console.log("Buscando campo de placa en el iframe...");
    await frame.waitForSelector('input[placeholder*="Placa"]', { visible: true, timeout: 30000 });
    console.log("Campo encontrado, escribiendo placa...");
    
    // Limpiar el campo primero
    await frame.focus('input[placeholder*="Placa"]');
    await frame.click('input[placeholder*="Placa"]', { clickCount: 3 });
    await frame.keyboard.press('Backspace');
    
    // Escribir la placa
    const placaString = String(placa);
    console.log(`Escribiendo placa: "${placaString}" (${placaString.length} caracteres)`);
    await frame.type('input[placeholder*="Placa"]', placaString, { delay: 50 });
    
    // Verificar qué se escribió
    const valorEscrito = await frame.evaluate(() => {
      const input = document.querySelector('input[placeholder*="Placa"]');
      return input ? input.value : 'INPUT NO ENCONTRADO';
    });
    console.log(`Valor escrito en el campo: "${valorEscrito}"`);

    // 7) Click en el botón de buscar dentro del iframe
    console.log("Buscando botón de búsqueda en el iframe...");
    await frame.waitForSelector('#BUTTON2', { visible: true, timeout: 30000 });
    console.log("Botón encontrado, haciendo click...");
    await frame.click('#BUTTON2');
    
    // Esperar un momento para ver si aparece algún mensaje de error o alerta
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verificar si hay algún mensaje de error o alerta
    const mensajeError = await frame.evaluate(() => {
      // Buscar mensajes de error comunes
      const errorElements = Array.from(document.querySelectorAll('[class*="error"], [class*="Error"], [class*="alert"], [class*="Alert"], [id*="error"], [id*="Error"]'));
      const alerts = errorElements.map(el => el.textContent?.trim()).filter(text => text && text.length > 0);
      
      // Verificar si hay un alert/confirm/prompt
      return {
        hayAlertas: alerts.length > 0,
        alertas: alerts,
        bodyText: document.body.textContent?.substring(0, 1000)
      };
    });
    
    console.log('Mensajes después del clic:', JSON.stringify(mensajeError, null, 2));
    
    // Verificar si dice "Placa no encontrada"
    if (mensajeError.bodyText && mensajeError.bodyText.includes('Placa no encontrada')) {
      throw new Error(`Placa no encontrada: ${placa}`);
    }
    
    // 8) Esperar a que los datos se carguen en el formulario
    console.log("Esperando que se carguen los datos en el formulario...");
    
    // Primero, revisar el estado actual inmediatamente después del clic
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const estadoInmediato = await frame.evaluate(() => {
      const spanNIT = document.querySelector('#span_vIN_VINVEN1NIT');
      const spanDescripcion = document.querySelector('#span_vIN_VINVEN1DESCRIPCION');
      const tdNIT = document.querySelector("body > form > div > div > table > tbody > tr > td > table > tbody > tr:nth-child(6) > td > fieldset > table > tbody > tr:nth-child(1) > td:nth-child(2)");
      const tdDescripcion = document.querySelector("body > form > div > div > table > tbody > tr > td > table > tbody > tr:nth-child(6) > td > fieldset > table > tbody > tr:nth-child(3) > td:nth-child(2)");
      
      return {
        nitExiste: !!spanNIT,
        nitContenido: spanNIT ? spanNIT.textContent : 'NO EXISTE',
        descripcionExiste: !!spanDescripcion,
        descripcionContenido: spanDescripcion ? spanDescripcion.textContent : 'NO EXISTE',
        tdNITContenido: tdNIT ? tdNIT.textContent : 'NO EXISTE',
        tdDescripcionContenido: tdDescripcion ? tdDescripcion.textContent : 'NO EXISTE'
      };
    });
    
    console.log('Estado inmediato después de buscar:', JSON.stringify(estadoInmediato, null, 2));
    
    // Listar TODOS los spans con ID en #TABLE2 para ver cuáles se están llenando
    const todosLosSpans = await frame.evaluate(() => {
      const table2 = document.querySelector('#TABLE2');
      if (!table2) return { error: 'TABLE2 no encontrado' };
      
      const spans = Array.from(table2.querySelectorAll('span[id]'));
      return spans.map(span => ({
        id: span.id,
        contenido: span.textContent?.trim() || '',
        visible: span.offsetParent !== null
      }));
    });
    
    console.log('TODOS los spans en TABLE2:', JSON.stringify(todosLosSpans, null, 2));
    
    // Intentar esperar en intervalos más cortos y mostrar el progreso
    console.log("Esperando que los campos se llenen (máximo 30 segundos)...");
    let intentos = 0;
    const maxIntentos = 60; // 60 intentos x 500ms = 30 segundos
    
    while (intentos < maxIntentos) {
      const estado = await frame.evaluate(() => {
        const spanNIT = document.querySelector('#span_vIN_VINVEN1NIT');
        const spanDescripcion = document.querySelector('#span_vIN_VINVEN1DESCRIPCION');
        
        return {
          nitExiste: !!spanNIT,
          nitContenido: spanNIT ? spanNIT.textContent?.trim() : '',
          nitLleno: spanNIT && spanNIT.textContent && spanNIT.textContent.trim().length > 0 && spanNIT.textContent.trim() !== '0',
          descripcionExiste: !!spanDescripcion,
          descripcionContenido: spanDescripcion ? spanDescripcion.textContent?.trim() : '',
          descripcionLleno: spanDescripcion && spanDescripcion.textContent && spanDescripcion.textContent.trim().length > 0
        };
      });
      
      // Esperar a que ambos campos estén llenos
      if (estado.nitLleno && estado.descripcionLleno) {
        console.log(`✅ Campos llenados después de ${intentos * 0.5} segundos`);
        console.log(`   - NIT: "${estado.nitContenido}"`);
        console.log(`   - Descripción: "${estado.descripcionContenido}"`);
        break;
      }
      
      if (intentos % 10 === 0) { // Log cada 5 segundos
        console.log(`⏳ Intento ${intentos}/${maxIntentos}`);
        console.log(`   - NIT: ${estado.nitLleno ? '✅' : '❌'} "${estado.nitContenido}"`);
        console.log(`   - Descripción: ${estado.descripcionLleno ? '✅' : '❌'} "${estado.descripcionContenido}"`);
      }
      
      intentos++;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (intentos >= maxIntentos) {
      throw new Error(`Timeout: Los campos no se llenaron después de ${maxIntentos * 0.5} segundos`);
    }
    
    console.log("Datos cargados, extrayendo información...");
    
    // Extraer NIT y Descripción
    const datos = await frame.evaluate(() => {
      const spanNIT = document.querySelector('#span_vIN_VINVEN1NIT');
      const spanDescripcion = document.querySelector('#span_vIN_VINVEN1DESCRIPCION');
      const tdNIT = document.querySelector("body > form > div > div > table > tbody > tr > td > table > tbody > tr:nth-child(6) > td > fieldset > table > tbody > tr:nth-child(1) > td:nth-child(2)");
      const tdDescripcion = document.querySelector("body > form > div > div > table > tbody > tr > td > table > tbody > tr:nth-child(6) > td > fieldset > table > tbody > tr:nth-child(3) > td:nth-child(2)");
      
      return {
        nit: spanNIT?.textContent?.trim() || tdNIT?.textContent?.trim() || '',
        descripcion: spanDescripcion?.textContent?.trim() || tdDescripcion?.textContent?.trim() || ''
      };
    });
    
    console.log(`NIT extraído: "${datos.nit}"`);
    console.log(`Descripción extraída: "${datos.descripcion}"`);

    console.log(`[${new Date().toISOString()}] Scraping exitoso para placa: ${placa}`);
    
    // Respuesta exitosa
    res.status(200).json({ 
      ok: true,
      placa,
      nit: datos.nit,
      descripcion: datos.descripcion
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

