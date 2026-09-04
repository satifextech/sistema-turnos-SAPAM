"use strict";

const fs = require("fs");
const path = require("path");

const ROOT_DIR =
    path.resolve(
        __dirname,
        ".."
    );

const VERSION_FILE =
    path.join(
        ROOT_DIR,
        "config",
        "version.json"
    );

const PACKAGE_FILE =
    path.join(
        ROOT_DIR,
        "package.json"
    );

const RELEASE_DIR =
    path.join(
        ROOT_DIR,
        "release"
    );

const RELEASE_FILE =
    path.join(
        RELEASE_DIR,
        "release.json"
    );

const HISTORY_FILE =
    path.join(
        RELEASE_DIR,
        "history.json"
    );

function readJson(filePath) {

    const rawContent =
        fs.readFileSync(
            filePath,
            "utf8"
        )
        .replace(
            /^\uFEFF/,
            ""
        );

    return JSON.parse(
        rawContent
    );

}

function writeJson(
    filePath,
    data
) {

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

function validateVersion(
    version
) {

    const semanticVersionPattern =
        /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

    if(
        !semanticVersionPattern
            .test(
                version
            )
    ){

        throw new Error(
            `La versión "${version}" no cumple con versionado semántico.`
        );

    }

}

function validateBuild(
    build
) {

    const buildPattern =
        /^\d{4}\.\d{2}\.\d{2}$/;

    if(
        !buildPattern
            .test(
                build
            )
    ){

        throw new Error(
            `La compilación "${build}" debe usar el formato AAAA.MM.DD.`
        );

    }

}

function validateIdentity(
    identity
) {

    if(
        !identity
        || typeof identity !== "object"
    ){

        throw new Error(
            "config/version.json no contiene un objeto válido."
        );

    }

    const requiredFields = [

        [
            "product.name",
            identity.product?.name
        ],

        [
            "product.company",
            identity.product?.company
        ],

        [
            "product.appId",
            identity.product?.appId
        ],

        [
            "release.version",
            identity.release?.version
        ],

        [
            "release.channel",
            identity.release?.channel
        ],

        [
            "release.codename",
            identity.release?.codename
        ],

        [
            "release.build",
            identity.release?.build
        ]

    ];

    for(
        const [
            fieldName,
            value
        ]
        of requiredFields
    ){

        if(
            typeof value !== "string"
            || !value.trim()
        ){

            throw new Error(
                `Falta el campo obligatorio ${fieldName} en config/version.json.`
            );

        }

    }

    validateVersion(
        identity.release.version
    );

    validateBuild(
        identity.release.build
    );

}

function synchronizePackage(
    packageInfo,
    identity
) {

    const expectedVersion =
        identity.release.version;

    const expectedProductName =
        identity.product.name;

    const expectedAppId =
        identity.product.appId;

    packageInfo.version =
        expectedVersion;

    packageInfo.productName =
        expectedProductName;

    if(
        !packageInfo.build
        || typeof packageInfo.build !== "object"
    ){

        packageInfo.build =
            {};

    }

    packageInfo.build.appId =
        expectedAppId;

    packageInfo.build.productName =
        expectedProductName;

    packageInfo.build.copyright =
        `${identity.legal?.copyright || ""} ${identity.legal?.rights || ""}`
            .trim();

    return packageInfo;

}

function createReleaseManifest(
    identity
) {

    const version =
        identity.release.version;

    return {

        schemaVersion:
            1,

        product:{
            name:
                identity.product.name,

            company:
                identity.product.company,

            appId:
                identity.product.appId
        },

        release:{
            version,

            channel:
                identity.release.channel,

            codename:
                identity.release.codename,

            build:
                identity.release.build,

            releaseDate:
                identity.release.build
                    .replace(
                        /\./g,
                        "-"
                    )
        },

        installer:{
            fileName:
                `LINK-Kiosco-de-Turnos-Setup-${version}.exe`,

            sha256:
                "",

            sizeBytes:
                null
        },

        compatibility:{
            minimumVersion:
                "1.0.0",

            preservesLocalData:
                true
        },

        distribution:{
            published:
                false,

            downloadUrl:
                ""
        },

        generatedAt:
            new Date()
                .toISOString()

    };

}

function updateHistory(identity){

    let history = [];

    if(
        fs.existsSync(
            HISTORY_FILE
        )
    ){

        history =
            readJson(
                HISTORY_FILE
            );

        if(
            !Array.isArray(history)
        ){

            history = [];

        }

    }

    const alreadyExists =
        history.some(

            release=>

                release.version
                ===
                identity.release.version

        );

    if(!alreadyExists){

        history.push({

            version:
                identity.release.version,

            codename:
                identity.release.codename,

            channel:
                identity.release.channel,

            build:
                identity.release.build,

            released:
                false

        });

    }

    history.sort(

        (
            a,
            b
        )=>

            a.version.localeCompare(

                b.version,

                undefined,

                {

                    numeric:true

                }

            )

    );

    writeJson(

        HISTORY_FILE,

        history

    );

}

function main() {

    console.log(
        "LINK Version Sync"
    );

    console.log(
        "================="
    );

    const identity =
        readJson(
            VERSION_FILE
        );

    validateIdentity(
        identity
    );

    const packageInfo =
        readJson(
            PACKAGE_FILE
        );

    const synchronizedPackage =
        synchronizePackage(
            packageInfo,
            identity
        );

    fs.mkdirSync(
        RELEASE_DIR,
        {
            recursive:
                true
        }
    );

    const releaseManifest =
        createReleaseManifest(
            identity
        );

    writeJson(
        PACKAGE_FILE,
        synchronizedPackage
    );

    writeJson(
        RELEASE_FILE,
        releaseManifest
    );

    updateHistory(
        identity
    );

    console.log(
        `✔ Versión validada: ${identity.release.version}`
    );

    console.log(
        `✔ Codename: ${identity.release.codename}`
    );

    console.log(
        `✔ Build: ${identity.release.build}`
    );

    console.log(
        "✔ package.json sincronizado"
    );

    console.log(
        "✔ release/release.json generado"
    );

    console.log(
        "✔ history.json actualizado"
    );

    console.log(
        "✔ LINK Identity sincronizada correctamente"
    );

}

try{

    main();

}catch(error){

    console.error(
        "\n✖ Error de sincronización:"
    );

    console.error(
        error.message
    );

    process.exitCode =
        1;

}
