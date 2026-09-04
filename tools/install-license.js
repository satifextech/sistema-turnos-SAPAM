"use strict";

const fs = require("fs");
const path = require("path");

const licenseService =
    require(
        "../services/license/license.service"
    );

function mostrarUso() {

    console.log("");
    console.log("LINK License Installer");
    console.log("======================");
    console.log("");
    console.log(
        "Uso:"
    );
    console.log(
        "node tools/install-license.js archivo.lic"
    );
    console.log("");

}

function main() {

    const argumento =
        process.argv[2];

    if(!argumento) {

        mostrarUso();
        process.exitCode = 1;
        return;

    }

    const filePath =
        path.resolve(
            argumento
        );

    if(
        !fs.existsSync(
            filePath
        )
    ) {

        throw new Error(
            `No existe el archivo: ${filePath}`
        );

    }

    console.log("");
    console.log("LINK License Installer");
    console.log("======================");
    console.log("");
    console.log(
        `Archivo: ${path.basename(filePath)}`
    );
    console.log("");
    console.log(
        "Validando licencia..."
    );

    const resultado =
        licenseService.instalarLicencia(
            filePath
        );

    if(!resultado.success) {

        console.log("");
        console.error(
            "✖ La licencia no fue instalada."
        );
        console.error(
            `Motivo: ${resultado.reason}`
        );
        console.log("");

        process.exitCode = 1;
        return;

    }

    console.log("");
    console.log(
        "✔ Firma digital válida"
    );
    console.log(
        "✔ Producto válido"
    );
    console.log(
        "✔ Hardware válido"
    );
    console.log(
        "✔ Dispositivo válido"
    );
    console.log(
        "✔ Licencia instalada"
    );
    console.log("");
    console.log(
        `Cliente: ${resultado.license.customer}`
    );
    console.log(
        `Tipo: ${resultado.license.type}`
    );
    console.log(
        `License ID: ${resultado.license.licenseId}`
    );
    console.log(
        `Expiración: ${
            resultado.license.expiration
            || "Sin expiración"
        }`
    );
    console.log("");

}

try {

    main();

} catch(error) {

    console.error("");
    console.error(
        "✖ LINK License Installer falló:"
    );
    console.error(
        error.message
    );
    console.error("");

    process.exitCode = 1;

}