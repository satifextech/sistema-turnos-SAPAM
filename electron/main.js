const {
    app,
    BrowserWindow,
    dialog,
    ipcMain,
    clipboard
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

const licenseManager =
    require(
        "../services/license/license-manager.service"
    );

const licenseService =
    require(
        "../services/license/license.service"
    );

const deviceService =
    require(
        "../services/license/device.service"
    );

const cloudService =
    require(
        "../services/cloud/cloud.service"
    );


let ventanaPrincipal =
    null;

let ventanaActivacion =
    null;

let ventanaBloqueo =
    null;

let temporizadorValidacionCloud =
    null;

let ultimaAutorizacionCloud =
    null;

let validacionCloudEnProceso =
    false;

let sistemaOperativo =
    false;

let procesoServidor =
    null;

let cerrandoAplicacion =
    false;


const PUERTO =
    3000;

const URL_SERVIDOR =
    `http://127.0.0.1:${PUERTO}`;

const INTERVALO_VALIDACION_CLOUD_MS =
    60 * 1000;

const TOLERANCIA_SIN_CONEXION_MS =
    5 * 60 * 1000;

let estadoBloqueoCloud = {

    code:
        "CLOUD_CHECK_PENDING",

    title:
        "Comprobando LINK Cloud",

    message:
        "Esperando autorización para iniciar el Kiosco.",

    checkedAt:
        null

};

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
MENSAJES DE LICENCIA
=========================================================
*/

const MENSAJES_LICENCIA = {

    NOT_INSTALLED:
        "Este equipo todavía no cuenta con una licencia instalada.",

    EXPIRED:
        "La licencia instalada se encuentra vencida.",

    INVALID:
        "La licencia instalada está dañada o no es válida.",

    HARDWARE_MISMATCH:
        "La licencia instalada pertenece a otra computadora.",

    DEVICE_MISMATCH:
        "La licencia instalada pertenece a otra instalación.",

    PRODUCT_MISMATCH:
        "La licencia instalada pertenece a otro producto.",

    GRACE:
        "La licencia se encuentra fuera de vigencia."

};


function obtenerMensajeLicencia(
    estado
){

    return (
        MENSAJES_LICENCIA[
            estado.status
        ]
        ||
        "LINK Kiosco de Turnos requiere una licencia válida."
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
BLOQUEO POR LINK CLOUD
=========================================================
*/

function actualizarEstadoBloqueoCloud(
    cambios = {}
) {

    estadoBloqueoCloud = {

        ...estadoBloqueoCloud,

        ...cambios,

        checkedAt:
            cambios.checkedAt
            ||
            new Date()
                .toISOString()

    };

    if(
        ventanaBloqueo
        &&
        !ventanaBloqueo.isDestroyed()
    ) {

        ventanaBloqueo.webContents.send(
            "cloud-blocking:status-changed",
            estadoBloqueoCloud
        );

    }

    return estadoBloqueoCloud;

}


function crearVentanaBloqueo() {

    if(
        ventanaBloqueo
        &&
        !ventanaBloqueo.isDestroyed()
    ) {

        ventanaBloqueo.show();

        ventanaBloqueo.focus();

        return ventanaBloqueo;

    }

    ventanaBloqueo =
        new BrowserWindow({

            width:
                820,

            height:
                690,

            minWidth:
                700,

            minHeight:
                620,

            show:
                false,

            autoHideMenuBar:
                true,

            resizable:
                true,

            backgroundColor:
                "#f4f1f2",

            title:
                "LINK Kiosco bloqueado",

            icon:
                path.join(
                    obtenerRutaProyecto(),
                    "build",
                    "icon.ico"
                ),

            webPreferences: {

                preload:
                    path.join(
                        __dirname,
                        "blocking",
                        "blocking.preload.js"
                    ),

                nodeIntegration:
                    false,

                contextIsolation:
                    true,

                sandbox:
                    true

            }

        });

    ventanaBloqueo.loadFile(

        path.join(
            __dirname,
            "blocking",
            "index.html"
        )

    );

    ventanaBloqueo.once(
        "ready-to-show",
        () => {

            ventanaBloqueo.show();

            ventanaBloqueo.focus();

            ventanaBloqueo.webContents.send(
                "cloud-blocking:status-changed",
                estadoBloqueoCloud
            );

        }
    );

    ventanaBloqueo.on(
        "closed",
        () => {

            ventanaBloqueo =
                null;

        }
    );

    return ventanaBloqueo;

}


function cerrarVentanaBloqueo() {

    if(
        !ventanaBloqueo
        ||
        ventanaBloqueo.isDestroyed()
    ) {

        ventanaBloqueo =
            null;

        return;

    }

    ventanaBloqueo.close();

    ventanaBloqueo =
        null;

}


function cerrarVentanaPrincipal() {

    if(
        !ventanaPrincipal
        ||
        ventanaPrincipal.isDestroyed()
    ) {

        ventanaPrincipal =
            null;

        return;

    }

    ventanaPrincipal.close();

    ventanaPrincipal =
        null;

}


function bloquearOperacion(
    estado
) {

    sistemaOperativo =
        false;

    actualizarEstadoBloqueoCloud(
        estado
    );

    cerrarVentanaPrincipal();

    detenerServidor();

    crearVentanaBloqueo();

}


function mensajeDenegacionCloud(
    resultado
) {

    const mensaje =
        String(
            resultado.message
            || ""
        ).trim();

    if(mensaje) {
        return mensaje;
    }

    return (
        "LINK Cloud rechazó la licencia "
        + "o la instalación de este equipo."
    );

}


async function autorizarOperacionCloud() {

    if(validacionCloudEnProceso) {

        return {
            authorized:
                false,

            pending:
                true,

            message:
                "Ya existe una validación en curso."
        };

    }

    validacionCloudEnProceso =
        true;

    try {

        const resultado =
            await cloudService
                .sincronizarConCloud();

        const ahora =
            Date.now();

        if(
            resultado.reachable
            &&
            resultado.authorized === true
        ) {

            ultimaAutorizacionCloud =
                ahora;

            actualizarEstadoBloqueoCloud({

                code:
                    "AUTHORIZED",

                title:
                    "Operación autorizada",

                message:
                    "LINK Cloud autorizó esta instalación."

            });

            return {

                authorized:
                    true,

                result:
                    resultado

            };

        }

        if(
            resultado.reachable
            &&
            resultado.authorized === false
        ) {

            actualizarEstadoBloqueoCloud({

                code:
                    "CLOUD_DENIED",

                title:
                    "Licencia o instalación bloqueada",

                message:
                    mensajeDenegacionCloud(
                        resultado
                    )

            });

            return {

                authorized:
                    false,

                denied:
                    true,

                result:
                    resultado

            };

        }

        const tiempoDesdeAutorizacion =
            ultimaAutorizacionCloud
                ? ahora - ultimaAutorizacionCloud
                : Number.POSITIVE_INFINITY;

        const dentroDeTolerancia =
            tiempoDesdeAutorizacion
            <= TOLERANCIA_SIN_CONEXION_MS;

        actualizarEstadoBloqueoCloud({

            code:
                dentroDeTolerancia
                    ? "CLOUD_TEMPORARILY_UNAVAILABLE"
                    : "CLOUD_CONNECTION_REQUIRED",

            title:
                dentroDeTolerancia
                    ? "Conexión temporalmente interrumpida"
                    : "Conexión obligatoria",

            message:
                dentroDeTolerancia
                    ? (
                        "LINK Cloud no respondió. "
                        + "El Kiosco permanecerá activo durante "
                        + "el periodo corto de tolerancia."
                    )
                    : (
                        "No fue posible contactar LINK Cloud. "
                        + "El Kiosco requiere conexión a internet "
                        + "para operar."
                    )

        });

        return {

            authorized:
                dentroDeTolerancia,

            grace:
                dentroDeTolerancia,

            result:
                resultado

        };

    } finally {

        validacionCloudEnProceso =
            false;

    }

}


async function iniciarOperacionAutorizada() {

    if(sistemaOperativo) {

        cerrarVentanaBloqueo();

        if(
            ventanaPrincipal
            &&
            !ventanaPrincipal.isDestroyed()
        ) {

            ventanaPrincipal.show();

            ventanaPrincipal.focus();

        }

        return;

    }

    const estadoPuerto =
        await comprobarPuertoServidor();

    if(estadoPuerto.ocupado) {

        if(estadoPuerto.esLINK) {

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

    sistemaOperativo =
        true;

    cerrarVentanaBloqueo();

}


async function comprobarAutorizacionPeriodica() {

    try {

        const validacion =
            await autorizarOperacionCloud();

        if(validacion.authorized) {

            if(!sistemaOperativo) {

                await iniciarOperacionAutorizada();

            }

            return;

        }

        bloquearOperacion(
            estadoBloqueoCloud
        );

    } catch(error) {

        console.error(
            "Error durante validación periódica de LINK Cloud:",
            error
        );

        bloquearOperacion({

            code:
                "CLOUD_VALIDATION_ERROR",

            title:
                "No fue posible validar la instalación",

            message:
                error.message
                || "Ocurrió un error al validar LINK Cloud."

        });

    }

}


function iniciarMonitorCloud() {

    if(temporizadorValidacionCloud) {

        clearInterval(
            temporizadorValidacionCloud
        );

    }

    temporizadorValidacionCloud =
        setInterval(
            () => {

                comprobarAutorizacionPeriodica();

            },
            INTERVALO_VALIDACION_CLOUD_MS
        );

    temporizadorValidacionCloud.unref();

}


function detenerMonitorCloud() {

    if(!temporizadorValidacionCloud) {
        return;
    }

    clearInterval(
        temporizadorValidacionCloud
    );

    temporizadorValidacionCloud =
        null;

}

/*
=========================================================
VENTANA DE ACTIVACIÓN
=========================================================
*/

function crearVentanaActivacion(){

    ventanaActivacion =
        new BrowserWindow({

            width:
                820,

            height:
                760,

            minWidth:
                700,

            minHeight:
                650,

            show:
                false,

            autoHideMenuBar:
                true,

            resizable:
                true,

            backgroundColor:
                "#f4f1f2",

            title:
                "Activación — LINK Kiosco de Turnos",

            icon:
                path.join(
                    obtenerRutaProyecto(),
                    "build",
                    "icon.ico"
                ),

            webPreferences:{

                preload:
                    path.join(
                        __dirname,
                        "activation",
                        "activation.preload.js"
                    ),

                nodeIntegration:
                    false,

                contextIsolation:
                    true,

                sandbox:
                    true

            }

        });

    ventanaActivacion.loadFile(

        path.join(
            __dirname,
            "activation",
            "index.html"
        )

    );

    ventanaActivacion.once(
        "ready-to-show",
        ()=>{

            ventanaActivacion.show();

            ventanaActivacion.focus();

        }
    );

    ventanaActivacion.on(
        "closed",
        ()=>{

            ventanaActivacion =
                null;

        }
    );

}

/*
=========================================================
IPC DE LICENCIA
=========================================================
*/

function registrarIpcLicencia(){

    ipcMain.handle(
        "license:get-activation-data",
        ()=>{

            const estado =
                licenseManager.getStatus();

            const device =
                deviceService.getDeviceIdentity();

            return {

                status:
                    estado.status,

                reason:
                    estado.reason,

                message:
                    obtenerMensajeLicencia(
                        estado
                    ),

                device:{

                    deviceId:
                        device.deviceId,

                    hardwareId:
                        device.hardwareId,

                    hardwareCode:
                        device.hardwareCode

                }

            };

        }
    );


    ipcMain.handle(
        "license:copy",
        (
            _event,
            texto
        )=>{

            const valor =
                String(
                    texto || ""
                )
                .trim();

            if(!valor){

                return {
                    success:
                        false
                };

            }

            clipboard.writeText(
                valor
            );

            return {
                success:
                    true
            };

        }
    );


    ipcMain.handle(
        "license:import",
        async ()=>{

            const resultadoDialogo =
                await dialog.showOpenDialog(
                    ventanaActivacion,
                    {

                        title:
                            "Seleccionar licencia LINK",

                        properties:[
                            "openFile"
                        ],

                        filters:[

                            {
                                name:
                                    "Licencia LINK",

                                extensions:[
                                    "lic"
                                ]
                            }

                        ]

                    }
                );

            if(
                resultadoDialogo.canceled
                ||
                resultadoDialogo.filePaths.length === 0
            ){

                return {
                    success:
                        false,

                    cancelled:
                        true
                };

            }

            const resultado =
                licenseService.instalarLicencia(
                    resultadoDialogo.filePaths[0]
                );

            if(!resultado.success){

                return {

                    success:
                        false,

                    cancelled:
                        false,

                    reason:
                        resultado.reason,

                    message:
                        `La licencia fue rechazada: ${
                            resultado.reason
                        }`

                };

            }

            setTimeout(
                ()=>{

                    app.relaunch();

                    app.exit(
                        0
                    );

                },
                900
            );

            return {

                success:
                    true,

                cancelled:
                    false,

                license:
                    resultado.license

            };

        }
    );

    ipcMain.handle(
        "cloud-blocking:get-status",
        () => {

            return estadoBloqueoCloud;

        }
    );


    ipcMain.handle(
        "cloud-blocking:retry",
        async () => {

            const validacion =
                await autorizarOperacionCloud();

            if(validacion.authorized) {

                await iniciarOperacionAutorizada();

                return {

                    authorized:
                        true,

                    status:
                        estadoBloqueoCloud,

                    message:
                        "LINK Cloud autorizó la operación."

                };

            }

            crearVentanaBloqueo();

            return {

                authorized:
                    false,

                status:
                    estadoBloqueoCloud,

                message:
                    estadoBloqueoCloud.message

            };

        }
    );


    ipcMain.handle(
        "cloud-blocking:close",
        () => {

            app.quit();

            return {
                success:
                    true
            };

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

                registrarIpcLicencia();

                const estadoLicencia =
                    licenseManager.getStatus();

                if(
                    !estadoLicencia.valid
                    ||
                    estadoLicencia.blocked
                ){

                    console.log("");
                    console.log("LINK License");
                    console.log("============");
                    console.log(
                        `Estado: ${estadoLicencia.status}`
                    );
                    console.log(
                        `Motivo: ${estadoLicencia.reason}`
                    );
                    console.log("");
                    console.log(
                        "Se abrirá la ventana de activación."
                    );
                    console.log("");

                    crearVentanaActivacion();

                    return;

                }

                                /*
                =========================================================
                LINK CLOUD
                =========================================================
                */

                const autorizacionCloud =
                    await autorizarOperacionCloud();

                if(!autorizacionCloud.authorized) {

                    bloquearOperacion(
                        estadoBloqueoCloud
                    );

                    iniciarMonitorCloud();

                    return;

                }

                await iniciarOperacionAutorizada();

                iniciarMonitorCloud();

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
    () => {

        cerrandoAplicacion =
            true;

        detenerMonitorCloud();

        detenerServidor();

    }
);


app.on(
    "window-all-closed",
    ()=>{

        app.quit();

    }
);