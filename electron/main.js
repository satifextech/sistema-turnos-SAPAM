const {
    app,
    BrowserWindow,
    dialog
} = require("electron");

const {
    spawn
} = require("child_process");

const fs =
    require("fs");

const path =
    require("path");

const http =
    require("http");


let ventanaPrincipal =
    null;

let procesoServidor =
    null;

let cerrandoAplicacion =
    false;


const PUERTO =
    3000;

const URL_SERVIDOR =
    `http://127.0.0.1:${PUERTO}`;


/*
=========================================================
IDENTIDAD
=========================================================
*/

app.setName(
    "LINK Kiosco de Turnos"
);

app.setAppUserModelId(
    "com.link.kiosco.turnos"
);

/*
=========================================================
RUTAS
=========================================================
*/

function obtenerRutaProyecto(){

    if(app.isPackaged){

        return path.join(
            process.resourcesPath,
            "app"
        );

    }

    return path.resolve(
        __dirname,
        ".."
    );

}


function obtenerCarpetaDatos(){

    return app.getPath(
        "userData"
    );

}


function asegurarCarpetasDatos(){

    const carpetaDatos =
        obtenerCarpetaDatos();

    const carpetas = [

        carpetaDatos,

        path.join(
            carpetaDatos,
            "database"
        ),

        path.join(
            carpetaDatos,
            "backups"
        ),

        path.join(
            carpetaDatos,
            "logs"
        ),

        path.join(
            carpetaDatos,
            "videos"
        )

    ];

    for(const carpeta of carpetas){

        fs.mkdirSync(
            carpeta,
            {
                recursive:true
            }
        );

    }

}


/*
=========================================================
COPIAR ARCHIVOS INICIALES
=========================================================
*/

function copiarArchivoSiNoExiste(
    origen,
    destino
){

    if(
        !fs.existsSync(origen)
        || fs.existsSync(destino)
    ){

        return false;

    }

    fs.mkdirSync(
        path.dirname(destino),
        {
            recursive:true
        }
    );

    fs.copyFileSync(
        origen,
        destino
    );

    return true;

}


function copiarDirectorioSiFalta(
    origen,
    destino
){

    if(
        !fs.existsSync(origen)
    ){

        return;
    }

    fs.mkdirSync(
        destino,
        {
            recursive:true
        }
    );

    const elementos =
        fs.readdirSync(
            origen,
            {
                withFileTypes:true
            }
        );

    for(const elemento of elementos){

        const rutaOrigen =
            path.join(
                origen,
                elemento.name
            );

        const rutaDestino =
            path.join(
                destino,
                elemento.name
            );

        if(elemento.isDirectory()){

            copiarDirectorioSiFalta(
                rutaOrigen,
                rutaDestino
            );

            continue;

        }

        copiarArchivoSiNoExiste(
            rutaOrigen,
            rutaDestino
        );

    }

}


function prepararDatosIniciales(){

    asegurarCarpetasDatos();

    const rutaProyecto =
        obtenerRutaProyecto();

    const carpetaDatos =
        obtenerCarpetaDatos();

    const baseOrigen =
        path.join(
            rutaProyecto,
            "database",
            "turnos.db"
        );

    const baseDestino =
        path.join(
            carpetaDatos,
            "database",
            "turnos.db"
        );

    const baseCopiada =
        copiarArchivoSiNoExiste(
            baseOrigen,
            baseDestino
        );

    if(baseCopiada){

        console.log(
            "Base de datos inicial copiada a:",
            baseDestino
        );

    }

    const videosOrigen =
        path.join(
            rutaProyecto,
            "public",
            "assets",
            "videos"
        );

    const videosDestino =
        path.join(
            carpetaDatos,
            "videos"
        );

    copiarDirectorioSiFalta(
        videosOrigen,
        videosDestino
    );

}


/*
=========================================================
COMPROBAR PUERTO
=========================================================
*/

function comprobarPuertoServidor(){

    return new Promise(
        resolve => {

            let finalizado =
                false;

            const terminar =
                resultado => {

                    if(finalizado){
                        return;
                    }

                    finalizado =
                        true;

                    resolve(
                        resultado
                    );

                };

            const solicitud =
                http.get(
                    URL_SERVIDOR,
                    respuesta => {

                        let contenido =
                            "";

                        respuesta.setEncoding(
                            "utf8"
                        );

                        respuesta.on(
                            "data",
                            fragmento => {

                                contenido +=
                                    fragmento;

                            }
                        );

                        respuesta.on(
                            "end",
                            ()=>{

                                terminar({
                                    ocupado:true,
                                    esLINK:
                                        contenido.includes(
                                            "Servidor funcionando"
                                        )
                                });

                            }
                        );

                    }
                );

            solicitud.setTimeout(
                1000,
                ()=>{

                    solicitud.destroy();

                    terminar({
                        ocupado:false,
                        esLINK:false
                    });

                }
            );

            solicitud.on(
                "error",
                ()=>{

                    terminar({
                        ocupado:false,
                        esLINK:false
                    });

                }
            );

        }
    );

}


/*
=========================================================
ESPERAR SERVIDOR
=========================================================
*/

