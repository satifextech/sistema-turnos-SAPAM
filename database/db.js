const sqlite3 =
    require("sqlite3").verbose();

const path =
    require("path");


const dbPath =
    path.join(
        __dirname,
        "turnos.db"
    );


const db =
    new sqlite3.Database(
        dbPath,
        error => {

            if(error){

                console.error(
                    "No se pudo abrir la base de datos:",
                    error.message
                );

                return;

            }

            console.log(
                "Base de datos conectada"
            );

        }
    );


db.serialize(()=>{

    /*
    Espera hasta cinco segundos cuando otra operación
    mantiene temporalmente bloqueada la base.
    */
    db.run(
        "PRAGMA busy_timeout = 5000"
    );

    /*
    Activa validación de relaciones para las tablas
    que utilicen claves foráneas en el futuro.
    */
    db.run(
        "PRAGMA foreign_keys = ON"
    );

    /*
    Nivel equilibrado de protección y rendimiento.
    No activamos WAL todavía porque primero estamos
    corrigiendo el sistema de respaldos.
    */
    db.run(
        "PRAGMA synchronous = NORMAL"
    );

});


db.on(
    "error",
    error => {

        console.error(
            "Error de SQLite:",
            error
        );

    }
);


module.exports =
    db;