"use strict";

const fs =
    require("fs");

const path =
    require("path");

const ROOT_DIRECTORY =
    path.resolve(
        __dirname,
        "..",
        ".."
    );

const PACKAGE_FILE =
    path.join(
        ROOT_DIRECTORY,
        "package.json"
    );

const VERSION_FILE =
    path.join(
        ROOT_DIRECTORY,
        "config",
        "version.json"
    );

function readJsonFile(
    filePath,
    label
) {

    if(
        !fs.existsSync(
            filePath
        )
    ) {

        throw new Error(
            `${label} no existe: ${filePath}`
        );

    }

    const content =
        fs.readFileSync(
            filePath,
            "utf8"
        )
        .replace(
            /^\uFEFF/,
            ""
        );

    try {

        return JSON.parse(
            content
        );

    } catch(error) {

        throw new Error(
            `${label} contiene JSON inválido: ${error.message}`
        );

    }

}

function getRuntimeIdentity() {

    const packageInfo =
        readJsonFile(
            PACKAGE_FILE,
            "package.json"
        );

    const versionInfo =
        readJsonFile(
            VERSION_FILE,
            "config/version.json"
        );

    const product =
        versionInfo.product
        || {};

    const release =
        versionInfo.release
        || {};

    return {

        schemaVersion:
            Number(
                versionInfo.schemaVersion
                || 1
            ),

        product: {

            code:
                "LINK-KIOSCO",

            appId:
                String(
                    product.appId
                    || "com.link.kiosco.turnos"
                ),

            name:
                String(
                    product.name
                    || packageInfo.productName
                    || "LINK Kiosco de Turnos"
                ),

            company:
                String(
                    product.company
                    || "LINK"
                )

        },

        release: {

            version:
                String(
                    release.version
                    || packageInfo.version
                    || "0.0.0"
                ),

            channel:
                String(
                    release.channel
                    || "stable"
                ),

            codename:
                release.codename
                ? String(
                    release.codename
                )
                : null,

            build:
                release.build
                ? String(
                    release.build
                )
                : null

        },

        runtime: {

            node:
                process.versions.node
                || null,

            electron:
                process.versions.electron
                || null,

            chrome:
                process.versions.chrome
                || null,

            platform:
                process.platform,

            architecture:
                process.arch

        }

    };

}

function getHealthStatus() {

    const identity =
        getRuntimeIdentity();

    return {

        success:
            true,

        status:
            "healthy",

        product:
            identity.product,

        version:
            identity.release.version,

        channel:
            identity.release.channel,

        uptimeSeconds:
            Math.floor(
                process.uptime()
            ),

        serverTime:
            new Date()
                .toISOString()

    };

}

function getVersionStatus() {

    const identity =
        getRuntimeIdentity();

    return {

        success:
            true,

        schemaVersion:
            identity.schemaVersion,

        product:
            identity.product,

        release:
            identity.release,

        runtime:
            identity.runtime,

        serverTime:
            new Date()
                .toISOString()

    };

}

module.exports = {

    getRuntimeIdentity,

    getHealthStatus,

    getVersionStatus

};