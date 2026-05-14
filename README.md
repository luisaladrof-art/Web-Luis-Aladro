# Web Luis Aladro

Web estática moderna en HTML, CSS y JavaScript para perfil profesional, currículum, artículos publicados, acceso privado y chatbot alimentado por una base local de conocimiento.

## Archivos

- `index.html`: estructura de la página.
- `styles.css`: diseño responsive y estética ventas/marketing/IA.
- `script.js`: navegación, editor privado, publicación de artículos en localStorage y chatbot.
- Base local de conocimiento del chatbot.
- `assets/Portada2.jpg`: imagen de portada.

## Acceso privado

- Usuario: `Aladro`
- Contraseña: `L4l4dr0#26`

## Uso

Abre `index.html` en un navegador moderno. Para que el chatbot pueda cargar la base local de conocimiento mediante `fetch`, es recomendable servir la carpeta con un servidor local, por ejemplo:

```bash
python -m http.server 8000
```

Después abre `http://localhost:8000`.

## Nota técnica

Esta versión es estática: los artículos se guardan en `localStorage` del navegador. Para publicar artículos de forma persistente en internet y proteger credenciales de forma real, se debe conectar a un backend con base de datos, autenticación segura y almacenamiento de imágenes.
