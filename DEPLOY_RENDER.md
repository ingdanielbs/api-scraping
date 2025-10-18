# 🚀 Guía de Despliegue en Render

Esta guía te llevará paso a paso para desplegar tu API en Render.com.

## ✅ Pre-requisitos

- Cuenta de GitHub
- Código subido a un repositorio de GitHub
- Cuenta en Render.com (gratuita)

## 📦 Paso 1: Subir Código a GitHub

Si aún no has subido tu código a GitHub:

```bash
# Inicializar repositorio Git
git init

# Agregar todos los archivos
git add .

# Hacer commit
git commit -m "API Scraping SENA - Lista para Render"

# Crear repositorio en GitHub y conectarlo
# (Reemplaza con tu URL de repositorio)
git remote add origin https://github.com/TU_USUARIO/api-scraping-sena.git
git branch -M main
git push -u origin main
```

## 🌐 Paso 2: Crear Cuenta en Render

1. Ve a [https://render.com](https://render.com)
2. Click en **"Get Started for Free"**
3. Regístrate con:
   - GitHub (recomendado)
   - O email

## 🔧 Paso 3: Crear Web Service

1. En el Dashboard de Render, click en **"New +"**
2. Selecciona **"Web Service"**

### Conectar Repositorio

3. Click en **"Connect a repository"**
4. Autoriza a Render a acceder a tu GitHub
5. Busca y selecciona tu repositorio: `api-scraping-sena`
6. Click en **"Connect"**

### Configurar el Servicio

7. **Name**: `api-scraping-sena` (o el nombre que prefieras)
8. **Region**: 
   - Oregon (recomendado para Latinoamérica)
   - Frankfurt (si estás en Europa)
9. **Branch**: `main`
10. **Runtime**: Render detectará automáticamente **Docker** ✅
11. **Build Command**: (Dejar vacío, Docker lo maneja)
12. **Start Command**: (Dejar vacío, Docker lo maneja)

### Seleccionar Plan

13. **Instance Type**: **Free** (suficiente para empezar)
    - 512 MB RAM
    - CPU compartida
    - 750 horas gratis/mes
    - Se duerme después de 15 min de inactividad

### Variables de Entorno (Opcional)

14. Si necesitas agregar variables:
    - Click en **"Add Environment Variable"**
    - Por ahora no es necesario

### Crear el Servicio

15. Click en **"Create Web Service"** (botón azul abajo)

## ⏳ Paso 4: Esperar el Deploy

Render ahora comenzará a:

1. **Clonar tu repositorio** (~5 segundos)
2. **Detectar el Dockerfile** (~2 segundos)
3. **Construir la imagen Docker** (~5-8 minutos)
   - Instalar Node.js
   - Instalar dependencias del sistema (Chromium, libnss3, etc.)
   - Instalar npm dependencies
   - Descargar Chromium para Puppeteer
4. **Desplegar el servicio** (~30 segundos)

**Total: ~8-10 minutos en el primer deploy** ⏱️

Puedes seguir el progreso en la pestaña **"Logs"**.

## ✅ Paso 5: Verificar el Deploy

Una vez que veas:
```
==> Your service is live 🎉
```

Tu API estará disponible en una URL como:
```
https://api-scraping-sena.onrender.com
```

### Probar el Endpoint

1. **Health Check**:
```bash
curl https://api-scraping-sena.onrender.com/
```

Respuesta esperada:
```json
{
  "ok": true,
  "message": "API Scraping SENA - Funcionando",
  "endpoints": {
    "consultar": "/api/consultar?placa=TU_PLACA"
  }
}
```

2. **Consultar una Placa**:
```bash
curl "https://api-scraping-sena.onrender.com/api/consultar?placa=94021016642"
```

Respuesta esperada (tarda 10-30 segundos):
```json
{
  "ok": true,
  "placa": "94021016642",
  "descripcion": "COMPUTADOR PORTATIL HP..."
}
```

## 📊 Paso 6: Monitorear tu Servicio

### Ver Logs en Tiempo Real

1. En el Dashboard de Render, ve a tu servicio
2. Click en la pestaña **"Logs"**
3. Verás todos los logs en tiempo real:
```
🚀 Servidor corriendo en puerto 3000
📡 API disponible en: http://localhost:3000/api/consultar
[2025-10-18T17:30:00.000Z] Iniciando scraping para placa: 94021016642
[2025-10-18T17:30:15.000Z] Scraping exitoso para placa: 94021016642
```

### Métricas

En la pestaña **"Metrics"** verás:
- CPU usage
- Memory usage
- Response times
- Requests per minute

## 🔄 Actualizaciones Futuras

Cada vez que hagas push a GitHub, Render automáticamente:
1. Detectará el cambio
2. Hará rebuild
3. Desplegará la nueva versión
4. **Sin downtime** (zero-downtime deployment)

```bash
# Hacer cambios en tu código
git add .
git commit -m "Mejoras en el scraping"
git push

# Render automáticamente despliega 🎉
```

## ⚠️ Consideraciones del Plan Free

### Limitaciones

- ✅ **750 horas gratis/mes** (suficiente para 1 servicio 24/7)
- ⚠️ **Se duerme después de 15 minutos** de inactividad
- ⚠️ **Primera petición tarda 30-60 segundos** al despertar
- ✅ **Sin límite de peticiones** mientras esté activo
- ✅ **No requiere tarjeta de crédito**

### Mantenerlo Activo (Opcional)

Si necesitas que esté siempre activo, puedes:

**Opción 1**: Usar un servicio de ping gratuito
- [UptimeRobot](https://uptimerobot.com) (gratuito)
- Configura un monitor cada 14 minutos
- Tu servicio nunca se dormirá

**Opción 2**: Actualizar a plan Starter ($7/mes)
- Siempre activo
- 512 MB RAM
- Sin tiempo de "wake up"

## 🐛 Solución de Problemas

### Build falla

**Error**: `Cannot find Dockerfile`
- **Solución**: Asegúrate que `Dockerfile` esté en la raíz del repo

**Error**: `npm install failed`
- **Solución**: Verifica que `package.json` sea válido

### Deploy exitoso pero 503 Service Unavailable

- **Causa**: El servicio está iniciando
- **Solución**: Espera 30-60 segundos más

### Timeout en peticiones

- **Causa**: Scraping tarda mucho + servicio dormido
- **Solución**: 
  - Aumenta timeouts en `server.js`
  - O mantén el servicio activo con UptimeRobot

### Ver logs detallados

1. Dashboard → Tu servicio → **Logs**
2. Busca errores en rojo
3. Copia y revisa el stack trace

## 📈 Actualizar a Plan Paid (Opcional)

Si tu proyecto crece:

### Plan Starter ($7/mes)
- Siempre activo (no se duerme)
- 512 MB RAM
- CPU compartida mejorada

### Plan Standard ($25/mes)
- 2 GB RAM
- CPU dedicada
- Mejor para alto tráfico

## 🎉 ¡Listo!

Tu API ya está desplegada y funcionando en Render. 

**URL de tu API**: Encuéntrala en el Dashboard de Render (arriba)

¿Preguntas? Revisa la [documentación oficial de Render](https://render.com/docs)

