const express = require('express');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: La variable de entorno DATABASE_URL no está definida.');
  console.error('Asegúrate de tener un archivo .env en la raíz de tu proyecto con DATABASE_URL="postgresql://..."');
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

  if (username && password) {
      console.log(`Usuario "${username}" intentó iniciar sesión.`);
      res.redirect('/procedimientos');
  } else {
      res.status(401).send(`<h2>❌ Login fallido: Faltan credenciales.</h2>`);
  }
});

app.get('/procedimientos', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'procedimientos.html'));
});

app.get('/ejecutar/:proc', authMiddleware, async (req, res) => {
  const { proc } = req.params;

  const procedures = {
    fecha_inicioserver: `
DO $$
DECLARE
v_fecha TIMESTAMP;
BEGIN
SELECT pg_postmaster_start_time()
INTO v_fecha;
RAISE NOTICE 'Servidor iniciado el: %', v_fecha;
END $$;
`,
    loop1a10: `
DO $$
DECLARE
i INTEGER;
BEGIN
FOR i IN 1..10 LOOP
RAISE NOTICE 'Número: %', i;
END LOOP;
END $$;
`,
    fecha_creacion: `
DO $$
DECLARE
  v_fecha TIMESTAMP;
BEGIN
  SELECT (pg_stat_file('base/' || oid || '/PG_VERSION')).modification
  INTO v_fecha
  FROM pg_database
  WHERE datname = current_database();
  RAISE NOTICE 'Fecha estimada de creación: %', v_fecha;
END $$;
`,
    esbisiesto: `
DO $$
DECLARE
  v_anio INTEGER;
  v_bisiesto BOOLEAN;
BEGIN
  v_anio := 2024;
  v_bisiesto := (v_anio % 4 = 0 AND (v_anio % 100 != 0 OR v_anio % 400 = 0));
  RAISE NOTICE 'El año % % es bisiesto.', v_anio, CASE WHEN v_bisiesto THEN 'sí' ELSE 'no' END;
END $$;
`,
    sumanumeros:`
DO $$
DECLARE
  v_num1 INTEGER := 8;
  v_num2 INTEGER := 12;
  v_resultado INTEGER;
BEGIN
  v_resultado := v_num1 + v_num2;
  RAISE NOTICE 'La suma de % + % es: %', v_num1, v_num2, v_resultado;
END $$;
`,
    looppares:`
DO $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 0..10 LOOP
    IF i % 2 = 0 THEN
      RAISE NOTICE 'Número: %', i;
    END IF;
  END LOOP;
END $$;
`,
    recorrer_insertar:`
DO $$
DECLARE
  v_num INTEGER := 0;
  v_inicio INTEGER := 0;
BEGIN
  SELECT COALESCE(MAX(VALOR), 0) INTO v_inicio FROM TBL_NUM;
  v_num := v_inicio;
  LOOP
    v_num := v_num + 1;
    INSERT INTO TBL_NUM (VALOR) VALUES (v_num);
    RAISE NOTICE 'INSERTADO: %', v_num;
    EXIT WHEN v_num >= v_inicio + 10;
  END LOOP;
END $$;
`,
    totalobjetos:`
DO $$
DECLARE
    v_total INTEGER := 0;
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM pg_catalog.pg_class;
    RAISE NOTICE 'Total objetos: %', v_total;
    CASE
        WHEN v_total < 2000 THEN
            RAISE NOTICE 'LA BASE DE DATOS TIENE MENOS DE 2000 OBJETOS.';
        WHEN v_total >= 2000 AND v_total < 4000 THEN
            RAISE NOTICE 'LA BASE DE DATOS TIENE ENTRE 2000 Y 4000 OBJETOS.';
        ELSE
            RAISE NOTICE 'LA BASE DE DATOS TIENE MÁS DE 4000 OBJETOS.';
    END CASE;
END $$;
`
  };

  if (!procedures[proc]) {
    return res.status(404).send('Procedimiento no encontrado.');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  const notices = [];

  client.on('notice', (msg) => {
    notices.push(msg.message);
  });

  try {
    await client.connect();
    await client.query(procedures[proc]);
    await client.end();

    const sqlCode = procedures[proc].trim();

    res.send(`
<h2>✅ Resultado:</h2>
<pre style="background:#eee; padding:10px; white-space: pre-wrap;">${notices.length ? notices.join('\n') : 'No hubo salida'}</pre>

<h3>Código SQL ejecutado:</h3>
<textarea rows="10" cols="80" readonly style="white-space: pre-wrap;">${sqlCode}</textarea>

<br><a href="/procedimientos">← Volver</a>
`);
} catch (error) {
console.log(error)
res.status(500).send(`❌ Error al ejecutar: ${error.message}`);
}
});

// Logout
app.get('/logout', (req, res) => {
req.session.destroy(() => {
res.redirect('/');
});
});

app.listen(port, () => {
console.log(`✅ Servidor iniciado en http://localhost:${port}/`);
});
