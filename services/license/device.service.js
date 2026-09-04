"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const hardware =
    require("./hardware.service");

const APP_FOLDER =
    path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "LINK Kiosco de Turnos"
    );

const DEVICE_FILE =
    path.join(
        APP_FOLDER,
        "identity.json"
    );

function ensureFolder() {

    fs.mkdirSync(
        APP_FOLDER,
        {
            recursive: true
        }
    );

}

function generarUUID() {

    if(
        typeof crypto.randomUUID
        ===
        "function"
    ) {

        return crypto.randomUUID();

    }

    return crypto
        .randomBytes(16)
        .toString("hex");

}

function leerIdentidad() {

    const contenido =
        fs.readFileSync(
            DEVICE_FILE,
            "utf8"
        )
        .replace(
            /^\uFEFF/,
            ""
        );

    return JSON.parse(
        contenido
    );

}

function escribirIdentidad(identity) {

    ensureFolder();

    const archivoTemporal =
        `${DEVICE_FILE}.tmp`;

    fs.writeFileSync(
        archivoTemporal,
        JSON.stringify(
            identity,
            null,
            2
        ) + "\n",
        "utf8"
    );

    /*
    En Windows renameSync no siempre reemplaza
    un archivo existente, por eso lo retiramos
    antes de mover el archivo temporal.
    */

    if(
        fs.existsSync(
            DEVICE_FILE
        )
    ) {

        fs.unlinkSync(
            DEVICE_FILE
        );

    }

    fs.renameSync(
        archivoTemporal,
        DEVICE_FILE
    );

}

function crearIdentidad() {

    ensureFolder();

    const now =
        new Date()
            .toISOString();

    const identity = {

        schemaVersion:
            2,

        deviceId:
            generarUUID(),

        hardwareId:
            hardware.getHardwareId(),

        hardwareCode:
            hardware.getHardwareCode(),

        fingerprint:
            hardware.getHardwareFingerprint(),

        createdAt:
            now,

        updatedAt:
            now

    };

    escribirIdentidad(
        identity
    );

    return identity;

}

function migrarIdentidad(identity) {

    let changed =
        false;

    const migrated = {
        ...identity
    };

    if(
        Number(
            migrated.schemaVersion
        ) < 2
    ) {

        migrated.schemaVersion =
            2;

        changed =
            true;

    }

    if(
        !migrated.fingerprint
        ||
        typeof migrated.fingerprint
        !==
        "object"
        ||
        Array.isArray(
            migrated.fingerprint
        )
    ) {

        migrated.fingerprint =
            hardware.getHardwareFingerprint();

        changed =
            true;

    }

    if(
        !migrated.updatedAt
    ) {

        migrated.updatedAt =
            new Date()
                .toISOString();

        changed =
            true;

    }

    /*
    No modificamos estos valores porque la licencia
    instalada actualmente depende de ellos.
    */

    if(
        !migrated.deviceId
        ||
        !migrated.hardwareId
    ) {

        throw new Error(
            "La identidad existente no contiene deviceId "
            + "o hardwareId."
        );

    }

    if(changed) {

        escribirIdentidad(
            migrated
        );

    }

    return migrated;

}

function getDeviceIdentity() {

    ensureFolder();

    if(
        !fs.existsSync(
            DEVICE_FILE
        )
    ) {

        return crearIdentidad();

    }

    const identity =
        leerIdentidad();

    return migrarIdentidad(
        identity
    );

}

module.exports = {
    getDeviceIdentity,
    crearIdentidad
};