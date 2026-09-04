"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const ROOT_DIR =
    path.resolve(__dirname, "..");

const PUBLIC_KEY_DIRECTORY =
    path.join(
        ROOT_DIR,
        "config",
        "license"
    );

const PUBLIC_KEY_FILE =
    path.join(
        PUBLIC_KEY_DIRECTORY,
        "license-public.pem"
    );

const PRIVATE_KEY_DIRECTORY =
    path.join(
        os.homedir(),
        "LINK-Secrets"
    );

const PRIVATE_KEY_FILE =
    path.join(
        PRIVATE_KEY_DIRECTORY,
        "license-private.pem"
    );

function asegurarCarpetas() {

    fs.mkdirSync(
        PUBLIC_KEY_DIRECTORY,
        {
            recursive: true
        }
    );

    fs.mkdirSync(
        PRIVATE_KEY_DIRECTORY,
        {
            recursive: true
        }
    );

}

function archivoExiste(filePath) {

    return fs.existsSync(filePath);

}

function generarClaves() {

    asegurarCarpetas();

    if(
        archivoExiste(PRIVATE_KEY_FILE)
        ||
        archivoExiste(PUBLIC_KEY_FILE)
    ) {

        throw new Error(
            [
                "Ya existe al menos una clave de licencias.",
                "No se reemplazará automáticamente porque las licencias",
                "emitidas anteriormente dejarían de ser válidas.",
                "",
                `Privada: ${PRIVATE_KEY_FILE}`,
                `Pública: ${PUBLIC_KEY_FILE}`
            ].join("\n")
        );

    }

    const {
        publicKey,
        privateKey
    } =
        crypto.generateKeyPairSync(
            "ed25519",
            {
                publicKeyEncoding: {
                    type: "spki",
                    format: "pem"
                },

                privateKeyEncoding: {
                    type: "pkcs8",
                    format: "pem"
                }
            }
        );

    fs.writeFileSync(
        PRIVATE_KEY_FILE,
        privateKey,
        {
            encoding: "utf8",
            mode: 0o600
        }
    );

    fs.writeFileSync(
        PUBLIC_KEY_FILE,
        publicKey,
        "utf8"
    );

    console.log("");
    console.log("LINK License Keys");
    console.log("=================");
    console.log("");
    console.log("✔ Par de claves Ed25519 generado.");
    console.log("");
    console.log("CLAVE PRIVADA:");
    console.log(PRIVATE_KEY_FILE);
    console.log("");
    console.log("CLAVE PÚBLICA:");
    console.log(PUBLIC_KEY_FILE);
    console.log("");
    console.log(
        "IMPORTANTE: la clave privada nunca debe copiarse al proyecto,"
    );
    console.log(
        "GitHub, instalador ni equipos de clientes."
    );
    console.log("");

}

try {

    generarClaves();

} catch(error) {

    console.error("");
    console.error("✖ No fue posible generar las claves.");
    console.error(error.message);
    console.error("");

    process.exitCode = 1;

}