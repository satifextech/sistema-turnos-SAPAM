"use strict";

const crypto = require("crypto");
const os = require("os");
const { execFileSync } = require("child_process");

const HARDWARE_SCHEMA_VERSION = 1;

/**
 * Ejecuta PowerShell y devuelve una cadena limpia.
 */
function ejecutarPowerShell(comando) {

    try {

        const resultado =
            execFileSync(
                "powershell.exe",
                [
                    "-NoProfile",
                    "-NonInteractive",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                    comando
                ],
                {
                    encoding: "utf8",
                    windowsHide: true,
                    timeout: 10000
                }
            );

        return String(resultado || "")
            .replace(/^\uFEFF/, "")
            .trim();

    } catch (_error) {

        return "";

    }

}

/**
 * Lee MachineGuid directamente desde el Registro de Windows.
 */
function obtenerMachineGuid() {

    if(process.platform !== "win32"){

        return "";

    }

    return ejecutarPowerShell(
        "(Get-ItemProperty " +
        "'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' " +
        "-Name MachineGuid).MachineGuid"
    );

}

/**
 * Obtiene el UUID reportado por el firmware/BIOS.
 */
function obtenerBiosUuid() {

    if(process.platform !== "win32"){

        return "";

    }

    return ejecutarPowerShell(
        "(Get-CimInstance Win32_ComputerSystemProduct)." +
        "UUID"
    );

}

/**
 * Obtiene el número de serie de la tarjeta madre.
 */
function obtenerBaseboardSerial() {

    if(process.platform !== "win32"){

        return "";

    }

    return ejecutarPowerShell(
        "(Get-CimInstance Win32_BaseBoard | " +
        "Select-Object -First 1)." +
        "SerialNumber"
    );

}

/**
 * Normaliza cualquier identificador antes de usarlo.
 */
function normalizar(valor) {

    return String(valor || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "")
        .replace(/[^A-Z0-9\-_.]/g, "");

}

/**
 * Descarta valores genéricos o inválidos proporcionados por algunos BIOS.
 */
function esIdentificadorValido(valor) {

    const normalizado =
        normalizar(valor);

    if(!normalizado){

        return false;

    }

    const invalidos = new Set([
        "DEFAULTSTRING",
        "TOBEFILLEDBYO.E.M.",
        "TOBEFILLEDBYOEM",
        "SYSTEMSERIALNUMBER",
        "NONE",
        "NULL",
        "UNKNOWN",
        "00000000-0000-0000-0000-000000000000",
        "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF"
    ]);

    return !invalidos.has(normalizado);

}

/**
 * Reúne las señales estables disponibles.
 *
 * Los valores completos se usan internamente para crear el hash,
 * pero no deben enviarse a interfaces públicas.
 */
function obtenerComponentesHardware() {

    const componentes = {
        machineGuid:
            normalizar(
                obtenerMachineGuid()
            ),

        biosUuid:
            normalizar(
                obtenerBiosUuid()
            ),

        baseboardSerial:
            normalizar(
                obtenerBaseboardSerial()
            )
    };

    return componentes;

}

/**
 * Devuelve únicamente las señales válidas.
 */
function obtenerComponentesValidos() {

    const componentes =
        obtenerComponentesHardware();

    return Object.fromEntries(
        Object.entries(componentes)
            .filter(
                ([, valor]) =>
                    esIdentificadorValido(valor)
            )
    );

}

/**
 * Genera el identificador estable de la instalación.
 */
function getHardwareId() {

    const componentes =
        obtenerComponentesValidos();

    const claves =
        Object.keys(componentes);

    if(claves.length === 0){

        throw new Error(
            "No fue posible obtener identificadores " +
            "de hardware válidos."
        );

    }

    const material =
        [
            `schema:${HARDWARE_SCHEMA_VERSION}`,
            `platform:${os.platform()}`,
            `arch:${os.arch()}`,
            ...claves
                .sort()
                .map(
                    clave =>
                        `${clave}:${componentes[clave]}`
                )
        ]
        .join("|");

    return crypto
        .createHash("sha256")
        .update(material, "utf8")
        .digest("hex");

}

