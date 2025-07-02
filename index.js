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

app.get('/procedimientos', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'procedimientos.html'));
});

app.get('/ejecutar/:proc', authMiddleware, async (req, res) => {
  const { proc } = req.params;
  const cedula = req.query.cedula;
    const procedures = {
    loop1a10: `
    BEGIN
      FOR i IN 1..10 LOOP
        dbms_output.put_line('Número: ' || i);
      END LOOP;
    END;`,

        sumanumeros: `
    DECLARE
      v1 NUMBER := 8;
      v2 NUMBER := 12;
      v3 NUMBER;
    BEGIN
      v3 := v1 + v2;
      dbms_output.put_line('Suma: ' || v1 || ' + ' || v2 || ' = ' || v3);
    END;`,

        aumentoSalario: `
    DECLARE
        v_emp_id   NUMBER := 100;     -- ID del empleado a actualizar
        v_aumento  NUMBER := 500;     -- Monto del aumento
        v_exists   NUMBER;
    BEGIN
        -- Verificar si existe el empleado
        SELECT COUNT(*) INTO v_exists
        FROM employees
        WHERE employee_id = v_emp_id;

        IF v_exists > 0 THEN
            UPDATE employees
            SET salary = NVL(salary, 0) + v_aumento
            WHERE employee_id = v_emp_id;

            COMMIT;
            DBMS_OUTPUT.PUT_LINE('Salario actualizado para el empleado ID ' || v_emp_id);
        ELSE
            DBMS_OUTPUT.PUT_LINE('Empleado con ID ' || v_emp_id || ' no existe.');
        END IF;
    END;`,

        fechaCreacionBase: `
    DECLARE
        -- Se declara una variable que tomará el tipo de dato de la columna CREATED de la vista V$DATABASE
        V_FECHA V$DATABASE.CREATED%TYPE;
    BEGIN
        -- Se obtiene la fecha de creación de la base de datos y se guarda en V_FECHA
        SELECT CREATED INTO V_FECHA FROM V$DATABASE;

        -- Se compara si la diferencia entre la fecha actual y la fecha de creación es mayor a 30 días
        IF (SYSDATE - V_FECHA > 30) THEN
            -- Si la base tiene más de 30 días, se imprime este mensaje
            DBMS_OUTPUT.PUT_LINE('LA BASE DE DATOS FUE CREADA HACE MÁS DE 30 DÍAS.');
        ELSE
            -- Si la base tiene 30 días o menos, se imprime este otro mensaje
            DBMS_OUTPUT.PUT_LINE('LA BASE DE DATOS FUE CREADA HACE MENOS DE 30 DÍAS.');
        END IF;
        DBMS_OUTPUT.PUT_LINE(V_FECHA);
    END;`,

        bucleLoop: `
    DECLARE
        -- Declaración e inicialización de la variable numérica V_NUM en 0
        V_NUM NUMBER := 0;
    BEGIN
        -- Inicio del bucle LOOP
        LOOP
            -- Incrementa el valor de V_NUM en 1
            V_NUM := V_NUM + 1;

            -- Imprime el número actual en la consola
            DBMS_OUTPUT.PUT_LINE('NUMERO: ' || TO_CHAR(V_NUM));

            -- Condición de salida del bucle: si V_NUM es mayor o igual a 10
            EXIT WHEN V_NUM >= 10;
        END LOOP;
    END;`,

        guardarNumeros: `
    DECLARE
        v_num     NUMBER := 0;
        v_inicio  NUMBER := 0;
    BEGIN
        SELECT NVL(MAX(VALOR), 0) INTO v_inicio FROM HR.TBL_NUM;

        v_num := v_inicio;

        LOOP
            v_num := v_num + 1;

            INSERT INTO HR.TBL_NUM (VALOR) VALUES (v_num);

            -- No usar DBMS_OUTPUT en Laravel
            -- DBMS_OUTPUT.PUT_LINE('INSERTADO: ' || v_num);

            EXIT WHEN v_num >= v_inicio + 10;
        END LOOP;

        COMMIT;
    END;`,

        impresionNumerosPares: `
    BEGIN
        FOR V_NUM IN 0..10 BY 2 LOOP
            -- Verifica si el último dígito es 0, 2, 4, 6 u 8 (número par)
            DBMS_OUTPUT.PUT_LINE('NUMERO PAR: ' || V_NUM);
        END LOOP;
    END;`,

        fechaActual: `
    BEGIN
        DBMS_OUTPUT.PUT_LINE(TO_CHAR(SYSDATE));
    END;`,

        mostrarInfoEmpleado: `
    DECLARE
        v_emp_id     NUMBER := 100;
        v_nombre     VARCHAR2(100);
        v_salario    NUMBER;
    BEGIN
        SELECT first_name || ' ' || last_name, salary
        INTO v_nombre, v_salario
        FROM employees
        WHERE employee_id = v_emp_id;

        DBMS_OUTPUT.PUT_LINE('Empleado: ' || v_nombre);
        DBMS_OUTPUT.PUT_LINE('Salario: ' || v_salario);
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            DBMS_OUTPUT.PUT_LINE('No existe un empleado con ID ' || v_emp_id);
    END;`,

        totalObjetos: `
    DECLARE
        -- Se declara una variable numérica para almacenar el total de objetos en la base de datos
        V_TOTAL NUMBER := 0;
    BEGIN
        -- Se cuenta el número total de objetos en la base de datos consultando la vista DBA_OBJECTS
        SELECT COUNT(*) INTO V_TOTAL FROM DBA_OBJECTS;

        -- Se evalúa el total de objetos utilizando una estructura CASE
        DBMS_OUTPUT.PUT_LINE(V_TOTAL);

        CASE
            -- Si hay menos de 2000 objetos
            WHEN V_TOTAL < 2000 THEN
                DBMS_OUTPUT.PUT_LINE('LA BASE DE DATOS TIENE MENOS DE 2000 OBJETOS.');

            -- Si hay entre 2001 y 3999 objetos
            WHEN V_TOTAL < 4000 AND V_TOTAL > 2000 THEN
                DBMS_OUTPUT.PUT_LINE('LA BASE DE DATOS TIENE ENTRE 2000 Y 4000 OBJETOS.');

            -- Si hay 4000 objetos o más
            ELSE
                DBMS_OUTPUT.PUT_LINE('LA BASE DE DATOS TIENE MÁS DE 4000 OBJETOS.');
        END CASE;
    END;`,

        aumentarSalarioDepartamento: `
    DECLARE
        v_dept_id     NUMBER := 50;
        v_porcentaje  NUMBER := 0.05;
    BEGIN
        UPDATE employees
        SET salary = salary + (salary * v_porcentaje)
        WHERE department_id = v_dept_id;

        COMMIT;
        DBMS_OUTPUT.PUT_LINE('Salarios actualizados para el departamento ' || v_dept_id);
    END;`,

        generarCorreo: `
    DECLARE
        CURSOR cur_est IS
            SELECT id_estudiante, nombres, apellidos
            FROM estudiantes
            WHERE correo_electronico IS NULL OR password1 IS NULL;

        v_email VARCHAR2(150);
        v_fecha DATE := SYSDATE;
        v_hora VARCHAR2(8);
        v_ini_nom1 VARCHAR2(1);
        v_ini_nom2 VARCHAR2(1);

        v_apellido_full VARCHAR2(50);
        v_apellido1 VARCHAR2(50);
        v_apellido2 VARCHAR2(50);
        v_pass_gen VARCHAR2(50);

        v_ini_apellido2 VARCHAR2(1);
    BEGIN
        -- Obtener hora actual en formato HH24:MI:SS
        v_hora := TO_CHAR(v_fecha, 'HH24:MI:SS');

        FOR reg_est IN cur_est LOOP
            -- Obtener primera letra del primer nombre
            v_ini_nom1 := LOWER(SUBSTR(TRIM(reg_est.nombres), 1, 1));

            -- Obtener la primera letra del segundo nombre (si existe)
            IF INSTR(TRIM(reg_est.nombres), ' ') > 0 THEN
                v_ini_nom2 := LOWER(SUBSTR(TRIM(reg_est.nombres),
                                  INSTR(TRIM(reg_est.nombres), ' ') + 1, 1));
            ELSE
                v_ini_nom2 := '';
            END IF;

            v_apellido1 := REGEXP_SUBSTR(TRIM(reg_est.apellidos), '[^ ]+', 1, 1);
            v_apellido2 := REGEXP_SUBSTR(TRIM(reg_est.apellidos), '[^ ]+', 2, 1);

            IF v_apellido2 IS NOT NULL THEN
                v_ini_apellido2 := SUBSTR(v_apellido2, 1, 1);
            ELSE
                v_ini_apellido2 := '';
            END IF;

            v_email := v_ini_nom1 || v_ini_nom2 || LOWER(v_apellido1) ||
                      v_ini_apellido2 || '@modsoft.edu.ec';

            -- Generar password
            v_pass_gen := v_ini_nom1 || LOWER(v_apellido1) || LENGTH(v_apellido1);

            -- Actualizar registro
            UPDATE estudiantes
            SET correo_electronico = LOWER(v_email),
                password1 = LOWER(v_pass_gen),
                fecha_creacion = v_fecha,
                hora_creacion = v_hora
            WHERE id_estudiante = reg_est.id_estudiante;

            DBMS_OUTPUT.PUT_LINE('Actualizado estudiante ID ' || reg_est.id_estudiante ||
                                ': ' || reg_est.nombres || ' ' || reg_est.apellidos ||
                                ' - Correo: ' || LOWER(v_email) ||
                                ' - Password: ' || LOWER(v_pass_gen));
        END LOOP;

        COMMIT;
        DBMS_OUTPUT.PUT_LINE('Proceso completado. Registros actualizados: ' || SQL%ROWCOUNT);
    EXCEPTION
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('Error: ' || SQLERRM);
            ROLLBACK;
    END;`,
    guardarCedula:
    `
        DECLARE
    V_CEDULA_INPUT VARCHAR2(10) := ${cedula};

    -- Excepciones personalizadas
    EX_CEDULA_INVALIDA EXCEPTION;
    EX_CEDULA_DUPLICADA EXCEPTION;

    V_EXISTE NUMBER;

    -- Cursor que emula iterar sobre una entrada
    CURSOR CUR_CEDULA(P_CEDULA VARCHAR2) IS
        SELECT P_CEDULA AS CEDULA FROM DUAL;

    -- Función para validar cédula ecuatoriana
    FUNCTION ES_CEDULA_VALIDA(P_CEDULA VARCHAR2) RETURN BOOLEAN IS
        provincia NUMBER;
        tercerDigito NUMBER;
        sumaPar NUMBER := 0;
        sumaImpar NUMBER := 0;
        total NUMBER;
        digitoVerificador NUMBER;
    BEGIN
        IF LENGTH(P_CEDULA) != 10 OR NOT REGEXP_LIKE(P_CEDULA, '^\d{10}$') THEN
            RETURN FALSE;
        END IF;

        provincia := TO_NUMBER(SUBSTR(P_CEDULA, 1, 2));
        tercerDigito := TO_NUMBER(SUBSTR(P_CEDULA, 3, 1));

        IF provincia < 1 OR provincia > 24 THEN
            RETURN FALSE;
        END IF;

        IF tercerDigito >= 6 THEN
            RETURN FALSE;
        END IF;

        FOR i IN 1..9 LOOP
            IF MOD(i, 2) = 1 THEN
                -- posiciones impares
                DECLARE
                    num NUMBER := TO_NUMBER(SUBSTR(P_CEDULA, i, 1)) * 2;
                BEGIN
                    IF num > 9 THEN
                        num := num - 9;
                    END IF;
                    sumaImpar := sumaImpar + num;
                END;
            ELSE
                -- posiciones pares
                sumaPar := sumaPar + TO_NUMBER(SUBSTR(P_CEDULA, i, 1));
            END IF;
        END LOOP;

        total := sumaImpar + sumaPar;
        digitoVerificador := 10 - MOD(total, 10);
        IF digitoVerificador = 10 THEN
            digitoVerificador := 0;
        END IF;

        RETURN digitoVerificador = TO_NUMBER(SUBSTR(P_CEDULA, 10, 1));
    EXCEPTION
        WHEN OTHERS THEN
            RETURN FALSE;
    END;

BEGIN
    FOR REG IN CUR_CEDULA(V_CEDULA_INPUT) LOOP
        -- Validar cédula
        IF NOT ES_CEDULA_VALIDA(REG.CEDULA) THEN
            RAISE EX_CEDULA_INVALIDA;
        END IF;

        -- Verificar duplicados
        SELECT COUNT(*) INTO V_EXISTE
        FROM T_CEDULA
        WHERE NRCEDULA = REG.CEDULA;

        IF V_EXISTE > 0 THEN
            RAISE EX_CEDULA_DUPLICADA;
        END IF;

        -- Insertar
        INSERT INTO T_CEDULA (NRCEDULA) VALUES (REG.CEDULA);
        DBMS_OUTPUT.PUT_LINE('✅ CÉDULA INSERTADA: ' || REG.CEDULA);
    END LOOP;

-- Manejo de errores
EXCEPTION
    WHEN EX_CEDULA_INVALIDA THEN
        DBMS_OUTPUT.PUT_LINE('❌ ERROR: CÉDULA INVÁLIDA: ' || V_CEDULA_INPUT);
    WHEN EX_CEDULA_DUPLICADA THEN
        DBMS_OUTPUT.PUT_LINE('⚠️ CÉDULA YA EXISTE: ' || V_CEDULA_INPUT);
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('⚠️ ERROR GENERAL: ' || SQLERRM);
END;

    `

  };
  console.log(cedula)
  if (proc === 'guardarCedula' && (!cedula || typeof cedula !== 'string' || cedula.length !== 10)) {
    return res.status(400).json({ error: 'Valid 10-digit cedula required for guardarCedula' });
  }
  if (!procedures[proc]) {
    return res.status(404).send('Procedimiento no encontrado.');
  }

  try {
    const connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    });

   await connection.execute(`BEGIN DBMS_OUTPUT.ENABLE(NULL); END;`);  

    await connection.execute(procedures[proc]);
    // Leer salida dbms_output
    const result = await connection.execute(`
      DECLARE
        l_line VARCHAR2(32767);
        l_done NUMBER;
        l_buffer CLOB := '';
      BEGIN
        LOOP
          EXIT WHEN LENGTH(l_buffer) > 4000;
          DBMS_OUTPUT.GET_LINE(l_line, l_done);
          EXIT WHEN l_done = 1;
          l_buffer := l_buffer || l_line || CHR(10);
        END LOOP;
        :output := l_buffer;
      END;`, { output: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32767 } });

    await connection.close();

    res.send(`
<h2>✅ Resultado:</h2>
<pre>${result.outBinds.output || 'No hubo salida'}</pre>
<h3>PL/SQL ejecutado:</h3>
<textarea rows="10" cols="80" readonly>${procedures[proc]}</textarea>
<br><a href="/procedimientos">← Volver</a>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send(`<h2>❌ Error al ejecutar:</h2><pre>${err.message}</pre><br><a href="/procedimientos">← Volver</a>`);
  }
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
