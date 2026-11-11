// Función de Vercel: descarga el menú Haurreskola (castellano) de la web del colegio
// y lo devuelve a la app junto con la fecha en que el colegio lo subió.
// La web del colegio no permite que otras webs lean sus archivos directamente (CORS),
// por eso pasa por aquí.

const MENU_URL = 'https://www.colegiotrueba.net/menucomedor/0-HAURRESKOLA/0-HAURRESKOLA-1.jpg';

module.exports = async (req, res) => {
  try {
    const r = await fetch(MENU_URL, { headers: { 'User-Agent': 'casa-pwa' } });
    if (!r.ok) {
      res.status(502).json({ error: 'El colegio respondió ' + r.status });
      return;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('X-Menu-Modified', r.headers.get('last-modified') || '');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(buf);
  } catch (err) {
    res.status(502).json({ error: 'No se pudo descargar el menú: ' + err.message });
  }
};
