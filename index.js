const express = require('express');
const path = require('path');
const oracledb = require('oracledb');
require('dotenv').config();
const multer = require('multer');
const QRCode = require('qrcode');




// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads');
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });


const app = express();
const port = process.env.PORT || 3000;

if (!process.env.ORACLE_USER || !process.env.ORACLE_PASSWORD || !process.env.ORACLE_CONNECT_STRING) {
  console.error('❌ ERROR: Faltan variables de entorno ORACLE_USER, ORACLE_PASSWORD o ORACLE_CONNECT_STRING.');
  process.exit(1);
}

app.use(express.urlencoded({ extended: true }));
app.use(express.static('views'));

// Middleware simple de autenticación (sin sesiones por ahora)
function authMiddleware(req, res, next) {
  next();
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.post('/', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(401).send(`<h2>❌ Login fallido: Debes proporcionar usuario y contraseña.</h2>`);
  }

  try {
    const connection = await oracledb.getConnection({
      user: username,
      password: password,
      connectString: process.env.ORACLE_CONNECT_STRING
    });
    await connection.close();

    console.log(`✅ Usuario "${username}" autenticado con éxito.`);
    res.redirect('/procedimientos');
  } catch (err) {
    console.error(`❌ Error de login para "${username}":`, err.message);
    res.status(401).send(`<h2>❌ Login fallido: Credenciales inválidas o error de conexión.</h2>`);
  }
});
app.get('/logout', (req, res) => {
  // Aquí podrías limpiar sesión si estuvieras usando cookies o sessions
  console.log('🔓 Usuario cerró sesión.');
  res.redirect('/');
});
app.get('/procedimientos', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'procedimientos.html'));
});


app.get('/nuevo-estudiante', async (req, res) => {
  try {
    const connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    });

    const carreras = await connection.execute(`SELECT id_car, nombre_car FROM carrera`);
    const clubes = await connection.execute(`SELECT id_club, nombre_club FROM club`);
    await connection.close();

    const carreraOptions = carreras.rows.map(c => `<option value="${c[0]}">${c[1]}</option>`).join('');
    const clubOptions = clubes.rows.map(c => `<option value="${c[0]}">${c[1]}</option>`).join('');

    res.send(`
      <h2>📋 Nuevo Estudiante</h2>
      <form action="/guardar-estudiante" method="POST" enctype="multipart/form-data">
        <label>DNI:</label><br>
        <input type="text" name="dni_estu" required><br><br>

        <label>Nombres:</label><br>
        <input type="text" name="nombres" required><br><br>

        <label>Apellidos:</label><br>
        <input type="text" name="apellidos" required><br><br>

        <label>Carrera:</label><br>
        <select name="id_car">${carreraOptions}</select><br><br>

        <label>Club:</label><br>
        <select name="id_club">${clubOptions}</select><br><br>

        <label>Foto:</label><br>
        <input type="file" name="foto" accept="image/*" required><br><br>

        <button type="submit">Guardar</button>
      </form>
    `);
  } catch (err) {
    res.status(500).send(`Error al cargar formulario: ${err.message}`);
  }
});
app.post('/guardar-estudiante', upload.single('foto'), async (req, res) => {
  const { dni_estu, nombres, apellidos, id_car, id_club } = req.body;
  const fotoPath = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    });

    const sql = `
      INSERT INTO estudiante (dni_estu, nombres, apellidos, id_car, id_club, foto)
      VALUES (:dni, :nom, :ape, :car, :club, :foto)
    `;

    await connection.execute(sql, {
      dni: dni_estu,
      nom: nombres,
      ape: apellidos,
      car: id_car || null,
      club: id_club || null,
      foto: fotoPath
    }, { autoCommit: true });

    await connection.close();
    res.send(`<h3>✅ Estudiante guardado correctamente</h3><a href="/nuevo-estudiante">← Volver</a>`);
  } catch (err) {
    console.error(err);
    res.status(500).send(`❌ Error al guardar: ${err.message}`);
  }
});
app.use('/qr_generados', express.static(path.join(__dirname, 'public/qr_generados')));

