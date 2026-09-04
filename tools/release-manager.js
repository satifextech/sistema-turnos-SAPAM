"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const ROOT_DIR =
    path.resolve(__dirname, "..");

const VERSION_FILE =
    path.join(ROOT_DIR, "config", "version.json");

const RELEASE_MANIFEST_FILE =
    path.join(ROOT_DIR, "release", "release.json");

const HISTORY_FILE =
    path.join(ROOT_DIR, "release", "history.json");

const DIST_DIR =
    path.join(ROOT_DIR, "dist");

function readJson(filePath) {

    const content =
        fs.readFileSync(filePath, "utf8")
            .replace(/^\uFEFF/, "");

    return JSON.parse(content);

}

function writeJson(filePath, data) {

    fs.writeFileSync(
        filePath,
        JSON.stringify(data, null, 2) + "\n",
        "utf8"
    );

}

function runNodeScript(relativePath) {

    const result =
        spawnSync(
            process.execPath,
            [path.join(ROOT_DIR, relativePath)],
            {
                cwd: ROOT_DIR,
                stdio: "inherit"
            }
        );

    if(result.status !== 0){

        throw new Error(
            `Falló la ejecución de ${relativePath}.`
        );

    }

}

function runNpmScript(scriptName) {

    let result;

    if(process.platform === "win32"){

        /*
        En Windows, npm.cmd debe ejecutarse mediante cmd.exe.
        Esto evita errores de spawn con archivos .cmd.
        */
        result =
            spawnSync(
                process.env.ComSpec
                || "C:\\Windows\\System32\\cmd.exe",
                [
                    "/d",
                    "/s",
                    "/c",
                    `npm.cmd run ${scriptName}`
                ],
                {
                    cwd:
                        ROOT_DIR,

                    stdio:
                        "inherit",

                    windowsHide:
                        true
                }
            );

    }else{

        result =
            spawnSync(
                "npm",
                [
                    "run",
                    scriptName
                ],
                {
                    cwd:
                        ROOT_DIR,

                    stdio:
                        "inherit"
                }
            );

    }

    if(result.error){

        throw new Error(
            `No se pudo iniciar npm run ${scriptName}: `
            + result.error.message
        );

    }

    if(result.status !== 0){

        throw new Error(
            `Falló npm run ${scriptName} `
            + `(código ${result.status ?? "desconocido"}).`
        );

    }

}

function calculateSha256(filePath) {

    const hash =
        crypto.createHash("sha256");

    const fileBuffer =
        fs.readFileSync(filePath);

    hash.update(fileBuffer);

    return hash.digest("hex");

}

function findInstaller(version) {

    const expectedName =
        `LINK-Kiosco-de-Turnos-Setup-${version}.exe`;

    const expectedPath =
        path.join(DIST_DIR, expectedName);

    if(fs.existsSync(expectedPath)){

        return expectedPath;

    }

    if(!fs.existsSync(DIST_DIR)){

        throw new Error(
            "No existe la carpeta dist."
        );

    }

    const candidates =
        fs.readdirSync(DIST_DIR)
            .filter(
                fileName =>
                    fileName.toLowerCase().endsWith(".exe")
                    &&
                    fileName.includes(version)
                    &&
                    !fileName.toLowerCase().includes("unpacked")
            );

    if(candidates.length !== 1){

        throw new Error(
            `No se encontró de forma inequívoca el instalador de la versión ${version}.`
        );

    }

    return path.join(
        DIST_DIR,
        candidates[0]
    );

}

function createReleaseNotes(identity) {

    return `# LINK Kiosco de Turnos ${identity.release.version}

## ${identity.release.codename}

- **Canal:** ${identity.release.channel}
- **Compilación:** ${identity.release.build}
- **Empresa:** ${identity.product.company}
- **Producto:** ${identity.product.description}

## Cambios principales

- Incorporación de la función Volver a llamar turno.
- Protección contra solicitudes duplicadas de rellamado.
- Incorporación de LINK Identity.
- Información de versión centralizada.
- Pantalla Acerca de.
- Automatización de versión y liberaciones.

## Compatibilidad

Esta actualización conserva los datos locales, usuarios, configuración,
respaldos, videos, trámites, mesas y reglas existentes.

## Operación

El funcionamiento local de los turnos no depende de Internet.

---

${identity.legal.copyright}
${identity.legal.rights}
`;

}

