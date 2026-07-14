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

    for(let numero = 1; numero <= 5; numero++){

        db.run(
            `
            INSERT OR IGNORE INTO mesas_estado
            (numero, estado)
            VALUES (?, 'disponible')
            `,
            [numero]
        );

    }

    const tramitesFolios = [
        "CONSUMO",
        "AFOROS",
        "ABONOS",
        "CONTRATO1",
        "CONTRATO2",
        "RECONEXIONES",
        "SUSPENSION",
        "INSEN",
        "GIRO"
    ];

    for(const tramite of tramitesFolios){

        db.run(
            `
            INSERT OR IGNORE INTO folios
            (tramite, ultimoNumero)
            VALUES (?, 0)
            `,
            [tramite]
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

    console.log("Tablas creadas");

});