const { generarQRConFotoCentro } = require('./qrHelper');


app.get('/estudiantes', async (req, res) => {
  try {
    const connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    });

    const result = await connection.execute(`
      SELECT 
        e.dni_estu, 
        e.nombres, 
        e.apellidos, 
        c.nombre_car, 
        cl.nombre_club, 
        e.foto
      FROM estudiante e
      LEFT JOIN carrera c ON e.id_car = c.id_car
      LEFT JOIN club cl ON e.id_club = cl.id_club
      ORDER BY e.apellidos
    `);

    await connection.close();

    const rowsHTML = await Promise.all(result.rows.map(async row => {
  const [dni, nombres, apellidos, carrera, club, foto] = row;

  // Nombre de la imagen
  const nombreFoto = foto.split('/').pop(); // "234423423.png"
  const nombreQR = `${dni}.png`;

  // Generar QR personalizado (solo si no existe)
  const qrPath = path.join(__dirname, 'public/qr_generados', nombreQR);
  if (!fs.existsSync(qrPath)) {
    await generarQRConFotoCentro(dni, nombreFoto, nombreQR);
  }

  const urlQR = `/qr_generados/${nombreQR}`;

  return `
    <tr>
      <td>${dni}</td>
      <td>${nombres} ${apellidos}</td>
      <td>${carrera || '-'}</td>
      <td>${club || '-'}</td>
      <td><img src="${foto}" width="80" style="object-fit:cover;border-radius:8px;"></td>
      <td><img src="${urlQR}" width="120"></td>
    </tr>
  `;
}));



    res.send(`
      <h2>📚 Lista de Estudiantes</h2>
      <table border="1" cellpadding="5" cellspacing="0">
        <thead>
          <tr>
            <th>DNI</th>
            <th>Nombre Completo</th>
            <th>Carrera</th>
            <th>Club</th>
            <th>Foto</th>
            <th>QR</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>
      <br><a href="/nuevo-estudiante">➕ Agregar otro estudiante</a>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send(`❌ Error al listar estudiantes: ${err.message}`);
  }
});



app.get('/estudiante/:dni', async (req, res) => {
  const { dni } = req.params;
  const hora = new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });

  try {
    const connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    });

    const result = await connection.execute(`
      SELECT 
        e.dni_estu, 
        e.nombres, 
        e.apellidos, 
        c.nombre_car, 
        cl.nombre_club, 
        e.foto
      FROM estudiante e
      LEFT JOIN carrera c ON e.id_car = c.id_car
      LEFT JOIN club cl ON e.id_club = cl.id_club
      WHERE e.dni_estu = :dni
    `, [dni]);

    await connection.close();

    if (result.rows.length === 0) {
      return res.status(404).send(`<h3>❌ Estudiante no encontrado</h3>`);
    }

    const [dni_estu, nombres, apellidos, carrera, club, foto] = result.rows[0];

    res.send(`
      <h2>🎓 Datos del Estudiante</h2>
      <img src="${foto}" width="150" style="border-radius:10px; object-fit:cover;"><br><br>
      <strong>DNI:</strong> ${dni_estu}<br>
      <strong>Nombre:</strong> ${nombres} ${apellidos}<br>
      <strong>Carrera:</strong> ${carrera || '-'}<br>
      <strong>Club:</strong> ${club || '-'}<br>
      <strong>Hora del escaneo:</strong> ${hora}<br>
      <br><a href="/estudiantes">← Volver a lista</a>
    `);
  } catch (err) {
    res.status(500).send(`<h2>❌ Error:</h2><pre>${err.message}</pre>`);
  }
});

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));


app.get('/tablas', authMiddleware, async (req, res) => {
  try {
    const connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    });

    const result = await connection.execute(`SELECT table_name FROM user_tables ORDER BY table_name`);
    await connection.close();

    const tablasHTML = result.rows.map(row => 
      `<li><a href="/tablas/${row[0]}">${row[0]}</a></li>`
    ).join('');

    res.send(`
      <h2>📋 Listado de Tablas</h2>
      <ul>${tablasHTML}</ul>
      <br><a href="/procedimientos">← Volver</a>
    `);
  } catch (err) {
    console.error('❌ Error al obtener tablas:', err);
    res.status(500).send(`<h2>❌ Error al obtener tablas:</h2><pre>${err.message}</pre>`);
  }
});
app.get('/tablas/:nombreTabla', authMiddleware, async (req, res) => {
  const { nombreTabla } = req.params;

  try {
    const connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    });

    const result = await connection.execute(`
      SELECT column_name FROM user_tab_columns WHERE table_name = :tabla ORDER BY column_id
    `, [nombreTabla.toUpperCase()]);

    await connection.close();

    const columnasHTML = result.rows.map(row => `
      <label><input type="checkbox" name="columnas" value="${row[0]}"> ${row[0]}</label><br>
    `).join('');

    res.send(`
      <h2>📄 Columnas de la tabla: ${nombreTabla}</h2>
<form action="/ver-datos/${nombreTabla}" method="POST">
  ${columnasHTML}
  <br>
  <label>Separador:</label>
  <select name="separador">
    <option value=",">Coma (,)</option>
    <option value=";">Punto y coma (;)</option>
    <option value=" ">Espacio</option>
    <option value="\\">Barra invertida (\\)</option>
    <option value="tab">Tabulación</option>
    <option value="linea">Uno por línea</option>
  </select>
  <br><br>
  <button type="submit" name="accion" value="ver">🔍 Ver datos</button>
  <button type="submit" name="accion" value="descargar">💾 Descargar archivo</button>
</form>

      <br><a href="/tablas">← Volver</a>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send(`<h2>❌ Error al obtener columnas:</h2><pre>${err.message}</pre>`);
  }
});