function esperarServidor(
    intentosRestantes = 40
){

    return new Promise(
        (
            resolve,
            reject
        )=>{

            const solicitud =
                http.get(
                    URL_SERVIDOR,
                    respuesta => {

                        respuesta.resume();

                        resolve();

                    }
                );

            solicitud.setTimeout(
                1000,
                ()=>{

                    solicitud.destroy();

                }
            );

            solicitud.on(
                "error",
                ()=>{

                    if(
                        intentosRestantes <= 0
                    ){

                        reject(
                            new Error(
                                "El servidor no respondió dentro del tiempo esperado."
                            )
                        );

                        return;

                    }

                    setTimeout(
                        ()=>{

                            esperarServidor(
                                intentosRestantes - 1
                            )
                                .then(resolve)
                                .catch(reject);

                        },
                        500
                    );

                }
            );

        }
    );

}


/*
=========================================================
INICIAR SERVIDOR
=========================================================
*/

function iniciarServidor(){

    return new Promise(
        (
            resolve,
            reject
        )=>{

            const rutaProyecto =
                obtenerRutaProyecto();

            const archivoServidor =
                path.join(
                    rutaProyecto,
                    "server",
                    "server.js"
                );

            const variablesEntorno = {

                ...process.env,

                PORT:
                    String(PUERTO),

                ELECTRON_RUN_AS_NODE:
                    "1",

                LINK_ELECTRON:
                    "1",

                LINK_DATA_DIR:
                    obtenerCarpetaDatos()

            };

            procesoServidor =
                spawn(
                    process.execPath,
                    [
                        archivoServidor
                    ],
                    {
                        cwd:
                            rutaProyecto,

                        env:
                            variablesEntorno,

                        stdio:[
                            "ignore",
                            "pipe",
                            "pipe"
                        ],

                        windowsHide:
                            true
                    }
                );

            procesoServidor.stdout.on(
                "data",
                datos => {

                    console.log(
                        `[SERVIDOR] ${datos}`
                    );

                }
            );

            procesoServidor.stderr.on(
                "data",
                datos => {

                    console.error(
                        `[SERVIDOR] ${datos}`
                    );

                }
            );

            procesoServidor.once(
                "error",
                error => {

                    reject(
                        error
                    );

                }
            );

            procesoServidor.once(
                "exit",
                codigo => {

                    console.log(
                        `Servidor finalizado con código ${codigo}`
                    );

                    procesoServidor =
                        null;

                    if(
                        !cerrandoAplicacion
                        && ventanaPrincipal
                    ){

                        dialog.showErrorBox(
                            "Servidor detenido",
                            "El servidor interno de LINK Kiosco de Turnos "
                            + "se cerró inesperadamente."
                        );

                    }

                }
            );

            esperarServidor()
                .then(resolve)
                .catch(reject);

        }
    );

}


/*
=========================================================
VENTANA PRINCIPAL
=========================================================
*/

function crearVentanaPrincipal(){

    ventanaPrincipal =
        new BrowserWindow({

            width:
                1280,

            height:
                820,

            minWidth:
                1000,

            minHeight:
                700,

            show:
                false,

            autoHideMenuBar:
                true,

            backgroundColor:
                "#f4f1f2",

            title:
                "LINK Kiosco de Turnos",

            icon:
                path.join(
                    obtenerRutaProyecto(),
                    "build",
                    "icon.ico"
                ),

            webPreferences:{

                nodeIntegration:
                    false,

                contextIsolation:
                    true,

                sandbox:
                    true

            }

        });

    ventanaPrincipal.loadURL(
        `${URL_SERVIDOR}/login`
    );

    ventanaPrincipal.once(
        "ready-to-show",
        ()=>{

            ventanaPrincipal.show();

            ventanaPrincipal.focus();

        }
    );

    ventanaPrincipal.on(
        "closed",
        ()=>{

            ventanaPrincipal =
                null;

        }
    );

}


/*
=========================================================
CERRAR SERVIDOR
=========================================================
*/

function detenerServidor(){

    if(!procesoServidor){
        return;
    }

    try{

        procesoServidor.kill(
            "SIGTERM"
        );

    }catch(error){

        console.error(
            "No se pudo cerrar el servidor:",
            error
        );

    }

    procesoServidor =
        null;

}


/*
=========================================================
CICLO DE VIDA
=========================================================
*/

app.whenReady()
    .then(
        async ()=>{

            try{

                prepararDatosIniciales();

                const estadoPuerto =
                    await comprobarPuertoServidor();

                if(estadoPuerto.ocupado){

                    if(estadoPuerto.esLINK){

                        throw new Error(
                            "Ya existe una instancia del servidor "
                            + "de LINK Kiosco de Turnos utilizando "
                            + "el puerto 3000."
                        );

                    }

                    throw new Error(
                        "El puerto 3000 está siendo utilizado "
                        + "por otro programa."
                    );

                }

                await iniciarServidor();

                crearVentanaPrincipal();

            }catch(error){

                console.error(
                    "No se pudo iniciar LINK Kiosco de Turnos:",
                    error
                );

                dialog.showErrorBox(
                    "Error al iniciar LINK Kiosco de Turnos",
                    error.message
                    || "No se pudo iniciar el servidor interno."
                );

                app.quit();

            }

        }
    );


app.on(
    "before-quit",
    ()=>{

        cerrandoAplicacion =
            true;

        detenerServidor();

    }
);


app.on(
    "window-all-closed",
    ()=>{

        app.quit();

    }
);