"use strict";

const fs = require("fs");
const readline = require("readline");

const issuer =
    require("./license-issuer");

const rl =
    readline.createInterface({

        input:process.stdin,

        output:process.stdout

    });

function ask(text){

    return new Promise(

        resolve=>

            rl.question(

                text,

                resolve

            )

    );

}

(async()=>{

    console.log("");

    console.log(

        "=============================="

    );

    console.log(

        " LINK LICENSE GENERATOR"

    );

    console.log(

        "=============================="

    );

    console.log("");

    const customer=

        await ask(

            "Cliente: "

        );

    const type=

        await ask(

            "Tipo (developer/commercial): "

        );

    const hardwareId=

        await ask(

            "Hardware ID: "

        );

    const hardwareCode=

        await ask(

            "Hardware Code: "

        );

    const deviceId=

        await ask(

            "Device ID: "

        );

    const expiration=

        await ask(

            "Expiración (AAAA-MM-DD): "

        );

    rl.close();

    const licencia=

        issuer.createLicense({

            customer,

            type,

            hardwareId,

            hardwareCode,

            deviceId,

            expiration:

                expiration+

                "T00:00:00Z"

        });

    const fileName=

        customer

        .replace(

            /\s+/g,

            "_"

        )

        +

        ".lic";

    fs.writeFileSync(

        fileName,

        JSON.stringify(

            licencia,

            null,

            2

        )

    );

    console.log("");

    console.log(

        "Licencia creada."

    );

    console.log(

        fileName

    );

})();