function updateHistory(identity) {

    let history = [];

    if(fs.existsSync(HISTORY_FILE)){

        history =
            readJson(HISTORY_FILE);

    }

    if(!Array.isArray(history)){

        throw new Error(
            "release/history.json debe contener un arreglo."
        );

    }

    const index =
        history.findIndex(
            item =>
                item.version === identity.release.version
        );

    const releaseRecord = {
        version:
            identity.release.version,

        codename:
            identity.release.codename,

        channel:
            identity.release.channel,

        build:
            identity.release.build,

        released:
            true
    };

    if(index >= 0){

        history[index] =
            {
                ...history[index],
                ...releaseRecord
            };

    }else{

        history.push(
            releaseRecord
        );

    }

    history.sort(
        (a, b) =>
            a.version.localeCompare(
                b.version,
                undefined,
                {
                    numeric: true
                }
            )
    );

    writeJson(
        HISTORY_FILE,
        history
    );

}

function main() {

    console.log("");
    console.log("LINK Release Manager");
    console.log("====================");
    console.log("");

    console.log("1. Sincronizando identidad y versión...");

    runNodeScript(
        "tools/version-sync.js"
    );

    const identity =
        readJson(VERSION_FILE);

    const version =
        identity.release.version;

    const releaseFolder =
        path.join(
            ROOT_DIR,
            "release",
            version
        );

    fs.mkdirSync(
        releaseFolder,
        {
            recursive: true
        }
    );

    console.log("");
    console.log("2. Validando proyecto...");

    const doctorResult =
        spawnSync(
            process.execPath,
            [
                path.join(
                    ROOT_DIR,
                    "tools",
                    "link-cli.js"
                ),
                "doctor"
            ],
            {
                cwd:
                    ROOT_DIR,

                stdio:
                    "inherit"
            }
        );

    if(doctorResult.status !== 0){

        throw new Error(
            "LINK Doctor detectó problemas."
        );

    }

    console.log("");
    console.log("3. Generando instalador...");

    runNpmScript(
        "dist"
    );

    console.log("");
    console.log("4. Localizando instalador...");

    const installerSource =
        findInstaller(version);

    const installerName =
        path.basename(installerSource);

    const installerDestination =
        path.join(
            releaseFolder,
            installerName
        );

    fs.copyFileSync(
        installerSource,
        installerDestination
    );

    console.log("");
    console.log("5. Calculando integridad SHA-256...");

    const sha256 =
        calculateSha256(
            installerDestination
        );

    const fileStats =
        fs.statSync(
            installerDestination
        );

    const releaseManifest =
        readJson(
            RELEASE_MANIFEST_FILE
        );

    releaseManifest.installer.fileName =
        installerName;

    releaseManifest.installer.sha256 =
        sha256;

    releaseManifest.installer.sizeBytes =
        fileStats.size;

    releaseManifest.distribution.published =
        false;

    releaseManifest.generatedAt =
        new Date().toISOString();

    writeJson(
        RELEASE_MANIFEST_FILE,
        releaseManifest
    );

    writeJson(
        path.join(
            releaseFolder,
            "release.json"
        ),
        releaseManifest
    );

    fs.writeFileSync(
        path.join(
            releaseFolder,
            "SHA256.txt"
        ),
        `${sha256}  ${installerName}\n`,
        "utf8"
    );

    fs.writeFileSync(
        path.join(
            releaseFolder,
            "RELEASE_NOTES.md"
        ),
        createReleaseNotes(identity),
        "utf8"
    );

    writeJson(
        path.join(
            releaseFolder,
            "BUILD_INFO.json"
        ),
        {
            schemaVersion:
                1,

            product:
                identity.product.name,

            version:
                identity.release.version,

            codename:
                identity.release.codename,

            channel:
                identity.release.channel,

            build:
                identity.release.build,

            node:
                process.versions.node,

            platform:
                process.platform,

            architecture:
                process.arch,

            installer:
                installerName,

            sha256,

            sizeBytes:
                fileStats.size,

            generatedAt:
                new Date().toISOString()
        }
    );

    updateHistory(
        identity
    );

    console.log("");
    console.log("6. Expediente de liberación generado.");
    console.log("");
    console.log(`✔ Versión: ${version} ${identity.release.codename}`);
    console.log(`✔ Instalador: ${installerName}`);
    console.log(`✔ SHA-256: ${sha256}`);
    console.log(`✔ Carpeta: release\\${version}`);
    console.log("");
    console.log("LINK Release finalizado correctamente.");
    console.log("");

}

try{

    main();

}catch(error){

    console.error("");
    console.error("✖ LINK Release falló:");
    console.error(error.message);
    console.error("");

    process.exitCode =
        1;

}
