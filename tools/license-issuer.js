"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const PRIVATE_KEY_FILE =
    path.join(
        os.homedir(),
        "LINK-Secrets",
        "license-private.pem"
    );

function readPrivateKey(){

    return fs.readFileSync(

        PRIVATE_KEY_FILE,

        "utf8"

    );

}

function createLicense(data){

    const payload = {

        schemaVersion:1,

        /*
        Identificador único de la licencia.
        Nunca debe repetirse.
        */

        licenseId:

            crypto.randomUUID(),

        /*
        Producto al que pertenece
        */

        productId:

            "com.link.kiosco.turnos",

        productName:

            "LINK Kiosco de Turnos",

        /*
        Cliente
        */

        customer:

            data.customer,

        /*
        Tipo
        */

        type:

            data.type,

        /*
        Hardware
        */

        hardwareId:

            data.hardwareId,

        hardwareCode:

            data.hardwareCode,

        /*
        Instalación
        */

        deviceId:

            data.deviceId,

        /*
        Emisión
        */

        issuedAt:

            new Date().toISOString(),

        /*
        Expiración
        */

        expiration:

            data.expiration,

        /*
        Empresa emisora
        */

        issuer:

            "LINK"

    };

    const signer=

        crypto.sign(

            null,

            Buffer.from(

                JSON.stringify(

                    payload

                )

            ),

            readPrivateKey()

        );

    return{

        payload,

        signature:

            signer.toString(

                "base64"

            )

    };

}

module.exports={

    createLicense

};