# Mateando 🧉

**Mateando** es una aplicación web inteligente diseñada para solucionar los problemas típicos de una ronda de mates:
- Saber exactamente a quién le toca el siguiente mate.
- Evitar que la persona que tiene el mate "se duerma" o que el mate se enfríe, mediante un cronómetro con alarma sonora configurable.
- Permitir que los integrantes puedan bajarse de la ronda con el botón rojo **"No quiero más"** (o "¡Gracias!"), quedando descartados de las vueltas siguientes.
- Configurar frecuencias de toma personalizadas (por ejemplo: toma siempre, saltea 1 vuelta, saltea 2 vueltas).
- Manejar modalidades de ronda: **En círculo (secuencial)** o **Aleatoria sin repetición por vuelta**.
- Guardar grupos para volver a usarlos en futuras mateadas (**Ronda Guardada**), crear **Nuevas Rondas** o iniciar al instante con una **Ronda Rápida**.

---

## 🎨 Identidad Visual y Responsive Design
- **Fondo general:** Verde claro agua (`#d8efe9`) con ambientación de mate, yerba, bombilla y termo.
- **Botones de acción:** Verde manzana con tipografía blanca (`#ffffff`).
- **Botón de exclusión:** Rojo (`#e63946`) para "No quiero más".
- **Responsive:** Adaptable a computadoras, tablets y teléfonos celulares.

---

## 🚀 Cómo ejecutar la aplicación

1. **Instalar dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Iniciar el servidor:**
   ```bash
   python run.py
   ```

3. **Abrir en el navegador:**
   - En tu computadora: [http://localhost:8000](http://localhost:8000)
   - Desde tu celular o tablet en la misma red Wi-Fi: `http://<IP-DE-TU-PC>:8000`
