"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT =
    path.resolve(
        __dirname,
        ".."
    );

const VERSION_FILE =
    path.join(
        ROOT,
        "config",
        "version.json"
    );

const PACKAGE_FILE =
    path.join(
        ROOT,
        "package.json"
    );

function leerJSON(ruta){

    const contenido =
        fs.readFileSync(
            ruta,
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

function comandoVersion(){

    const version =
        leerJSON(
            VERSION_FILE
        );

    console.log("");

    console.log(
        "======================================"
    );

    console.log(
        " LINK PLATFORM"
    );

    console.log(
        "======================================"
    );

    console.log("");

    console.log(
        `Producto : ${version.product.name}`
    );

    console.log(
        `Empresa  : ${version.product.company}`
    );

    console.log(
        `Versión  : ${version.release.version}`
    );

    console.log(
        `Canal    : ${version.release.channel}`
    );

    console.log(
        `Codename : ${version.release.codename}`
    );

    console.log(
        `Build    : ${version.release.build}`
    );

    console.log("");

}

function comandoDoctor(){

    console.log("");

    console.log(
        "LINK Doctor"
    );

    console.log(
        "============"
    );

    const archivos = [

        VERSION_FILE,

        PACKAGE_FILE,

        path.join(
            ROOT,
            "services",
            "about.service.js"
        ),

        path.join(
            ROOT,
            "release",
            "release.json"
        )

    ];

    let errores = 0;

    archivos.forEach(

        archivo=>{

            if(
                fs.existsSync(
                    archivo
                )
            ){

                try{

                    if(
                        path.extname(
                            archivo
                        ).toLowerCase()
                        === ".json"
                    ){

                        leerJSON(
                            archivo
                        );

                    }

                    console.log(
                        "✔",
                        path.relative(
                            ROOT,
                            archivo
                        )
                    );

                }catch(error){

                    console.log(
                        "✖",
                        path.relative(
                            ROOT,
                            archivo
                        ),
                        "-",
                        error.message
                    );

                    errores++;

                }

            }

            else{

                console.log(
                    "✖",
                    path.relative(
                        ROOT,
                        archivo
                    )
                );

                errores++;

            }

        }

    );

    console.log("");

    if(errores===0){

        console.log(
            "Sistema correcto."
        );

    }

    else{

        console.log(
            `${errores} problema(s) encontrados.`
        );
        process.exitCode =
            1;

    }

}

function comandoSync(){

    execSync(

        "node tools/version-sync.js",

        {

            cwd:ROOT,

            stdio:"inherit"

        }

    );

}

function comandoRelease(){

    const resultado =
        execSync(
            `"${process.execPath}" tools/release-manager.js`,
            {
                cwd:
                    ROOT,

                stdio:
                    "inherit"
            }
        );

    return resultado;

}

const comando =
    process.argv[2];

switch(comando){

    case "version":

        comandoVersion();

        break;

    case "doctor":

        comandoDoctor();

        break;

    case "sync":

        comandoSync();

        break;

    case "release":

        comandoRelease();

        break;

    default:

        console.log("");

        console.log(
            "LINK CLI"
        );

        console.log("");

        console.log(
            "Comandos disponibles:"
        );

        console.log("");

        console.log(
            "link version"
        );

        console.log(
            "link doctor"
        );

        console.log(
            "link sync"
        );

        console.log(
            "link release"
        );

        console.log("");

}