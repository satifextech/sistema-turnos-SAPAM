"use strict";

const licenseService =
    require("./license.service");

const LICENSE_STATUS =
    require("./license-status");

const WARNING_DAYS =
    30;

const GRACE_DAYS =
    7;

function calcularDiasRestantes(
    expiration
) {

    if(!expiration) {

        return null;

    }

    const ahora =
        Date.now();

    const vence =
        new Date(
            expiration
        ).getTime();

    if(
        Number.isNaN(
            vence
        )
    ) {

        return null;

    }

    const diferencia =
        vence - ahora;

    return Math.ceil(
        diferencia
        /
        (
            1000
            *
            60
            *
            60
            *
            24
        )
    );

}

function mapearEstadoInvalido(
    reason
) {

    switch(reason) {

        case "NO_LICENSE":

            return LICENSE_STATUS
                .NOT_INSTALLED;

        case "EXPIRED":

            return LICENSE_STATUS
                .EXPIRED;

        case "HARDWARE_MISMATCH":

            return LICENSE_STATUS
                .HARDWARE_MISMATCH;

        case "DEVICE_MISMATCH":

            return LICENSE_STATUS
                .DEVICE_MISMATCH;

        case "PRODUCT_MISMATCH":

            return LICENSE_STATUS
                .PRODUCT_MISMATCH;

        default:

            return LICENSE_STATUS
                .INVALID;

    }

}

function getStatus() {

    const validation =
        licenseService
            .validarLicencia();

    if(!validation.valid) {

        return {

            valid:
                false,

            status:
                mapearEstadoInvalido(
                    validation.reason
                ),

            reason:
                validation.reason,

            message:
                validation.message
                ||
                null,

            customer:
                null,

            type:
                null,

            licenseId:
                null,

            expiration:
                validation.expiration
                ||
                null,

            daysRemaining:
                validation.expiration
                    ?
                    calcularDiasRestantes(
                        validation.expiration
                    )
                    :
                    null,

            warning:
                false,

            blocked:
                true,

            grace:
                false

        };

    }

    const license =
        validation.license;

    const daysRemaining =
        calcularDiasRestantes(
            license.expiration
        );

    /*
    Licencia sin expiración.
    */

    if(
        daysRemaining === null
    ) {

        return {

            valid:
                true,

            status:
                LICENSE_STATUS.ACTIVE,

            reason:
                "OK",

            customer:
                license.customer,

            type:
                license.type,

            licenseId:
                license.licenseId,

            expiration:
                null,

            daysRemaining:
                null,

            warning:
                false,

            blocked:
                false,

            grace:
                false,

            license

        };

    }

    /*
    Licencia vencida.
    license.service.js ya debe marcarla
    como inválida antes de llegar aquí,
    pero mantenemos esta defensa.
    */

    if(
        daysRemaining < 0
    ) {

        const daysExpired =
            Math.abs(
                daysRemaining
            );

        /*
        Reservamos el modo gracia para
        una activación posterior.
        Por ahora no permite operar.
        */

        if(
            daysExpired <= GRACE_DAYS
        ) {

            return {

                valid:
                    false,

                status:
                    LICENSE_STATUS.GRACE,

                reason:
                    "EXPIRED_GRACE",

                customer:
                    license.customer,

                type:
                    license.type,

                licenseId:
                    license.licenseId,

                expiration:
                    license.expiration,

                daysRemaining,

                daysExpired,

                warning:
                    true,

                blocked:
                    true,

                grace:
                    true,

                graceDays:
                    GRACE_DAYS,

                license

            };

        }

        return {

            valid:
                false,

            status:
                LICENSE_STATUS.EXPIRED,

            reason:
                "EXPIRED",

            customer:
                license.customer,

            type:
                license.type,

            licenseId:
                license.licenseId,

            expiration:
                license.expiration,

            daysRemaining,

            daysExpired,

            warning:
                false,

            blocked:
                true,

            grace:
                false,

            license

        };

    }

    /*
    Licencia próxima a vencer.
    */

    if(
        daysRemaining <= WARNING_DAYS
    ) {

        return {

            valid:
                true,

            status:
                LICENSE_STATUS.WARNING,

            reason:
                "EXPIRING_SOON",

            customer:
                license.customer,

            type:
                license.type,

            licenseId:
                license.licenseId,

            expiration:
                license.expiration,

            daysRemaining,

            warning:
                true,

            blocked:
                false,

            grace:
                false,

            warningDays:
                WARNING_DAYS,

            license

        };

    }

    return {

        valid:
            true,

        status:
            LICENSE_STATUS.ACTIVE,

        reason:
            "OK",

        customer:
            license.customer,

        type:
            license.type,

        licenseId:
            license.licenseId,

        expiration:
            license.expiration,

        daysRemaining,

        warning:
            false,

        blocked:
            false,

        grace:
            false,

        license

    };

}

function canStart() {

    const status =
        getStatus();

    return (
        status.valid
        &&
        !status.blocked
    );

}

module.exports = {

    getStatus,

    canStart,

    calcularDiasRestantes,

    WARNING_DAYS,

    GRACE_DAYS

};