/**
 * Versión corta para mostrar al cliente o soporte.
 *
 * Ejemplo:
 * LINK-3F9A-72C1-BD20-15A8
 */
function getHardwareCode() {

    const hardwareId =
        getHardwareId()
            .toUpperCase();

    return [
        "LINK",
        hardwareId.slice(0, 4),
        hardwareId.slice(4, 8),
        hardwareId.slice(8, 12),
        hardwareId.slice(12, 16)
    ].join("-");

}

/**
 * Información segura para diagnóstico.
 *
 * No devuelve los seriales completos.
 */
function getHardwareInfo() {

    const componentes =
        obtenerComponentesValidos();

    return {
        schemaVersion:
            HARDWARE_SCHEMA_VERSION,

        platform:
            os.platform(),

        arch:
            os.arch(),

        sources: {
            machineGuid:
                Boolean(componentes.machineGuid),

            biosUuid:
                Boolean(componentes.biosUuid),

            baseboardSerial:
                Boolean(componentes.baseboardSerial)
        },

        hardwareId:
            getHardwareId(),

        hardwareCode:
            getHardwareCode()
    };

}

/**
 * Genera un hash independiente para una señal.
 *
 * Nunca expone públicamente el valor real obtenido
 * del Registro, BIOS o tarjeta madre.
 */
function crearHashSeñal(
    nombre,
    valor
) {

    return crypto
        .createHash("sha256")
        .update(
            [
                `schema:${HARDWARE_SCHEMA_VERSION}`,
                `signal:${nombre}`,
                `value:${normalizar(valor)}`
            ].join("|"),
            "utf8"
        )
        .digest("hex");

}


/**
 * Devuelve una fotografía segura de las señales
 * disponibles en el equipo.
 *
 * Los seriales reales no salen de este servicio.
 */
function getHardwareFingerprint() {

    const componentes =
        obtenerComponentesValidos();

    const signals = {};

    if(componentes.machineGuid) {

        signals.machineGuid = {

            available:
                true,

            weight:
                45,

            hash:
                crearHashSeñal(
                    "machineGuid",
                    componentes.machineGuid
                )

        };

    }

    if(componentes.biosUuid) {

        signals.biosUuid = {

            available:
                true,

            weight:
                35,

            hash:
                crearHashSeñal(
                    "biosUuid",
                    componentes.biosUuid
                )

        };

    }

    if(componentes.baseboardSerial) {

        signals.baseboardSerial = {

            available:
                true,

            weight:
                20,

            hash:
                crearHashSeñal(
                    "baseboardSerial",
                    componentes.baseboardSerial
                )

        };

    }

    const availableWeight =
        Object.values(signals)
            .reduce(
                (
                    total,
                    signal
                ) =>
                    total
                    +
                    signal.weight,
                0
            );

    const material =
        Object.entries(signals)
            .sort(
                (
                    [nombreA],
                    [nombreB]
                ) =>
                    nombreA.localeCompare(
                        nombreB
                    )
            )
            .map(
                (
                    [
                        nombre,
                        signal
                    ]
                ) =>
                    `${nombre}:${signal.hash}`
            )
            .join("|");

    const fingerprintId =
        crypto
            .createHash("sha256")
            .update(
                [
                    "link-hardware-fingerprint",
                    `schema:${HARDWARE_SCHEMA_VERSION}`,
                    `platform:${os.platform()}`,
                    `arch:${os.arch()}`,
                    material
                ].join("|"),
                "utf8"
            )
            .digest("hex");

    return {

        schemaVersion:
            HARDWARE_SCHEMA_VERSION,

        algorithm:
            "sha256",

        platform:
            os.platform(),

        arch:
            os.arch(),

        fingerprintId,

        availableWeight,

        maximumWeight:
            100,

        signals

    };

}

module.exports = {
    getHardwareInfo,
    getHardwareId,
    getHardwareCode,
    getHardwareFingerprint
};