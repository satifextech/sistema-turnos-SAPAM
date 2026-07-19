const db = require("./db");
const bcrypt = require("bcrypt");

db.serialize(() => {

    db.run(`
        CREATE TABLE IF NOT EXISTS tramites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            letra TEXT NOT NULL,
            nombre TEXT NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS turnos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT NOT NULL,
            tramite TEXT NOT NULL,
            estado TEXT DEFAULT 'espera',
            mesa INTEGER,
            fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            fechaLlamado DATETIME,
            fechaFinalizado DATETIME,
            observaciones TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS mesas_estado (
            numero INTEGER PRIMARY KEY,
            estado TEXT NOT NULL DEFAULT 'disponible',
            motivo TEXT,
            fechaActualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS folios (
            tramite TEXT PRIMARY KEY,
            ultimoNumero INTEGER NOT NULL DEFAULT 0,
            fechaReinicio DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario TEXT NOT NULL UNIQUE,
            contraseña TEXT NOT NULL,
            rol TEXT NOT NULL DEFAULT 'admin',
            activo INTEGER NOT NULL DEFAULT 1,
            fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS tramites_config (

            codigo TEXT PRIMARY KEY,

            nombre TEXT NOT NULL,

            prefijo TEXT NOT NULL UNIQUE,

            descripcion TEXT,

            activo INTEGER NOT NULL DEFAULT 1,

            mostrarRecepcion INTEGER NOT NULL DEFAULT 1,

            orden INTEGER NOT NULL DEFAULT 0,

            fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,

            fechaActualizacion DATETIME DEFAULT CURRENT_TIMESTAMP

        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS mesas_config (

            numero INTEGER PRIMARY KEY,

            nombre TEXT NOT NULL,

            activo INTEGER NOT NULL DEFAULT 1,

            permiteTurnos INTEGER NOT NULL DEFAULT 1,

            orden INTEGER NOT NULL DEFAULT 0,

            fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,

            fechaActualizacion DATETIME DEFAULT CURRENT_TIMESTAMP

        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS reglas_tramites (

            tramite TEXT PRIMARY KEY,

            limiteApoyo INTEGER NOT NULL DEFAULT 5,

            activo INTEGER NOT NULL DEFAULT 1,

            fechaActualizacion DATETIME
                DEFAULT CURRENT_TIMESTAMP

        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS reglas_mesas (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            tramite TEXT NOT NULL,

            mesa INTEGER NOT NULL,

            tipo TEXT NOT NULL
                CHECK(tipo IN ('prioridad', 'apoyo')),

            orden INTEGER NOT NULL DEFAULT 1,

            activo INTEGER NOT NULL DEFAULT 1,

            fechaActualizacion DATETIME
                DEFAULT CURRENT_TIMESTAMP,

            UNIQUE(tramite, mesa, tipo)

        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS configuracion_sistema (

            clave TEXT PRIMARY KEY,

            valor TEXT NOT NULL,

            descripcion TEXT,

            fechaActualizacion DATETIME
                DEFAULT CURRENT_TIMESTAMP

        )
    `);

    const tramitesIniciales = [

        {
            codigo:"CONSUMO",
            nombre:"Consumo Alto",
            prefijo:"CA",
            descripcion:
                "Revisión y aclaración por consumo elevado.",
            orden:1
        },

        {
            codigo:"AFOROS",
            nombre:"Aforos",
            prefijo:"AF",
            descripcion:
                "Solicitudes y seguimiento de aforos.",
            orden:2
        },

        {
            codigo:"ABONOS",
            nombre:"Abonos",
            prefijo:"AB",
            descripcion:
                "Convenios, pagos parciales y abonos.",
            orden:3
        },

        {
            codigo:"CONTRATO1",
            nombre:"Contratos - Etapa 1",
            prefijo:"C1",
            descripcion:
                "Recepción y validación de documentos.",
            orden:4
        },

        {
            codigo:"CONTRATO2",
            nombre:"Contratos - Etapa 2",
            prefijo:"C2",
            descripcion:
                "Presupuesto y firma del contrato.",
            orden:5
        },

        {
            codigo:"RECONEXIONES",
            nombre:"Reconexiones",
            prefijo:"RE",
            descripcion:
                "Trámite y seguimiento de reconexión.",
            orden:6
        },

        {
            codigo:"SUSPENSION",
            nombre:"Suspensión Voluntaria",
            prefijo:"SU",
            descripcion:
                "Solicitud de suspensión temporal del servicio.",
            orden:7
        },

        {
            codigo:"INSEN",
            nombre:"INSEN",
            prefijo:"IN",
            descripcion:
                "Atención de beneficios y descuentos.",
            orden:8
        },

        {
            codigo:"GIRO",
            nombre:"Giro de Tarifa",
            prefijo:"GT",
            descripcion:
                "Solicitud o actualización de giro tarifario.",
            orden:9
        }

    ];

    for(const tramite of tramitesIniciales){

        db.run(
            `
            INSERT OR IGNORE INTO tramites_config
            (
                codigo,
                nombre,
                prefijo,
                descripcion,
                activo,
                mostrarRecepcion,
                orden
            )
            VALUES (?, ?, ?, ?, 1, 1, ?)
            `,
            [
                tramite.codigo,
                tramite.nombre,
                tramite.prefijo,
                tramite.descripcion,
                tramite.orden
            ]
        );

    }

    const mesasIniciales = [

        {
            numero:1,
            nombre:"Mesa 1",
            orden:1
        },

        {
            numero:2,
            nombre:"Mesa 2",
            orden:2
        },

        {
            numero:3,
            nombre:"Mesa 3",
            orden:3
        },

        {
            numero:4,
            nombre:"Mesa 4",
            orden:4
        },

        {
            numero:5,
            nombre:"Mesa 5",
            orden:5
        }

    ];

    for(const mesa of mesasIniciales){

        db.run(
            `
            INSERT OR IGNORE INTO mesas_config
            (
                numero,
                nombre,
                activo,
                permiteTurnos,
                orden
            )
            VALUES (?, ?, 1, 1, ?)
            `,
            [
                mesa.numero,
                mesa.nombre,
                mesa.orden
            ]
        );

        /*
        Aseguramos que cada mesa dinámica también
        tenga un estado operativo.
        */
        db.run(
            `
            INSERT OR IGNORE INTO mesas_estado
            (
                numero,
                estado
            )
            VALUES (?, 'disponible')
            `,
            [
                mesa.numero
            ]
        );

    }

    for(const tramite of tramitesIniciales){

        db.run(
            `
            INSERT OR IGNORE INTO folios
            (
                tramite,
                ultimoNumero
            )
            VALUES (?, 0)
            `,
            [
                tramite.codigo
            ]
        );

    }

    const contraseñaAdmin =
        bcrypt.hashSync("SAPAM2026", 12);

    db.run(
        `
        INSERT OR IGNORE INTO usuarios
        (
            usuario,
            contraseña,
            rol,
            activo
        )
        VALUES (?, ?, ?, 1)
        `,
        [
            "admin",
            contraseñaAdmin,
            "admin"
        ]
    );

    const contraseñaRecepcion =
        bcrypt.hashSync("Recepcion2026", 12);

    const contraseñaSupervisor =
        bcrypt.hashSync("Supervisor2026", 12);

    db.run(
        `
        INSERT OR IGNORE INTO usuarios
        (
            usuario,
            contraseña,
            rol,
            activo
        )
        VALUES (?, ?, ?, 1)
        `,
        [
            "recepcion",
            contraseñaRecepcion,
            "recepcion"
        ]
    );

    db.run(
        `
        INSERT OR IGNORE INTO usuarios
        (
            usuario,
            contraseña,
            rol,
            activo
        )
        VALUES (?, ?, ?, 1)
        `,
        [
            "supervisor",
            contraseñaSupervisor,
            "supervisor"
        ]
    );

    const reglasIniciales = [

        {
            tramite:"CONSUMO",
            limiteApoyo:5,
            prioridad:[1, 4],
            apoyo:[3, 2]
        },

        {
            tramite:"AFOROS",
            limiteApoyo:5,
            prioridad:[4, 1],
            apoyo:[3, 2]
        },

        {
            tramite:"ABONOS",
            limiteApoyo:5,
            prioridad:[2],
            apoyo:[4, 3]
        },

        {
            tramite:"CONTRATO1",
            limiteApoyo:1,
            prioridad:[1],
            apoyo:[3, 4]
        },

        {
            tramite:"CONTRATO2",
            limiteApoyo:1,
            prioridad:[3],
            apoyo:[1, 4]
        },

        {
            tramite:"RECONEXIONES",
            limiteApoyo:5,
            prioridad:[2],
            apoyo:[4, 3]
        },

        {
            tramite:"SUSPENSION",
            limiteApoyo:5,
            prioridad:[2],
            apoyo:[4, 3]
        },

        {
            tramite:"INSEN",
            limiteApoyo:999,
            prioridad:[5],
            apoyo:[]
        },

        {
            tramite:"GIRO",
            limiteApoyo:999,
            prioridad:[5],
            apoyo:[]
        }

    ];

    for(const regla of reglasIniciales){

        db.run(
            `
            INSERT OR IGNORE INTO reglas_tramites
            (
                tramite,
                limiteApoyo,
                activo
            )
            VALUES (?, ?, 1)
            `,
            [
                regla.tramite,
                regla.limiteApoyo
            ]
        );

    }

    for(const regla of reglasIniciales){

        regla.prioridad.forEach(
            (numeroMesa, indice) => {

                db.run(
                    `
                    INSERT OR IGNORE INTO reglas_mesas
                    (
                        tramite,
                        mesa,
                        tipo,
                        orden,
                        activo
                    )
                    VALUES (?, ?, 'prioridad', ?, 1)
                    `,
                    [
                        regla.tramite,
                        numeroMesa,
                        indice + 1
                    ]
                );

            }
        );

    }

    for(const regla of reglasIniciales){

        regla.apoyo.forEach(
            (numeroMesa, indice) => {

                db.run(
                    `
                    INSERT OR IGNORE INTO reglas_mesas
                    (
                        tramite,
                        mesa,
                        tipo,
                        orden,
                        activo
                    )
                    VALUES (?, ?, 'apoyo', ?, 1)
                    `,
                    [
                        regla.tramite,
                        numeroMesa,
                        indice + 1
                    ]
                );

            }
        );

    }

    db.run(
        `
        INSERT OR IGNORE INTO reglas_tramites
        (
            tramite,
            limiteApoyo,
            activo
        )
        VALUES ('CAMBIO_MEDIDOR', 3, 1)
        `
    );

    db.run(
        `
        INSERT OR IGNORE INTO reglas_mesas
        (
            tramite,
            mesa,
            tipo,
            orden,
            activo
        )
        VALUES (
            'CAMBIO_MEDIDOR',
            6,
            'prioridad',
            1,
            1
        )
        `
    );

    db.run(
    `
    INSERT OR IGNORE INTO reglas_mesas
    (
        tramite,
        mesa,
        tipo,
        orden,
        activo
    )
    VALUES (
        'CAMBIO_MEDIDOR',
        3,
        'apoyo',
        1,
        1
    )
    `
);

db.run(
        `
        INSERT OR IGNORE INTO reglas_mesas
        (
            tramite,
            mesa,
            tipo,
            orden,
            activo
        )
        VALUES (
            'CAMBIO_MEDIDOR',
            4,
            'apoyo',
            2,
            1
        )
        `
    );

    const configuracionesIniciales = [

    {
        clave:
            "alerta_cola_advertencia",

        valor:
            "5",

        descripcion:
            "Cantidad de turnos para considerar una cola elevada"
    },

    {
        clave:
            "alerta_cola_critica",

        valor:
            "10",

        descripcion:
            "Cantidad de turnos para considerar una cola crítica"
    },

    {
        clave:
            "alerta_espera_advertencia",

        valor:
            "10",

        descripcion:
            "Minutos promedio para advertencia de espera"
    },

    {
        clave:
            "alerta_espera_critica",

        valor:
            "20",

        descripcion:
            "Minutos promedio para alerta crítica de espera"
    }

];

for(
    const configuracion
    of configuracionesIniciales
){

    db.run(
        `
        INSERT OR IGNORE INTO configuracion_sistema
        (
            clave,
            valor,
            descripcion
        )
        VALUES (?, ?, ?)
        `,
        [
            configuracion.clave,
            configuracion.valor,
            configuracion.descripcion
        ]
    );

}

    console.log("Tablas creadas");

});