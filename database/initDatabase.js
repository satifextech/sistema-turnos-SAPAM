const db = require("./db");

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

    console.log("Tablas creadas");
});