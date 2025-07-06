const express = require('express');
const path = require('path');
const oracledb = require('oracledb');
require('dotenv').config();
const multer = require('multer');
const QRCode = require('qrcode');


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
     await connection.execute(
      `INSERT INTO sesiones (usuario) VALUES (:usuario)`,
      [username],
      { autoCommit: true }
    );
    await connection.close();

    console.log(`✅ Usuario "${username}" autenticado con éxito.`);
    res.redirect('/procedimientos');
  } catch (err) {
    console.error(`❌ Error de login para "${username}":`, err.message);
    res.status(401).send(`<h2>❌ Login fallido: Credenciales inválidas o error de conexión.</h2>`);
  }
});
app.get('/logout', (req, res) => {
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
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Nuevo Estudiante - Oracle System</title>
          <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

              :root {
                  --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  --secondary-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                  --success-gradient: linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%);
                  --danger-gradient: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
                  --glass-bg: rgba(255, 255, 255, 0.1);
                  --glass-border: rgba(255, 255, 255, 0.2);
                  --text-primary: #2d3748;
                  --text-secondary: #718096;
                  --shadow-sm: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                  --shadow-md: 0 10px 25px -3px rgba(0, 0, 0, 0.1);
                  --shadow-lg: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                  --shadow-xl: 0 35px 60px -12px rgba(0, 0, 0, 0.3);
              }

              * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
              }

              body {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
                  background-size: 400% 400%;
                  animation: gradientShift 15s ease infinite;
                  min-height: 100vh;
                  padding: 20px;
                  color: var(--text-primary);
                  line-height: 1.6;
              }

              @keyframes gradientShift {
                  0% { background-position: 0% 50%; }
                  50% { background-position: 100% 50%; }
                  100% { background-position: 0% 50%; }
              }

              .container {
                  max-width: 800px;
                  margin: 0 auto;
                  animation: slideInUp 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
              }

              @keyframes slideInUp {
                  from {
                      opacity: 0;
                      transform: translateY(60px);
                  }
                  to {
                      opacity: 1;
                      transform: translateY(0);
                  }
              }

              .header {
                  background: var(--glass-bg);
                  backdrop-filter: blur(20px);
                  border-radius: 24px;
                  padding: 40px;
                  margin-bottom: 30px;
                  box-shadow: var(--shadow-lg);
                  border: 1px solid var(--glass-border);
                  text-align: center;
                  position: relative;
                  overflow: hidden;
              }

              .header::before {
                  content: '';
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
                  transform: translateX(-100%);
                  animation: shimmer 3s infinite;
              }

              @keyframes shimmer {
                  0% { transform: translateX(-100%); }
                  100% { transform: translateX(100%); }
              }

              .header-icon {
                  font-size: 3.5rem;
                  margin-bottom: 20px;
                  display: inline-block;
                  animation: float 3s ease-in-out infinite;
                  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
              }

              @keyframes float {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(-10px); }
              }

              .header h1 {
                  background: var(--primary-gradient);
                  -webkit-background-clip: text;
                  -webkit-text-fill-color: transparent;
                  background-clip: text;
                  font-size: 2.5rem;
                  font-weight: 800;
                  margin-bottom: 10px;
                  letter-spacing: -0.02em;
              }

              .subtitle {
                  color: rgba(255, 255, 255, 0.8);
                  font-size: 1.1rem;
                  font-weight: 400;
              }

              .form-container {
                  background: var(--glass-bg);
                  backdrop-filter: blur(20px);
                  border-radius: 24px;
                  padding: 40px;
                  margin-bottom: 30px;
                  box-shadow: var(--shadow-lg);
                  border: 1px solid var(--glass-border);
                  position: relative;
              }

              .form-container:hover {
                  transform: translateY(-2px);
                  box-shadow: var(--shadow-xl);
                  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
              }

              .form-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                  gap: 25px;
                  margin-bottom: 30px;
              }

              .form-group {
                  position: relative;
              }

              .form-group label {
                  display: block;
                  color: rgba(255, 255, 255, 0.9);
                  font-weight: 600;
                  margin-bottom: 8px;
                  font-size: 1rem;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
              }

              .form-control {
                  width: 100%;
                  padding: 18px 24px;
                  font-size: 1.1rem;
                  border: 2px solid rgba(255, 255, 255, 0.3);
                  border-radius: 16px;
                  background: rgba(255, 255, 255, 0.9);
                  color: var(--text-primary);
                  outline: none;
                  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                  backdrop-filter: blur(10px);
                  font-family: inherit;
              }

              .form-control:focus {
                  border-color: #667eea;
                  background: white;
                  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
                  transform: translateY(-2px);
              }

              .form-control:hover {
                  border-color: rgba(255, 255, 255, 0.5);
                  transform: translateY(-1px);
              }

              .form-control::placeholder {
                  color: var(--text-secondary);
              }

              select.form-control {
                  cursor: pointer;
              }

              select.form-control option {
                  background: white;
                  color: var(--text-primary);
                  padding: 10px;
              }

              .file-input-wrapper {
                  position: relative;
                  overflow: hidden;
                  display: inline-block;
                  width: 100%;
              }

              .file-input-wrapper input[type=file] {
                  position: absolute;
                  left: -9999px;
              }

              .file-input-label {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 15px;
                  padding: 20px;
                  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1));
                  border: 2px dashed rgba(255, 255, 255, 0.5);
                  border-radius: 16px;
                  cursor: pointer;
                  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                  color: white;
                  font-weight: 600;
                  text-align: center;
              }

              .file-input-label:hover {
                  background: linear-gradient(135deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.2));
                  border-color: rgba(255, 255, 255, 0.7);
                  transform: translateY(-2px);
              }

              .file-input-label .icon {
                  font-size: 1.5rem;
              }

              .btn {
                  padding: 18px 36px;
                  font-size: 1.1rem;
                  font-weight: 600;
                  border: none;
                  border-radius: 16px;
                  cursor: pointer;
                  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                  position: relative;
                  overflow: hidden;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  font-family: inherit;
              }

              .btn-primary {
                  background: var(--success-gradient);
                  color: white;
                  box-shadow: var(--shadow-md);
                  width: 100%;
                  margin-top: 20px;
              }

              .btn-primary::before {
                  content: '';
                  position: absolute;
                  top: 0;
                  left: -100%;
                  width: 100%;
                  height: 100%;
                  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                  transition: left 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
              }

              .btn-primary:hover::before {
                  left: 100%;
              }

              .btn-primary:hover {
                  transform: translateY(-4px) scale(1.02);
                  box-shadow: var(--shadow-xl);
              }

              .btn-primary:active {
                  transform: translateY(-2px) scale(1.01);
              }

              .btn-secondary {
                  background: rgba(255, 255, 255, 0.1);
                  color: white;
                  border: 2px solid rgba(255, 255, 255, 0.3);
                  margin-right: 15px;
              }

              .btn-secondary:hover {
                  background: rgba(255, 255, 255, 0.2);
                  border-color: rgba(255, 255, 255, 0.5);
                  transform: translateY(-2px);
              }

              .actions {
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  gap: 15px;
                  margin-top: 30px;
              }

              .back-link {
                  color: rgba(255, 255, 255, 0.8);
                  text-decoration: none;
                  font-weight: 500;
                  display: flex;
                  align-items: center;
                  gap: 10px;
                  transition: all 0.3s ease;
              }

              .back-link:hover {
                  color: white;
                  transform: translateX(-5px);
              }

              /* Particles Background */
              .particles {
                  position: fixed;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  pointer-events: none;
                  z-index: -1;
              }

              .particle {
                  position: absolute;
                  width: 4px;
                  height: 4px;
                  background: rgba(255, 255, 255, 0.3);
                  border-radius: 50%;
                  animation: float-particle 8s infinite linear;
              }

              @keyframes float-particle {
                  0% {
                      transform: translateY(100vh) rotate(0deg);
                      opacity: 0;
                  }
                  10% {
                      opacity: 1;
                  }
                  90% {
                      opacity: 1;
                  }
                  100% {
                      transform: translateY(-100px) rotate(360deg);
                      opacity: 0;
                  }
              }

              /* Responsive */
              @media (max-width: 768px) {
                  .container {
                      padding: 10px;
                  }

                  .header {
                      padding: 30px 20px;
                  }

                  .form-container {
                      padding: 25px 20px;
                  }

                  .form-grid {
                      grid-template-columns: 1fr;
                      gap: 20px;
                  }

                  .header h1 {
                      font-size: 2rem;
                  }

                  .actions {
                      flex-direction: column;
                  }

                  .btn-secondary {
                      margin-right: 0;
                      margin-bottom: 10px;
                      width: 100%;
                  }
              }

              /* Form validation styles */
              .form-control:invalid {
                  border-color: #fa709a;
              }

              .form-control:valid {
                  border-color: #56ab2f;
              }

              /* Loading state */
              .btn-primary:disabled {
                  opacity: 0.7;
                  cursor: not-allowed;
                  transform: none;
              }

              .btn-primary.loading::after {
                  content: '';
                  width: 20px;
                  height: 20px;
                  border: 2px solid transparent;
                  border-top: 2px solid white;
                  border-radius: 50%;
                  display: inline-block;
                  animation: spin 1s linear infinite;
                  margin-left: 10px;
              }

              @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
              }
          </style>
      </head>
      <body>
          <!-- Particles Background -->
          <div class="particles" id="particles"></div>

          <div class="container">
              <div class="header">
                  <div class="header-icon">👨‍🎓</div>
                  <h1>Nuevo Estudiante</h1>
                  <p class="subtitle">Registro completo de estudiante en el sistema Oracle</p>
              </div>

              <div class="form-container">
                  <form action="/guardar-estudiante" method="POST" enctype="multipart/form-data" id="studentForm">
                      <div class="form-grid">
                          <div class="form-group">
                              <label for="dni_estu">🆔 DNI / Cédula</label>
                              <input type="text" id="dni_estu" name="dni_estu" class="form-control" 
                                     placeholder="Ingrese el DNI del estudiante" 
                                     pattern="[0-9]{10}" 
                                     maxlength="10" 
                                     required>
                          </div>

                          <div class="form-group">
                              <label for="nombres">👤 Nombres</label>
                              <input type="text" id="nombres" name="nombres" class="form-control" 
                                     placeholder="Nombres del estudiante" 
                                     pattern="[A-Za-zÀ-ÿ\\s]+" 
                                     required>
                          </div>

                          <div class="form-group">
                              <label for="apellidos">👥 Apellidos</label>
                              <input type="text" id="apellidos" name="apellidos" class="form-control" 
                                     placeholder="Apellidos del estudiante" 
                                     pattern="[A-Za-zÀ-ÿ\\s]+" 
                                     required>
                          </div>

                          <div class="form-group">
                              <label for="id_car">🎓 Carrera</label>
                              <select id="id_car" name="id_car" class="form-control" required>
                                  <option value="">Seleccione una carrera</option>
                                  ${carreraOptions}
                              </select>
                          </div>

                          <div class="form-group">
                              <label for="id_club">🏆 Club</label>
                              <select id="id_club" name="id_club" class="form-control" required>
                                  <option value="">Seleccione un club</option>
                                  ${clubOptions}
                              </select>
                          </div>

                          <div class="form-group">
                              <label>📸 Foto del Estudiante</label>
                              <div class="file-input-wrapper">
                                  <input type="file" id="foto" name="foto" accept="image/*" required>
                                  <label for="foto" class="file-input-label">
                                      <span class="icon">📁</span>
                                      <span id="file-text">Seleccionar foto (JPG, PNG)</span>
                                  </label>
                              </div>
                          </div>
                      </div>

                      <div class="actions">
                          <a href="/procedimientos" class="btn btn-secondary">
                              ← Volver al inicio
                          </a>
                          <button type="submit" class="btn btn-primary" id="submitBtn">
                              💾 Guardar Estudiante
                          </button>
                      </div>
                  </form>
              </div>
          </div>

          <script>
              // Particle system
              function createParticles() {
                  const particlesContainer = document.getElementById('particles');
                  const particleCount = 30;

                  for (let i = 0; i < particleCount; i++) {
                      const particle = document.createElement('div');
                      particle.className = 'particle';
                      particle.style.left = Math.random() * 100 + '%';
                      particle.style.animationDelay = Math.random() * 8 + 's';
                      particle.style.animationDuration = (Math.random() * 3 + 5) + 's';
                      particlesContainer.appendChild(particle);
                  }
              }

              // Initialize particles
              createParticles();

              // DNI validation
              document.getElementById('dni_estu').addEventListener('input', function(e) {
                  const value = e.target.value.replace(/\\D/g, '');
                  e.target.value = value.slice(0, 10);
              });

              // Names validation (only letters and spaces)
              function validateText(element) {
                  element.addEventListener('input', function(e) {
                      const value = e.target.value.replace(/[^A-Za-zÀ-ÿ\\s]/g, '');
                      e.target.value = value;
                  });
              }

              validateText(document.getElementById('nombres'));
              validateText(document.getElementById('apellidos'));

              // File input handling
              document.getElementById('foto').addEventListener('change', function(e) {
                  const fileName = e.target.files[0]?.name || 'Seleccionar foto (JPG, PNG)';
                  document.getElementById('file-text').textContent = fileName;
              });

              // Form submission handling
              document.getElementById('studentForm').addEventListener('submit', function(e) {
                  const submitBtn = document.getElementById('submitBtn');
                  submitBtn.classList.add('loading');
                  submitBtn.disabled = true;
                  submitBtn.innerHTML = '⏳ Guardando...';
              });

              // Form validation feedback
              const inputs = document.querySelectorAll('.form-control');
              inputs.forEach(input => {
                  input.addEventListener('blur', function() {
                      if (this.checkValidity()) {
                          this.style.borderColor = '#56ab2f';
                      } else {
                          this.style.borderColor = '#fa709a';
                      }
                  });
              });
          </script>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Error - Sistema Oracle</title>
          <style>
              body {
                  font-family: 'Inter', sans-serif;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  text-align: center;
                  padding: 20px;
              }
              .error-container {
                  background: rgba(255, 255, 255, 0.1);
                  backdrop-filter: blur(20px);
                  border-radius: 20px;
                  padding: 40px;
                  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                  border: 1px solid rgba(255, 255, 255, 0.2);
              }
              .error-icon {
                  font-size: 3rem;
                  margin-bottom: 20px;
              }
              h1 {
                  margin-bottom: 15px;
                  font-size: 1.8rem;
              }
              .btn {
                  display: inline-block;
                  padding: 12px 24px;
                  background: linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%);
                  color: white;
                  text-decoration: none;
                  border-radius: 12px;
                  margin-top: 20px;
                  font-weight: 600;
                  transition: transform 0.3s ease;
              }
              .btn:hover {
                  transform: translateY(-2px);
              }
          </style>
      </head>
      <body>
          <div class="error-container">
              <div class="error-icon">⚠️</div>
              <h1>Error al cargar el formulario</h1>
              <p>No se pudo conectar con la base de datos Oracle.</p>
              <p><strong>Detalle:</strong> ${err.message}</p>
              <a href="/" class="btn">← Volver al inicio</a>
          </div>
      </body>
      </html>
    `);
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
      const nombreFoto = foto.split('/').pop(); // 
      const nombreQR = `${dni}.png`;

      // Generar QR personalizado (solo si no existe)
      const qrPath = path.join(__dirname, 'public/qr_generados', nombreQR);
      if (!fs.existsSync(qrPath)) {
        await generarQRConFotoCentro(dni, nombreFoto, nombreQR);
      }

      const urlQR = `/qr_generados/${nombreQR}`;

      return `
        <tr class="student-row">
          <td class="dni-cell">${dni}</td>
          <td class="name-cell">${nombres} ${apellidos}</td>
          <td class="career-cell">${carrera || '<span class="no-data">Sin asignar</span>'}</td>
          <td class="club-cell">${club || '<span class="no-data">Sin club</span>'}</td>
          <td class="photo-cell">
            <div class="photo-container">
              <img src="${foto}" alt="Foto de ${nombres}" class="student-photo">
            </div>
          </td>
          <td class="qr-cell">
            <div class="qr-container">
              <img src="${urlQR}" alt="QR de ${dni}" class="qr-code">
            </div>
          </td>
        </tr>
      `;
    }));

    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lista de Estudiantes</title>
      </head>
      <style>

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Arial', sans-serif;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  min-height: 100vh;
  color: #333;
  line-height: 1.6;
}

/* Contenedor principal */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

/* Header */
.header {
  text-align: center;
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 15px;
  color: white;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
  font-weight: 300;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.header p {
  font-size: 1.1rem;
  opacity: 0.9;
  font-weight: 300;
}

/* Contenedor de tabla */
.table-container {
  background: white;
  border-radius: 15px;
  padding: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  margin-bottom: 30px;
  overflow-x: auto;
}

/* Tabla */
.students-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

/* Encabezados de tabla */
.students-table thead {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.students-table th {
  padding: 15px 12px;
  text-align: left;
  font-weight: 600;
  color: white;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border: none;
}

.students-table th:first-child {
  border-top-left-radius: 10px;
}

.students-table th:last-child {
  border-top-right-radius: 10px;
}

/* Filas de tabla */
.students-table tbody tr {
  background: white;
  transition: all 0.3s ease;
  border-bottom: 1px solid #eee;
}

.students-table tbody tr:hover {
  background: #f8f9ff;
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.students-table tbody tr:last-child {
  border-bottom: none;
}

/* Celdas de tabla */
.students-table td {
  padding: 15px 12px;
  vertical-align: middle;
  font-size: 0.9rem;
  border: none;
}

/* Fotos de estudiantes */
.student-photo {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 3px solid #667eea;
}

.student-photo:hover {
  transform: scale(1.1);
  border-color: #764ba2;
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

/* Códigos QR */
.qr-code {
  width: 40px;
  height: 40px;
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 8px;
  border: 2px solid #ddd;
}

.qr-code:hover {
  transform: scale(1.1);
  border-color: #667eea;
  box-shadow: 0 3px 10px rgba(102, 126, 234, 0.3);
}

/* Botón agregar estudiante */
.add-student-btn {
  display: inline-block;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 15px 30px;
  border-radius: 25px;
  text-decoration: none;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.3s ease;
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.add-student-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
}

/* Badges para clubes */
.club-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4px 12px;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: 500;
  display: inline-block;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* Responsivo */
@media (max-width: 768px) {
  .container {
    padding: 10px;
  }
  
  .header h1 {
    font-size: 2rem;
  }
  
  .header p {
    font-size: 1rem;
  }
  
  .table-container {
    padding: 15px;
  }
  
  .students-table th,
  .students-table td {
    padding: 10px 8px;
    font-size: 0.8rem;
  }
  
  .student-photo {
    width: 40px;
    height: 40px;
  }
  
  .qr-code {
    width: 35px;
    height: 35px;
  }
}

@media (max-width: 480px) {
  .header h1 {
    font-size: 1.8rem;
  }
  
  .students-table th,
  .students-table td {
    padding: 8px 6px;
    font-size: 0.75rem;
  }
  
  .add-student-btn {
    padding: 12px 25px;
    font-size: 0.9rem;
  }
}

/* Animaciones suaves */
@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.student-row {
  animation: slideInUp 0.6s ease forwards;
}

/* Scrollbar personalizada */
.table-container::-webkit-scrollbar {
  height: 8px;
}

.table-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}

.table-container::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 10px;
}

.table-container::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
}
      </style>
      <body>
        <div class="container">
          <div class="header">
            <h1>📚 Lista de Estudiantes</h1>
            <p>Gestión académica y control de acceso</p>
          </div>
          <div class="table-container">
            <table class="students-table">
              <thead>
                <tr>
                  <th>DNI</th>
                  <th>Nombre Completo</th>
                  <th>Carrera</th>
                  <th>Club</th>
                  <th>Foto</th>
                  <th>Código QR</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHTML.join('')}
              </tbody>
            </table>
          </div>

          <div style="text-align: center; padding-bottom: 30px;">
            <a href="/nuevo-estudiante" class="add-student-btn">
              ➕ Agregar Nuevo Estudiante
            </a>
          </div>
        </div>

        <script>
          // Función para crear modal
          function createModal(imageSrc, title) {
            const modal = document.createElement('div');
            modal.style.cssText = \`
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(0,0,0,0.9);
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              z-index: 1000;
              cursor: pointer;
              animation: fadeIn 0.3s ease;
            \`;
            
            const modalImg = document.createElement('img');
            modalImg.src = imageSrc;
            modalImg.style.cssText = \`
              max-width: 90%;
              max-height: 80%;
              border-radius: 15px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.7);
              animation: zoomIn 0.3s ease;
            \`;
            
            const modalTitle = document.createElement('div');
            modalTitle.textContent = title;
            modalTitle.style.cssText = \`
              color: white;
              font-size: 1.2rem;
              font-weight: 600;
              margin-top: 20px;
              text-align: center;
              background: rgba(255,255,255,0.1);
              padding: 10px 20px;
              border-radius: 25px;
              backdrop-filter: blur(10px);
            \`;
            
            const closeBtn = document.createElement('div');
            closeBtn.innerHTML = '✕';
            closeBtn.style.cssText = \`
              position: absolute;
              top: 30px;
              right: 30px;
              color: white;
              font-size: 2rem;
              cursor: pointer;
              width: 40px;
              height: 40px;
              border-radius: 50%;
              background: rgba(255,255,255,0.2);
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.3s ease;
            \`;
            
            closeBtn.addEventListener('mouseenter', () => {
              closeBtn.style.background = 'rgba(255,255,255,0.3)';
              closeBtn.style.transform = 'scale(1.1)';
            });
            
            closeBtn.addEventListener('mouseleave', () => {
              closeBtn.style.background = 'rgba(255,255,255,0.2)';
              closeBtn.style.transform = 'scale(1)';
            });
            
            modal.appendChild(modalImg);
            modal.appendChild(modalTitle);
            modal.appendChild(closeBtn);
            document.body.appendChild(modal);
            
            // Cerrar modal al hacer click
            modal.addEventListener('click', (e) => {
              if (e.target === modal || e.target === closeBtn) {
                modal.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => {
                  if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                  }
                }, 300);
              }
            });
            
            // Cerrar con tecla Escape
            const escapeHandler = (e) => {
              if (e.key === 'Escape') {
                modal.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => {
                  if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                  }
                }, 300);
                document.removeEventListener('keydown', escapeHandler);
              }
            };
            document.addEventListener('keydown', escapeHandler);
          }

          // Modal para fotos de estudiantes
          document.querySelectorAll('.student-photo').forEach(img => {
            img.addEventListener('click', function() {
              const studentName = this.alt.replace('Foto de ', '');
              createModal(this.src, \`Foto de \${studentName}\`);
            });
          });

          // Modal para códigos QR
          document.querySelectorAll('.qr-code').forEach(img => {
            img.addEventListener('click', function() {
              const dni = this.alt.replace('QR de ', '');
              createModal(this.src, \`Código QR - DNI: \${dni}\`);
            });
          });

          // Animación de entrada para las filas
          const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
          };

          const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                entry.target.style.animation = 'slideInUp 0.6s ease forwards';
              }
            });
          }, observerOptions);

          document.querySelectorAll('.student-row').forEach(row => {
            row.style.opacity = '0';
            row.style.transform = 'translateY(30px)';
            observer.observe(row);
          });

          // Agregar keyframes para las animaciones
          const styleSheet = document.createElement('style');
          styleSheet.textContent = \`
            @keyframes slideInUp {
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            
            @keyframes fadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
            
            @keyframes fadeOut {
              from {
                opacity: 1;
              }
              to {
                opacity: 0;
              }
            }
            
            @keyframes zoomIn {
              from {
                transform: scale(0.5);
                opacity: 0;
              }
              to {
                transform: scale(1);
                opacity: 1;
              }
            }
          \`;
          document.head.appendChild(styleSheet);
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send(`❌ Error al listar estudiantes: \${err.message}`);
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
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Estudiante No Encontrado</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
              padding: 20px;
            }

            .error-container {
              background: rgba(255, 255, 255, 0.95);
              padding: 40px;
              border-radius: 20px;
              text-align: center;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
              backdrop-filter: blur(10px);
              max-width: 500px;
              width: 100%;
            }

            .error-icon {
              font-size: 4rem;
              margin-bottom: 20px;
              animation: shake 0.5s ease-in-out;
            }

            .error-title {
              font-size: 1.8rem;
              color: #ee5a52;
              margin-bottom: 15px;
              font-weight: 600;
            }

            .error-message {
              color: #666;
              font-size: 1.1rem;
              margin-bottom: 30px;
              line-height: 1.5;
            }

            .back-btn {
              display: inline-block;
              padding: 12px 30px;
              background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
              color: white;
              text-decoration: none;
              border-radius: 25px;
              font-weight: 600;
              transition: all 0.3s ease;
              box-shadow: 0 5px 15px rgba(79, 172, 254, 0.4);
            }

            .back-btn:hover {
              transform: translateY(-3px);
              box-shadow: 0 8px 25px rgba(79, 172, 254, 0.6);
              text-decoration: none;
              color: white;
            }

            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              25% { transform: translateX(-10px); }
              75% { transform: translateX(10px); }
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <div class="error-icon">❌</div>
            <h2 class="error-title">Estudiante No Encontrado</h2>
            <p class="error-message">
              No se pudo encontrar un estudiante con el DNI: <strong>${dni}</strong><br>
              Verifica que el código QR sea válido.
            </p>
            <a href="/estudiantes" class="back-btn">← Volver a Lista</a>
          </div>
        </body>
        </html>
      `);
    }

    const [dni_estu, nombres, apellidos, carrera, club, foto] = result.rows[0];

    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${nombres} ${apellidos} - Perfil Estudiante</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
          }

          .container {
            max-width: 800px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 25px;
            overflow: hidden;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(15px);
            animation: slideUp 0.6s ease-out;
          }

          .header {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
            position: relative;
            overflow: hidden;
          }

          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: rotate 20s linear infinite;
          }

          .header-content {
            position: relative;
            z-index: 2;
          }

          .header h1 {
            font-size: 2.2rem;
            font-weight: 700;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          }

          .header .subtitle {
            font-size: 1.1rem;
            opacity: 0.9;
            font-weight: 300;
          }

          .profile-section {
            padding: 40px 30px;
            display: flex;
            gap: 40px;
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .photo-container {
            flex-shrink: 0;
          }

          .student-photo {
            width: 200px;
            height: 200px;
            object-fit: cover;
            border-radius: 20px;
            border: 5px solid #4facfe;
            box-shadow: 0 15px 35px rgba(79, 172, 254, 0.3);
            transition: all 0.4s ease;
            cursor: pointer;
          }

          .student-photo:hover {
            transform: scale(1.05) rotate(2deg);
            box-shadow: 0 20px 40px rgba(79, 172, 254, 0.5);
          }

          .info-container {
            flex: 1;
            min-width: 300px;
          }

          .info-card {
            background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
            padding: 30px;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            margin-bottom: 20px;
            border-left: 5px solid #4facfe;
          }

          .info-row {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding: 15px;
            background: white;
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
            transition: transform 0.3s ease;
          }

          .info-row:hover {
            transform: translateX(10px);
          }

          .info-row:last-child {
            margin-bottom: 0;
          }

          .info-icon {
            width: 50px;
            height: 50px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            margin-right: 20px;
            flex-shrink: 0;
          }

          .dni-icon {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .name-icon {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
          }

          .career-icon {
            background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
            color: white;
          }

          .club-icon {
            background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
            color: white;
          }

          .info-content {
            flex: 1;
          }

          .info-label {
            font-size: 0.9rem;
            color: #666;
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
          }

          .info-value {
            font-size: 1.2rem;
            color: #2c3e50;
            font-weight: 500;
            word-break: break-word;
          }

          .no-data {
            color: #999;
            font-style: italic;
            font-weight: 400;
          }

          .scan-time {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 20px;
            text-align: center;
            margin: 20px 30px;
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
            position: relative;
            overflow: hidden;
          }

          .scan-time::before {
            content: '📍';
            position: absolute;
            top: -10px;
            right: -10px;
            font-size: 3rem;
            opacity: 0.2;
            transform: rotate(15deg);
          }

          .scan-time .time-label {
            font-size: 0.9rem;
            opacity: 0.9;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }

          .scan-time .time-value {
            font-size: 1.3rem;
            font-weight: 600;
          }

          .actions {
            padding: 30px;
            text-align: center;
            background: #f8f9fa;
          }

          .back-btn {
            display: inline-block;
            padding: 15px 35px;
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 600;
            font-size: 1.1rem;
            transition: all 0.3s ease;
            box-shadow: 0 8px 25px rgba(79, 172, 254, 0.4);
            position: relative;
            overflow: hidden;
          }

          .back-btn::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            transition: all 0.5s ease;
          }

          .back-btn:hover::before {
            width: 300px;
            height: 300px;
          }

          .back-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 35px rgba(79, 172, 254, 0.6);
            text-decoration: none;
            color: white;
          }

          .success-badge {
            display: inline-block;
            background: linear-gradient(135deg, #51cf66 0%, #40c057 100%);
            color: white;
            padding: 8px 20px;
            border-radius: 25px;
            font-size: 0.9rem;
            font-weight: 600;
            margin-bottom: 20px;
            box-shadow: 0 5px 15px rgba(64, 192, 87, 0.3);
            animation: pulse 2s infinite;
          }

          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(50px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes rotate {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
          }

          @media (max-width: 768px) {
            body {
              padding: 10px;
            }

            .container {
              margin: 10px 0;
            }

            .header {
              padding: 30px 20px;
            }

            .header h1 {
              font-size: 1.8rem;
            }

            .profile-section {
              padding: 30px 20px;
              flex-direction: column;
              align-items: center;
              gap: 30px;
            }

            .student-photo {
              width: 150px;
              height: 150px;
            }

            .info-card {
              padding: 20px;
            }

            .info-row {
              flex-direction: column;
              text-align: center;
              gap: 10px;
            }

            .info-icon {
              margin-right: 0;
              margin-bottom: 10px;
            }

            .scan-time {
              margin: 20px;
              padding: 20px;
            }

            .actions {
              padding: 20px;
            }
          }

          @media (max-width: 480px) {
            .header h1 {
              font-size: 1.5rem;
            }

            .student-photo {
              width: 120px;
              height: 120px;
            }

            .info-value {
              font-size: 1rem;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-content">
              <div class="success-badge">✅ Acceso Verificado</div>
              <h1>🎓 Perfil del Estudiante</h1>
              <p class="subtitle">Información académica y personal</p>
            </div>
          </div>

          <div class="profile-section">
            <div class="photo-container">
              <img src="${foto}" alt="Foto de ${nombres} ${apellidos}" class="student-photo" onclick="openPhotoModal(this.src, '${nombres} ${apellidos}')">
            </div>

            <div class="info-container">
              <div class="info-card">
                <div class="info-row">
                  <div class="info-icon dni-icon">🆔</div>
                  <div class="info-content">
                    <div class="info-label">Documento de Identidad</div>
                    <div class="info-value">${dni_estu}</div>
                  </div>
                </div>

                <div class="info-row">
                  <div class="info-icon name-icon">👤</div>
                  <div class="info-content">
                    <div class="info-label">Nombre Completo</div>
                    <div class="info-value">${nombres} ${apellidos}</div>
                  </div>
                </div>

                <div class="info-row">
                  <div class="info-icon career-icon">📚</div>
                  <div class="info-content">
                    <div class="info-label">Carrera</div>
                    <div class="info-value ${!carrera ? 'no-data' : ''}">${carrera || 'Sin carrera asignada'}</div>
                  </div>
                </div>

                <div class="info-row">
                  <div class="info-icon club-icon">🏆</div>
                  <div class="info-content">
                    <div class="info-label">Club</div>
                    <div class="info-value ${!club ? 'no-data' : ''}">${club || 'Sin club asignado'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="scan-time">
            <div class="time-label">Hora del Escaneo</div>
            <div class="time-value">${hora}</div>
          </div>

          <div class="actions">
            <a href="/estudiantes" class="back-btn">← Volver a Lista de Estudiantes</a>
          </div>
        </div>

        <script>
          function openPhotoModal(imageSrc, studentName) {
            const modal = document.createElement('div');
            modal.style.cssText = \`
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(0,0,0,0.9);
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              z-index: 1000;
              cursor: pointer;
              animation: fadeIn 0.3s ease;
            \`;
            
            const modalImg = document.createElement('img');
            modalImg.src = imageSrc;
            modalImg.style.cssText = \`
              max-width: 90%;
              max-height: 80%;
              border-radius: 20px;
              box-shadow: 0 25px 50px rgba(0,0,0,0.7);
              animation: zoomIn 0.4s ease;
            \`;
            
            const modalTitle = document.createElement('div');
            modalTitle.textContent = studentName;
            modalTitle.style.cssText = \`
              color: white;
              font-size: 1.5rem;
              font-weight: 600;
              margin-top: 25px;
              text-align: center;
              background: rgba(255,255,255,0.1);
              padding: 15px 30px;
              border-radius: 30px;
              backdrop-filter: blur(15px);
            \`;
            
            const closeBtn = document.createElement('div');
            closeBtn.innerHTML = '✕';
            closeBtn.style.cssText = \`
              position: absolute;
              top: 40px;
              right: 40px;
              color: white;
              font-size: 2.5rem;
              cursor: pointer;
              width: 50px;
              height: 50px;
              border-radius: 50%;
              background: rgba(255,255,255,0.2);
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.3s ease;
              backdrop-filter: blur(10px);
            \`;
            
            closeBtn.addEventListener('mouseenter', () => {
              closeBtn.style.background = 'rgba(255,255,255,0.3)';
              closeBtn.style.transform = 'scale(1.1)';
            });
            
            closeBtn.addEventListener('mouseleave', () => {
              closeBtn.style.background = 'rgba(255,255,255,0.2)';
              closeBtn.style.transform = 'scale(1)';
            });
            
            modal.appendChild(modalImg);
            modal.appendChild(modalTitle);
            modal.appendChild(closeBtn);
            document.body.appendChild(modal);
            
            modal.addEventListener('click', (e) => {
              if (e.target === modal || e.target === closeBtn) {
                modal.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => {
                  if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                  }
                }, 300);
              }
            });
            
            const escapeHandler = (e) => {
              if (e.key === 'Escape') {
                modal.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => {
                  if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                  }
                }, 300);
                document.removeEventListener('keydown', escapeHandler);
              }
            };
            document.addEventListener('keydown', escapeHandler);
          }

          // Agregar estilos de animación
          const styleSheet = document.createElement('style');
          styleSheet.textContent = \`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            
            @keyframes fadeOut {
              from { opacity: 1; }
              to { opacity: 0; }
            }
            
            @keyframes zoomIn {
              from {
                transform: scale(0.5);
                opacity: 0;
              }
              to {
                transform: scale(1);
                opacity: 1;
              }
            }
          \`;
          document.head.appendChild(styleSheet);
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error del Sistema</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
          }

          .error-container {
            background: rgba(255, 255, 255, 0.95);
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(10px);
            max-width: 600px;
            width: 100%;
          }

          .error-icon {
            font-size: 4rem;
            margin-bottom: 20px;
            color: #ee5a52;
          }

          .error-title {
            font-size: 1.8rem;
            color: #ee5a52;
            margin-bottom: 20px;
            font-weight: 600;
          }

          .error-details {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            border-left: 4px solid #ee5a52;
            text-align: left;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            color: #666;
            white-space: pre-wrap;
          }

          .back-btn {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 600;
            transition: all 0.3s ease;
            box-shadow: 0 5px 15px rgba(79, 172, 254, 0.4);
          }

          .back-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(79, 172, 254, 0.6);
            text-decoration: none;
            color: white;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <div class="error-icon">⚠️</div>
          <h2 class="error-title">Error del Sistema</h2>
          <p>Ha ocurrido un error al procesar la solicitud:</p>
          <div class="error-details">${err.message}</div>
          <a href="/estudiantes" class="back-btn">← Volver a Lista</a>
        </div>
      </body>
      </html>
    `);
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
        fs.unlinkSync(filepath); 
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