const fs = require('fs');
const os = require('os');

app.post('/ver-datos/:tabla', authMiddleware, async (req, res) => {
  const { tabla } = req.params;
  const columnas = req.body.columnas;
  const separadorInput = req.body.separador || ',';
  const accion = req.body.accion;

  if (!columnas) {
    return res.send(`<h3>⚠️ Debes seleccionar al menos una columna.</h3><a href="/tablas/${tabla}">← Volver</a>`);
  }

  const columnasSeleccionadas = Array.isArray(columnas) ? columnas : [columnas];

  const separadorMap = {
    ',': ',',
    ';': ';',
    ' ': ' ',
    '\\': '\\',
    'tab': '\t',
    'linea': os.EOL
  };
  const separador = separadorMap[separadorInput] || ',';

  try {
    const connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    });

    const colsSQL = columnasSeleccionadas.map(col => `"${col}"`).join(', ');
    const query = `SELECT ${colsSQL} FROM "${tabla}" FETCH FIRST 50 ROWS ONLY`;
    const result = await connection.execute(query);
    await connection.close();

    const content = result.rows.map(row => row.join(separador)).join(os.EOL);

    if (accion === 'ver') {
      return res.send(`
        <h2>📄 Resultado de ${tabla}</h2>
        <textarea rows="15" cols="100" readonly>${content}</textarea>
        <br><a href="/tablas/${tabla}">← Volver</a>
      `);
    } else if (accion === 'descargar') {
      const filename = `datos_${tabla}.txt`;
      const filepath = path.join(__dirname, 'views', filename);
      fs.writeFileSync(filepath, content);
      return res.download(filepath, filename, (err) => {
        if (err) console.error('❌ Error al descargar:', err);
        fs.unlinkSync(filepath); // borrar temporal
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send(`<h2>❌ Error:</h2><pre>${err.message}</pre>`);
  }
});

app.use('/qr_generados', express.static(path.join(__dirname, 'public/qr_generados')));




app.listen(port,'0.0.0.0',() => {
  console.log(`✅ Servidor iniciado en http://localhost:${port}/`);
});
