"use strict";

const licenseService =
    require(
        "../services/license/license.service"
    );

const LICENSE_MESSAGES = {

    NO_LICENSE:
        "No existe una licencia instalada.",

    INVALID_JSON:
        "El archivo de licencia está dañado.",

    INVALID_STRUCTURE:
        "La licencia tiene una estructura inválida.",

    INVALID_SIGNATURE:
        "La firma digital de la licencia no es válida.",

    UNSUPPORTED_SCHEMA:
        "La versión del formato de licencia no es compatible.",

    PRODUCT_CONFIGURATION_ERROR:
        "La configuración del producto no pudo validarse.",

    PRODUCT_MISMATCH:
        "La licencia pertenece a otro producto.",

    INVALID_ISSUER:
        "La licencia no fue emitida por LINK.",

    INVALID_ISSUED_AT:
        "La fecha de emisión de la licencia no es válida.",

    ISSUED_IN_FUTURE:
        "La licencia tiene una fecha de emisión futura.",

    INVALID_EXPIRATION:
        "La fecha de expiración no es válida.",

    EXPIRED:
        "La licencia está vencida.",

    HARDWARE_MISMATCH:
        "La licencia no pertenece a esta computadora.",

    DEVICE_MISMATCH:
        "La licencia no pertenece a esta instalación."

};

function getLicenseMessage(reason) {

    return (
        LICENSE_MESSAGES[reason]
        ||
        "La licencia no pudo validarse."
    );

}

function validarLicenciaDeInicio() {

    const resultado =
        licenseService.validarLicencia();

    if(!resultado.valid) {

        const error =
            new Error(
                getLicenseMessage(
                    resultado.reason
                )
            );

        error.code =
            resultado.reason;

        error.licenseResult =
            resultado;

        throw error;

    }

    return resultado;

}

function requerirLicencia(
    req,
    res,
    next
) {

    const resultado =
        licenseService.validarLicencia();

    if(!resultado.valid) {

        return res.status(403).json({

            success:
                false,

            error:
                "LICENSE_REQUIRED",

            reason:
                resultado.reason,

            message:
                getLicenseMessage(
                    resultado.reason
                )

        });

    }

    req.linkLicense =
        resultado.license;

    next();

}

module.exports = {

    validarLicenciaDeInicio,

    requerirLicencia,

    getLicenseMessage

};