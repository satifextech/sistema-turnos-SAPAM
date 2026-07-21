const sqlite3 =
    require("sqlite3").verbose();

const fs =
    require("fs");

const path =
    require("path");


/*
=========================================================
CARPETA DE DATOS
=========================================================
*/

const carpetaDatos =
    process.env.LINK_DATA_DIR
        ? path.resolve(
            process.env.LINK_DATA_DIR
        )
        : path.resolve(
            __dirname,
            ".."
        );


const carpetaBaseDatos =
    process.env.LINK_DATA_DIR
        ? path.join(
            carpetaDatos,
            "database"
        )
        : __dirname;


fs.mkdirSync(
    carpetaBaseDatos,
    {
        recursive:true
    }
);


const dbPath =
    path.join(
        carpetaBaseDatos,
        "turnos.db"
    );


/*
=========================================================
CONEXIÓN
=========================================================
*/

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
                "Base de datos conectada:",
                dbPath
            );

        }
    );


db.serialize(()=>{

    db.run(
        "PRAGMA busy_timeout = 5000"
    );

    db.run(
        "PRAGMA foreign_keys = ON"
    );

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