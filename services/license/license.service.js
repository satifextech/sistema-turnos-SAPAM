"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const device =
    require("./device.service");

const ROOT_DIR =
    path.resolve(
        __dirname,
        "..",
        ".."
    );

const APP_FOLDER =
    path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "LINK Kiosco de Turnos"
    );

const LICENSE_FILE =
    path.join(
        APP_FOLDER,
        "license.json"
    );

const LICENSE_BACKUP_FILE =
    path.join(
        APP_FOLDER,
        "license.backup.json"
    );

const VERSION_FILE =
    path.join(
        ROOT_DIR,
        "config",
        "version.json"
    );

const PUBLIC_KEY_FILE =
    path.join(
        ROOT_DIR,
        "config",
        "license",
        "license-public.pem"
    );

function leerJson(filePath) {

    const contenido =
        fs.readFileSync(
            filePath,
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

function escribirJson(filePath, data) {

    fs.writeFileSync(
        filePath,
        JSON.stringify(
            data,
            null,
            2
        ) + "\n",
        "utf8"
    );

}

function asegurarCarpeta() {

    fs.mkdirSync(
        APP_FOLDER,
        {
            recursive: true
        }
    );

}

function obtenerProductId() {

    const version =
        leerJson(
            VERSION_FILE
        );

    if(
        !version.product
        ||
        !version.product.appId
    ) {

        throw new Error(
            "config/version.json no contiene product.appId."
        );

    }

    return String(
        version.product.appId
    );

}

function existeLicencia() {

    return fs.existsSync(
        LICENSE_FILE
    );

}

function leerLicencia() {

    if(!existeLicencia()) {

        return null;

    }

    return leerJson(
        LICENSE_FILE
    );

}

function leerClavePublica() {

    if(
        !fs.existsSync(
            PUBLIC_KEY_FILE
        )
    ) {

        throw new Error(
            "No se encontró la clave pública de licencias."
        );

    }

    return fs.readFileSync(
        PUBLIC_KEY_FILE,
        "utf8"
    );

}

function validarFechaIso(valor) {

    if(
        typeof valor !== "string"
        ||
        valor.trim() === ""
    ) {

        return false;

    }

    const fecha =
        new Date(
            valor
        );

    return !Number.isNaN(
        fecha.getTime()
    );

}

function validarEstructura(licencia) {

    if(
        !licencia
        ||
        typeof licencia !== "object"
        ||
        Array.isArray(licencia)
    ) {

        return false;

    }

    if(
        !licencia.payload
        ||
        typeof licencia.payload !== "object"
        ||
        Array.isArray(licencia.payload)
    ) {

        return false;

    }

    if(
        typeof licencia.signature !== "string"
        ||
        licencia.signature.trim() === ""
    ) {

        return false;

    }

    const camposObligatorios = [
        "schemaVersion",
        "licenseId",
        "productId",
        "productName",
        "customer",
        "type",
        "hardwareId",
        "hardwareCode",
        "deviceId",
        "issuedAt",
        "issuer"
    ];

    return camposObligatorios.every(
        campo =>
            Object.prototype.hasOwnProperty.call(
                licencia.payload,
                campo
            )
    );

}

function verificarFirma(licencia) {

    try {

        const material =
            Buffer.from(
                JSON.stringify(
                    licencia.payload
                ),
                "utf8"
            );

        const firma =
            Buffer.from(
                licencia.signature,
                "base64"
            );

        return crypto.verify(
            null,
            material,
            leerClavePublica(),
            firma
        );

    } catch(_error) {

        return false;

    }

}

function normalizar(valor) {

    return String(
        valor || ""
    )
    .trim()
    .toLowerCase();

}

function validarObjetoLicencia(
    licencia,
    opciones = {}
) {

    const verificarDispositivo =
        opciones.verificarDispositivo !== false;

    if(!validarEstructura(licencia)) {

        return {
            valid: false,
            reason: "INVALID_STRUCTURE"
        };

    }

    if(!verificarFirma(licencia)) {

        return {
            valid: false,
            reason: "INVALID_SIGNATURE"
        };

    }

    const payload =
        licencia.payload;

    if(
        Number(
            payload.schemaVersion
        ) !== 1
    ) {

        return {
            valid: false,
            reason: "UNSUPPORTED_SCHEMA"
        };

    }

    let productIdEsperado;

    try {

        productIdEsperado =
            obtenerProductId();

    } catch(error) {

        return {
            valid: false,
            reason: "PRODUCT_CONFIGURATION_ERROR",
            message: error.message
        };

    }

    if(
        normalizar(
            payload.productId
        )
        !==
        normalizar(
            productIdEsperado
        )
    ) {

        return {
            valid: false,
            reason: "PRODUCT_MISMATCH"
        };

    }

    if(
        normalizar(
            payload.issuer
        )
        !==
        "link"
    ) {

        return {
            valid: false,
            reason: "INVALID_ISSUER"
        };

    }

    if(
        !validarFechaIso(
            payload.issuedAt
        )
    ) {

        return {
            valid: false,
            reason: "INVALID_ISSUED_AT"
        };

    }

    const fechaEmision =
        new Date(
            payload.issuedAt
        )
        .getTime();

    if(
        fechaEmision
        >
        Date.now() + 5 * 60 * 1000
    ) {

        return {
            valid: false,
            reason: "ISSUED_IN_FUTURE"
        };

    }

    if(
        payload.expiration !== null
        &&
        payload.expiration !== undefined
        &&
        payload.expiration !== ""
    ) {

        if(
            !validarFechaIso(
                payload.expiration
            )
        ) {

            return {
                valid: false,
                reason: "INVALID_EXPIRATION"
            };

        }

        const vencimiento =
            new Date(
                payload.expiration
            )
            .getTime();

        if(
            Date.now() > vencimiento
        ) {

            return {
                valid: false,
                reason: "EXPIRED",
                expiration:
                    payload.expiration
            };

        }

    }

    if(verificarDispositivo) {

        const identidad =
            device.getDeviceIdentity();

        if(
            normalizar(
                payload.hardwareId
            )
            !==
            normalizar(
                identidad.hardwareId
            )
        ) {

            return {
                valid: false,
                reason: "HARDWARE_MISMATCH"
            };

        }

        if(
            normalizar(
                payload.deviceId
            )
            !==
            normalizar(
                identidad.deviceId
            )
        ) {

            return {
                valid: false,
                reason: "DEVICE_MISMATCH"
            };

        }

    }

    return {
        valid: true,
        reason: "OK",
        license: payload
    };

}

function validarArchivoLicencia(
    filePath,
    opciones = {}
) {

    let licencia;

    try {

        licencia =
            leerJson(
                filePath
            );

    } catch(error) {

        return {
            valid: false,
            reason: "INVALID_JSON",
            message: error.message
        };

    }

    return validarObjetoLicencia(
        licencia,
        opciones
    );

}

function validarLicencia() {

    if(!existeLicencia()) {

        return {
            valid: false,
            reason: "NO_LICENSE"
        };

    }

    return validarArchivoLicencia(
        LICENSE_FILE,
        {
            verificarDispositivo: true
        }
    );

}

function instalarLicencia(filePath) {

    const rutaOrigen =
        path.resolve(
            filePath
        );

    if(
        !fs.existsSync(
            rutaOrigen
        )
    ) {

        return {
            success: false,
            reason: "FILE_NOT_FOUND"
        };

    }

    if(
        path.extname(
            rutaOrigen
        )
        .toLowerCase()
        !== ".lic"
    ) {

        return {
            success: false,
            reason: "INVALID_FILE_EXTENSION"
        };

    }

    const validacion =
        validarArchivoLicencia(
            rutaOrigen,
            {
                verificarDispositivo: true
            }
        );

    if(!validacion.valid) {

        return {
            success: false,
            ...validacion
        };

    }

    asegurarCarpeta();

    if(
        fs.existsSync(
            LICENSE_FILE
        )
    ) {

        fs.copyFileSync(
            LICENSE_FILE,
            LICENSE_BACKUP_FILE
        );

    }

    const licencia =
        leerJson(
            rutaOrigen
        );

    const archivoTemporal =
        LICENSE_FILE + ".tmp";

    escribirJson(
        archivoTemporal,
        licencia
    );

    fs.renameSync(
        archivoTemporal,
        LICENSE_FILE
    );

    const comprobacion =
        validarLicencia();

    if(!comprobacion.valid) {

        if(
            fs.existsSync(
                LICENSE_BACKUP_FILE
            )
        ) {

            fs.copyFileSync(
                LICENSE_BACKUP_FILE,
                LICENSE_FILE
            );

        } else if(
            fs.existsSync(
                LICENSE_FILE
            )
        ) {

            fs.unlinkSync(
                LICENSE_FILE
            );

        }

        return {
            success: false,
            reason: "INSTALLATION_VALIDATION_FAILED",
            validation:
                comprobacion
        };

    }

    return {
        success: true,
        reason: "INSTALLED",
        license:
            comprobacion.license,
        destination:
            LICENSE_FILE
    };

}

module.exports = {
    existeLicencia,
    leerLicencia,
    verificarFirma,
    validarEstructura,
    validarObjetoLicencia,
    validarArchivoLicencia,
    validarLicencia,
    instalarLicencia
};