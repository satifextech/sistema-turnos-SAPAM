"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const axios = require("axios");

const deviceService =
    require(
        "../license/device.service"
    );

const licenseService =
    require(
        "../license/license.service"
    );

const CLOUD_SCHEMA_VERSION =
    1;

function obtenerCarpetaDatos() {

    if(
        process.env.LINK_DATA_DIR
        &&
        String(
            process.env.LINK_DATA_DIR
        ).trim()
    ) {

        return path.resolve(
            process.env.LINK_DATA_DIR
        );

    }

    if(
        process.env.APPDATA
        &&
        String(
            process.env.APPDATA
        ).trim()
    ) {

        return path.join(
            process.env.APPDATA,
            "LINK Kiosco de Turnos"
        );

    }

    return path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "LINK Kiosco de Turnos"
    );

}

function obtenerRutaCloud() {

    return path.join(
        obtenerCarpetaDatos(),
        "cloud.json"
    );

}

function asegurarCarpetaDatos() {

    fs.mkdirSync(
        obtenerCarpetaDatos(),
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

function escribirJsonAtomico(
    filePath,
    data
) {

    asegurarCarpetaDatos();

    const archivoTemporal =
        `${filePath}.tmp`;

    fs.writeFileSync(
        archivoTemporal,
        JSON.stringify(
            data,
            null,
            2
        ) + "\n",
        "utf8"
    );

    if(
        fs.existsSync(
            filePath
        )
    ) {

        fs.unlinkSync(
            filePath
        );

    }

    fs.renameSync(
        archivoTemporal,
        filePath
    );

}

function crearRegistroCloud() {

    const ahora =
        new Date()
            .toISOString();

    const device =
        deviceService
            .getDeviceIdentity();

    const validacionLicencia =
        licenseService
            .validarLicencia();

    const licencia =
        validacionLicencia.valid
            ? validacionLicencia.license
            : null;

    const registro = {

        schemaVersion:
            CLOUD_SCHEMA_VERSION,

        installationId:
            generarUUID(),

        registered:
            false,

        customerId:
            null,

        customerName:
            licencia
                ? licencia.customer
                : null,

        licenseId:
            licencia
                ? licencia.licenseId
                : null,

        deviceId:
            device.deviceId,

        hardwareCode:
            device.hardwareCode,

        productId:
            licencia
                ? licencia.productId
                : "com.link.kiosco.turnos",

        channel:
            "stable",

        cloud: {

            apiUrl:
                null,

            installationToken:
                null,

            registeredAt:
                null,

            lastSyncAt:
                null,

            lastSuccessfulSyncAt:
                null,

            lastErrorAt:
                null,

            lastError:
                null

        },

        createdAt:
            ahora,

        updatedAt:
            ahora

    };

    escribirJsonAtomico(
        obtenerRutaCloud(),
        registro
    );

    return registro;

}

function migrarRegistroCloud(
    registro
) {

    let modificado =
        false;

    const actualizado = {
        ...registro
    };

    if(
        Number(
            actualizado.schemaVersion
        ) < CLOUD_SCHEMA_VERSION
    ) {

        actualizado.schemaVersion =
            CLOUD_SCHEMA_VERSION;

        modificado =
            true;

    }

    if(
        !actualizado.installationId
    ) {

        actualizado.installationId =
            generarUUID();

        modificado =
            true;

    }

    if(
        typeof actualizado.registered
        !== "boolean"
    ) {

        actualizado.registered =
            false;

        modificado =
            true;

    }

    if(
        !actualizado.channel
    ) {

        actualizado.channel =
            "stable";

        modificado =
            true;

    }

    if(
        !actualizado.cloud
        ||
        typeof actualizado.cloud
        !== "object"
        ||
        Array.isArray(
            actualizado.cloud
        )
    ) {

        actualizado.cloud = {

            apiUrl:
                null,

            installationToken:
                null,

            registeredAt:
                null,

            lastSyncAt:
                null,

            lastSuccessfulSyncAt:
                null,

            lastErrorAt:
                null,

            lastError:
                null

        };

        modificado =
            true;

    }

    if(
        !actualizado.createdAt
    ) {

        actualizado.createdAt =
            new Date()
                .toISOString();

        modificado =
            true;

    }

    if(
        !actualizado.updatedAt
    ) {

        actualizado.updatedAt =
            new Date()
                .toISOString();

        modificado =
            true;

    }

    if(modificado) {

        escribirJsonAtomico(
            obtenerRutaCloud(),
            actualizado
        );

    }

    return actualizado;

}

function obtenerRutaIdentidadCompartida() {

    const programData =
        String(
            process.env.ProgramData
            ||
            process.env.PROGRAMDATA
            ||
            ""
        ).trim();

    if(!programData) {

        return null;

    }

    return path.join(
        programData,
        "LINK",
        "Agent",
        "installation.json"
    );

}


function leerIdentidadCompartida() {

    const filePath =
        obtenerRutaIdentidadCompartida();

    if(
        !filePath
        ||
        !fs.existsSync(
            filePath
        )
    ) {

        return null;

    }

    try {

        const identity =
            leerJson(
                filePath
            );

        const installationId =
            String(
                identity.installationId
                || ""
            ).trim();

        if(!installationId) {

            return null;

        }

        return {

            installationId,

            cloudApiUrl:
                String(
                    identity.cloudApiUrl
                    || ""
                ).trim()
                || null,

            agentVersion:
                String(
                    identity.agentVersion
                    || ""
                ).trim()
                || null,

            updatedAt:
                identity.updatedAt
                || null,

            filePath

        };

    } catch(error) {

        console.error(
            "No fue posible leer la identidad compartida del Agent:",
            error
        );

        return null;

    }

}

function getCloudIdentity() {

    asegurarCarpetaDatos();

    const rutaCloud =
        obtenerRutaCloud();

    if(
        !fs.existsSync(
            rutaCloud
        )
    ) {

        return crearRegistroCloud();

    }

    const registro =
        leerJson(
            rutaCloud
        );

    return migrarRegistroCloud(
        registro
    );

}

function updateCloudIdentity(
    cambios
) {

    if(
        !cambios
        ||
        typeof cambios !== "object"
        ||
        Array.isArray(
            cambios
        )
    ) {

        throw new TypeError(
            "Los cambios del registro Cloud deben ser un objeto."
        );

    }

    const {
        createdAt: _createdAtIgnorado,
        ...cambiosPermitidos
    } =
        cambios;

    const actual =
        getCloudIdentity();

    const actualizado = {

        ...actual,

        ...cambiosPermitidos,

        installationId:
            cambiosPermitidos.installationId
            ||
            actual.installationId,

        createdAt:
            actual.createdAt,

        updatedAt:
            new Date()
                .toISOString()

    };

    escribirJsonAtomico(
        obtenerRutaCloud(),
        actualizado
    );

    return actualizado;

}

function updateCloudConnection(
    cambiosCloud
) {

    if(
        !cambiosCloud
        ||
        typeof cambiosCloud !== "object"
        ||
        Array.isArray(
            cambiosCloud
        )
    ) {

        throw new TypeError(
            "Los cambios de conexión Cloud deben ser un objeto."
        );

    }

    const actual =
        getCloudIdentity();

    return updateCloudIdentity({

        cloud: {

            ...actual.cloud,

            ...cambiosCloud

        }

    });

}

function refreshLocalReferences() {

    const actual =
        getCloudIdentity();

    const device =
        deviceService
            .getDeviceIdentity();

    const validacionLicencia =
        licenseService
            .validarLicencia();

    const licencia =
        validacionLicencia.valid
            ? validacionLicencia.license
            : null;

    const sharedIdentity =
        leerIdentidadCompartida();

    const installationId =
        sharedIdentity
            ?.installationId
        ||
        actual.installationId;

    const apiUrl =
        sharedIdentity
            ?.cloudApiUrl
        ||
        actual.cloud.apiUrl;

    return updateCloudIdentity({

        installationId,

        customerName:
            licencia
                ? licencia.customer
                : actual.customerName,

        licenseId:
            licencia
                ? licencia.licenseId
                : actual.licenseId,

        deviceId:
            device.deviceId,

        hardwareCode:
            device.hardwareCode,

        productId:
            licencia
                ? licencia.productId
                : actual.productId,

        cloud: {

            ...actual.cloud,

            apiUrl

        }

    });

}

function getPublicCloudIdentity() {

    const registro =
        getCloudIdentity();

    return {

        schemaVersion:
            registro.schemaVersion,

        installationId:
            registro.installationId,

        registered:
            registro.registered,

        customerId:
            registro.customerId,

        customerName:
            registro.customerName,

        licenseId:
            registro.licenseId,

        deviceId:
            registro.deviceId,

        hardwareCode:
            registro.hardwareCode,

        productId:
            registro.productId,

        channel:
            registro.channel,

        cloud: {

            apiUrl:
                registro.cloud.apiUrl,

            registeredAt:
                registro.cloud.registeredAt,

            lastSyncAt:
                registro.cloud.lastSyncAt,

            lastSuccessfulSyncAt:
                registro.cloud.lastSuccessfulSyncAt,

            lastErrorAt:
                registro.cloud.lastErrorAt,

            lastError:
                registro.cloud.lastError

        },

        createdAt:
            registro.createdAt,

        updatedAt:
            registro.updatedAt

    };

}

function normalizarApiUrl(
    apiUrl
) {

    return String(
        apiUrl || ""
    )
        .trim()
        .replace(
            /\/+$/,
            ""
        );

}

const DEFAULT_CLOUD_API_URL =
    "http://localhost:4000";

const CLOUD_REQUEST_TIMEOUT_MS =
    5000;

async function sincronizarConCloud() {

    const registro =
        refreshLocalReferences();

    const apiUrl =
        normalizarApiUrl(
            registro.cloud.apiUrl
            ||
            process.env.LINK_CLOUD_API_URL
            ||
            DEFAULT_CLOUD_API_URL
        );

    if(!apiUrl) {

        return {

            configured:
                false,

            reachable:
                false,

            authorized:
                null,

            message:
                "LINK Cloud no está configurado."

        };

    }

    const ahora =
        new Date()
            .toISOString();

    updateCloudConnection({

        apiUrl,

        lastSyncAt:
            ahora

    });

    try {

        const respuesta =
            await axios.post(

                `${apiUrl}/api/handshake`,

                {
                    licenseId:
                        registro.licenseId,

                    installationId:
                        registro.installationId,

                    productId:
                        registro.productId,

                    channel:
                        registro.channel,

                    client:
                        "LINK-KIOSCO",

                    appVersion:
                        null
                },

                {

                    timeout:
                        CLOUD_REQUEST_TIMEOUT_MS,

                    headers: {

                        "Content-Type":
                            "application/json"

                    }

                }

            );

        const resultado =
            respuesta.data || {};

        const sincronizadoEn =
            new Date()
                .toISOString();

        updateCloudIdentity({

            registered:
                resultado.authorized === true
                    ? true
                    : registro.registered,

            customerName:
                resultado.customer
                &&
                resultado.customer.name
                    ? resultado.customer.name
                    : registro.customerName,

            cloud: {

                ...registro.cloud,

                apiUrl,

                registeredAt:
                    resultado.authorized === true
                        ? (
                            registro.cloud.registeredAt
                            ||
                            sincronizadoEn
                        )
                        : registro.cloud.registeredAt,

                lastSyncAt:
                    sincronizadoEn,

                lastSuccessfulSyncAt:
                    sincronizadoEn,

                lastErrorAt:
                    null,

                lastError:
                    null

            }

        });

        return {

            configured:
                true,

            reachable:
                true,

            ...resultado

        };

    } catch(error) {

        const errorEn =
            new Date()
                .toISOString();

        const respuestaCloud =
            error.response
            &&
            error.response.data
                ? error.response.data
                : null;

        const denegacionExplicita =
            respuestaCloud
            &&
            respuestaCloud.authorized === false;

        updateCloudConnection({

            apiUrl,

            lastSyncAt:
                errorEn,

            lastSuccessfulSyncAt:
                denegacionExplicita
                    ? errorEn
                    : registro.cloud.lastSuccessfulSyncAt,

            lastErrorAt:
                errorEn,

            lastError:
                respuestaCloud
                &&
                respuestaCloud.message
                    ? respuestaCloud.message
                    : error.message

        });

        if(denegacionExplicita) {

            return {

                configured:
                    true,

                reachable:
                    true,

                ...respuestaCloud

            };

        }

        return {

            configured:
                true,

            reachable:
                false,

            authorized:
                null,

            message:
                error.message

        };

    }

}

module.exports = {

    getCloudIdentity,

    getPublicCloudIdentity,

    updateCloudIdentity,

    updateCloudConnection,

    refreshLocalReferences,

    sincronizarConCloud,

    leerIdentidadCompartida,

    obtenerRutaIdentidadCompartida,

    obtenerRutaCloud

};