const asignador = require("../services/asignador");
const db = require("../database/db");
const express = require("express");
const turnoRoutes = require("../routes/turno.routes");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const gestorTurnos = require("../services/gestorTurnos");
const gestorMesa = require("../services/gestorMesa");
const gestorRespaldos = require("../services/gestorRespaldos");
const crypto = require("crypto");
const gestorUsuarios = require("../services/gestorUsuarios");
const bcrypt = require("bcrypt");
const gestorTramites = require("../services/gestorTramites");
const gestorMesasConfig = require("../services/gestorMesasConfig");
const gestorReglas = require("../services/gestorReglas");

const app = express();

const sesiones = new Map();

const DURACION_SESION =
    8 * 60 * 60 * 1000;

app.use(express.json());

function leerCookies(req){

    const encabezado =
        req.headers.cookie || "";

    const cookies = {};

    encabezado
        .split(";")
        .map(valor => valor.trim())
        .filter(Boolean)
        .forEach(par => {

            const posicion =
                par.indexOf("=");

            if(posicion === -1){
                return;
            }

            const nombre =
                par.slice(0, posicion);

            const valor =
                par.slice(posicion + 1);

            cookies[nombre] =
                decodeURIComponent(valor);

        });

    return cookies;

}


function obtenerSesion(req){

    const cookies =
        leerCookies(req);

    const token =
        cookies.sapam_session;

    if(!token){
        return null;
    }

    const sesion =
        sesiones.get(token);

    if(!sesion){
        return null;
    }

    const vencida =
        Date.now() - sesion.ultimaActividad
        > DURACION_SESION;

    if(vencida){

        sesiones.delete(token);

        return null;

    }

    sesion.ultimaActividad =
        Date.now();

    return sesion;

}

function cerrarSesionesUsuario(idUsuario){

    for(const [token, sesion] of sesiones){

        if(
            Number(sesion.id)
            === Number(idUsuario)
        ){

            sesiones.delete(token);

        }

    }

}

function requerirAdmin(req, res, next){

    const sesion =
        obtenerSesion(req);

    if(
        !sesion
        || sesion.rol !== "admin"
    ){

        return res.status(401).json({
            success:false,
            mensaje:"Sesión no válida"
        });

    }

    req.sesion = sesion;

    next();

}

function requerirRoles(...rolesPermitidos){

    return (req, res, next)=>{

        const sesion =
            obtenerSesion(req);

        if(
            !sesion
            || !rolesPermitidos.includes(
                sesion.rol
            )
        ){

            return res.status(401).json({
                success:false,
                mensaje:"No tienes permiso para realizar esta acción"
            });

        }

        req.sesion = sesion;

        next();

    };

}

app.use(
    "/api/turno",
    requerirRoles(
        "admin",
        "recepcion"
    )
);

app.use(turnoRoutes);

const server = http.createServer(app);

const io = new Server(server);

app.get("/login", (req,res)=>{

    res.sendFile(
        path.join(
            __dirname,
            "../public/login/index.html"
        )
    );

});

app.get("/mesa/:numero", async (req,res)=>{

    const numero =
        Number(req.params.numero);

    if(
        !Number.isInteger(numero)
        || numero <= 0
    ){

        return res.status(404).send(
            "Punto de atención inválido"
        );

    }

    try{

        const mesa =
            await gestorMesasConfig
                .buscarPorNumero(numero);

        if(
            !mesa
            || Number(mesa.activo) !== 1
        ){

            return res.status(404).send(
                "El punto de atención no existe o está inactivo"
            );

        }

        res.sendFile(
            path.join(
                __dirname,
                "../public/mesa/index.html"
            )
        );

    }catch(error){

        console.error(
            "Error al abrir punto de atención:",
            error
        );

        res.status(500).send(
            "No se pudo abrir el punto de atención"
        );

    }

});

app.get("/admin", (req,res)=>{

    const sesion =
        obtenerSesion(req);

    if(
        !sesion
        || ![
            "admin",
            "supervisor"
        ].includes(sesion.rol)
    ){

        return res.redirect("/login");

    }

    res.sendFile(
        path.join(
            __dirname,
            "../public/admin/index.html"
        )
    );

});

app.use(
    express.static(
        path.join(__dirname, "../public"),

    )
);

io.on("connection", (socket) => {

    console.log("Cliente conectado");

    socket.on("disconnect", () => {
        console.log("Cliente desconectado");
    });

});

app.get("/", (req, res) => {
    res.send("Servidor funcionando");
});

app.get(
    "/api/pantalla/ultimos",
    async (req, res)=>{

        try{

            const turnos =
                await gestorTurnos
                    .obtenerUltimosTurnosPantalla(
                        5
                    );

            res.json({
                success:true,
                turnos
            });

        }catch(error){

            console.error(
                "Error al cargar últimos turnos:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudieron cargar los últimos turnos"
            });

        }

    }
);

app.post("/api/llamar", async (req, res) => {

    const { mesa } = req.body;

    try {

        const mesaConfig =
            await gestorMesasConfig
                .buscarPorNumero(Number(mesa));

        if(!mesaConfig){

            return res.status(404).json({
                success:false,
                mensaje:
                    "El punto de atención no existe"
            });

        }

        if(Number(mesaConfig.activo) !== 1){

            return res.status(409).json({
                success:false,
                mensaje:
                    "El punto de atención está inactivo"
            });

        }

        if(Number(mesaConfig.permiteTurnos) !== 1){

            return res.status(409).json({
                success:false,
                mensaje:
                    "El punto de atención no puede recibir turnos"
            });

        }

        const estadoMesa =
            await gestorMesa.obtenerEstado(mesa);

        if(estadoMesa.estado !== "disponible"){

            return res.status(409).json({
                success:false,
                mensaje:
                    `La mesa está en estado: ${estadoMesa.estado}`
            });

        }

        const turno = await asignador.buscarTurno(mesa);

        if (!turno) {

            return res.json({
                success: false,
                mensaje: "Sin turnos"
            });

        }

        await gestorTurnos.marcarAtendiendo(
            turno.id,
            mesa
        );

        /*
        Obtenemos desde SQLite el nombre visible
        del trámite. Esto permite anunciar también
        los trámites creados desde Administración.
        */
        const tramiteConfig =
            await gestorTramites
                .buscarPorCodigo(
                    turno.tramite
                );

        const nombreTramite =
            tramiteConfig?.nombre
            || turno.tramite
            || "";

        const nombreMesa =
            String(
                mesaConfig.nombre
                || `Mesa ${mesa}`
            ).trim();

        io.emit("nuevoTurno", {
            codigo:turno.codigo,
            mesa:Number(mesa),
            nombreMesa,
            tramite:turno.tramite,
            nombreTramite
        });

        res.json({
            success:true,
            id:turno.id,
            codigo:turno.codigo,
            tramite:turno.tramite,
            nombreTramite,
            mesa:Number(mesa),
            nombreMesa
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            mensaje: "Error interno"
        });

    }

});

app.post("/api/finalizar", async (req, res) => {

    const id = Number(req.body.id);

    if(!Number.isInteger(id) || id <= 0){

        return res.status(400).json({
            success:false,
            mensaje:"Turno inválido"
        });

    }

    try{

        const cambios =
            await gestorTurnos.finalizarTurno(id);

        if(cambios === 0){

            return res.status(404).json({
                success:false,
                mensaje:"El turno no existe o ya fue finalizado"
            });

        }

        io.emit("turnoFinalizado", {
            id
        });

        res.json({
            success:true,
            mensaje:"Atención finalizada"
        });

    }catch(error){

        console.error(
            "Error al finalizar turno:",
            error
        );

        res.status(500).json({
            success:false,
            mensaje:"No se pudo finalizar el turno"
        });

    }

});

app.get("/api/estadisticas", async (req,res)=>{

    try{

        const datos =
            await gestorTurnos.obtenerEstadisticasDia();

        res.json({
            success:true,
            datos
        });

    }catch(error){

        console.error(error);

        res.status(500).json({
            success:false,
            mensaje:"Error al obtener estadísticas"
        });

    }

});

app.get("/api/admin/resumen", requerirRoles("admin", "supervisor"), async (req,res)=>{

    try{

        const [
            resumen,
            colas,
            mesas
        ] = await Promise.all([

            gestorTurnos.obtenerResumenDia(),

            gestorTurnos.obtenerColasDia(),

            gestorTurnos.obtenerMesasActuales()

        ]);

        res.json({

            success:true,

            resumen,

            colas,

            mesas

        });

    }catch(error){

        console.error(
            "Error al cargar panel administrador:",
            error
        );

        res.status(500).json({

            success:false,

            mensaje:
                "No se pudo obtener la información del panel"

        });

    }

});

app.get(
    "/api/recepcion/resumen",
    requerirRoles(
        "admin",
        "recepcion"
    ),
    async (req, res)=>{

        try{

            const resumen =
                await gestorTurnos
                    .obtenerResumenDia();

            res.json({
                success:true,
                resumen
            });

        }catch(error){

            console.error(
                "Error al cargar resumen de recepción:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudo obtener el resumen"
            });

        }

    }
);

app.get("/api/mesa/:numero/actual", async (req, res) => {

    const numero =
        Number(req.params.numero);

    if(
        !Number.isInteger(numero)
        || numero <= 0
    ){

        return res.status(400).json({
            success:false,
            mensaje:
                "Punto de atención inválido"
        });

    }

    try{

        const mesaConfig =
            await gestorMesasConfig
                .buscarPorNumero(numero);

        if(!mesaConfig){

            return res.status(404).json({
                success:false,
                mensaje:
                    "El punto de atención no existe"
            });

        }

        const turno =
            await gestorTurnos
                .obtenerTurnoActualMesa(numero);

        res.json({
            success:true,
            turno
        });

    }catch(error){

        console.error(
            "Error al consultar turno actual:",
            error
        );

        res.status(500).json({
            success:false,
            mensaje:
                "No se pudo consultar el punto de atención"
        });

    }

});

app.post(
    "/api/admin/mesa/:numero/estado",
    requerirAdmin,
    async (req, res)=>{

        const numero =
            Number(req.params.numero);

        const estado =
            String(req.body.estado || "");

        const motivo =
            req.body.motivo
                ? String(req.body.motivo)
                : null;

        const estadosPermitidos = [
            "disponible",
            "pausa",
            "ausente",
            "vacaciones",
            "deshabilitada"
        ];

        if(!Number.isInteger(numero) || numero <= 0){

            return res.status(400).json({
                success:false,
                mensaje:"Mesa inválida"
            });

        }

        if(!estadosPermitidos.includes(estado)){

            return res.status(400).json({
                success:false,
                mensaje:"Estado inválido"
            });

        }

        try{

            /*
            Evitamos poner una mesa en pausa, ausencia,
            vacaciones o deshabilitada mientras atiende.
            */
            const turnoActual =
                await gestorTurnos
                    .obtenerTurnoActualMesa(numero);

            if(
                turnoActual
                && estado !== "disponible"
            ){

                return res.status(409).json({
                    success:false,
                    mensaje:
                        `La Mesa ${numero} está atendiendo `
                        + `${turnoActual.codigo}. `
                        + "Primero finaliza o libera la atención."
                });

            }

            await gestorMesa.cambiarEstado(
                numero,
                estado,
                estado === "disponible"
                    ? null
                    : motivo
            );

            io.emit("estadoMesaActualizado", {
                numero,
                estado,
                motivo:
                    estado === "disponible"
                        ? null
                        : motivo
            });

            res.json({
                success:true,
                numero,
                estado,
                motivo:
                    estado === "disponible"
                        ? null
                        : motivo,
                mensaje:
                    `Estado de la Mesa ${numero} actualizado`
            });

        }catch(error){

            console.error(
                "Error al cambiar estado desde Admin:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudo cambiar el estado de la mesa"
            });

        }

    }
);

app.get("/api/admin/exportar-csv", requerirRoles("admin", "supervisor"), async (req, res)=>{

    try{

        const turnos =
            await gestorTurnos.obtenerTurnosDia();

        const escapar = (valor)=>{

            if(valor === null || valor === undefined){
                return "";
            }

            const texto =
                String(valor).replace(/"/g, '""');

            return `"${texto}"`;

        };

        const encabezados = [

            "Código",
            "Trámite",
            "Estado",
            "Mesa",
            "Fecha de creación",
            "Fecha de llamado",
            "Fecha de finalización",
            "Espera en minutos",
            "Atención en minutos"

        ];

        const filas =
            turnos.map(turno => [

                turno.codigo,
                turno.tramite,
                turno.estado,
                turno.mesa,
                turno.fechaCreacion,
                turno.fechaLlamado,
                turno.fechaFinalizado,
                turno.tiempoEsperaMinutos,
                turno.tiempoAtencionMinutos

            ].map(escapar).join(","));

        const csv = [
            encabezados.map(escapar).join(","),
            ...filas
        ].join("\r\n");

        const fecha =
            new Date()
                .toISOString()
                .slice(0, 10);

        res.setHeader(
            "Content-Type",
            "text/csv; charset=utf-8"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="reporte-turnos-${fecha}.csv"`
        );

        // BOM para que Excel reconozca correctamente acentos y ñ
        res.send("\uFEFF" + csv);

    }catch(error){

        console.error(
            "Error al exportar reporte:",
            error
        );

        res.status(500).json({
            success:false,
            mensaje:"No se pudo exportar el reporte"
        });

    }

});

app.post("/api/admin/liberar-mesas", requerirAdmin, async (req, res)=>{

    try{

        const liberados =
            await gestorTurnos.liberarMesas();

        io.emit("mesasLiberadas");

        res.json({
            success:true,
            liberados
        });

    }catch(error){

        console.error(
            "Error al liberar mesas:",
            error
        );

        res.status(500).json({
            success:false,
            mensaje:"No se pudieron liberar las mesas"
        });

    }

});

app.post(
    "/api/admin/cerrar-jornada", 
    requerirAdmin,
    async (req, res)=>{

        try{

            /*
            Respaldo de seguridad antes de modificar
            los estados de la jornada.
            */
            const respaldo =
                await gestorRespaldos
                    .crearCopiaBaseDatos();

            const resultado =
                await gestorTurnos
                    .cerrarJornada();

            /*
            Consultamos nuevamente para que el CSV
            contenga los estados finales.
            */
            const turnos =
                await gestorTurnos
                    .obtenerTurnosDia();

            const reporte =
                await gestorRespaldos
                    .guardarReporteCSV(turnos);

            io.emit("mesasLiberadas");

            io.emit("jornadaCerrada", {
                finalizados:
                    resultado.finalizados,
                cancelados:
                    resultado.cancelados
            });

            res.json({
                success:true,
                finalizados:
                    resultado.finalizados,
                cancelados:
                    resultado.cancelados,
                respaldo:
                    respaldo.nombreArchivo,
                reporte:
                    reporte.nombreArchivo
            });

        }catch(error){

            console.error(
                "Error al cerrar jornada:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudo cerrar la jornada"
            });

        }

    }
);

app.get("/api/mesas/estados", async (req, res)=>{

    try{

        const mesas =
            await gestorMesa.obtenerEstados();

        res.json({
            success:true,
            mesas
        });

    }catch(error){

        console.error(
            "Error al consultar estados de mesas:",
            error
        );

        res.status(500).json({
            success:false,
            mensaje:"No se pudieron consultar las mesas"
        });

    }

});

app.post("/api/mesa/:numero/estado", async (req, res)=>{

    const numero =
        Number(req.params.numero);

    const {
        estado,
        motivo
    } = req.body;

    const estadosPermitidos = [
        "disponible",
        "pausa",
        "ausente",
        "vacaciones",
        "deshabilitada"
    ];

    if(!Number.isInteger(numero) || numero <= 0){

        return res.status(400).json({
            success:false,
            mensaje:"Mesa inválida"
        });

    }

    if(!estadosPermitidos.includes(estado)){

        return res.status(400).json({
            success:false,
            mensaje:"Estado inválido"
        });

    }

    try{

        const mesaConfig =
            await gestorMesasConfig
                .buscarPorNumero(numero);

        if(!mesaConfig){

            return res.status(404).json({
                success:false,
                mensaje:
                    "El punto de atención no existe"
            });

        }

        await gestorMesa.cambiarEstado(
            numero,
            estado,
            motivo || null
        );

        io.emit("estadoMesaActualizado", {
            numero,
            estado,
            motivo:motivo || null
        });

        res.json({
            success:true,
            numero,
            estado
        });

    }catch(error){

        console.error(
            "Error al cambiar estado de mesa:",
            error
        );

        res.status(500).json({
            success:false,
            mensaje:"No se pudo cambiar el estado"
        });

    }

});

app.get(
    "/api/mesa/:numero/estado",
    async (req, res)=>{

        const numero =
            Number(req.params.numero);

        try{

            const mesa =
                await gestorMesa.obtenerEstado(numero);

            res.json({
                success:true,
                mesa
            });

        }catch(error){

            console.error(error);

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudo consultar el estado de la mesa"
            });

        }

    }
);

app.post(
    "/api/admin/reiniciar-folios",
    requerirAdmin,
    async (req, res)=>{

        try{

            const reiniciados =
                await gestorTurnos.reiniciarFolios();

            io.emit("foliosReiniciados");

            res.json({
                success:true,
                reiniciados
            });

        }catch(error){

            console.error(
                "Error al reiniciar folios:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:"No se pudieron reiniciar los folios"
            });

        }

    }
);

app.get("/api/admin/respaldos", requerirRoles("admin", "supervisor"), async (req, res)=>{

    try{

        const datos =
            await gestorRespaldos.listarRespaldos();

        res.json({
            success:true,
            ...datos
        });

    }catch(error){

        console.error(
            "Error al consultar respaldos:",
            error
        );

        res.status(500).json({
            success:false,
            mensaje:
                "No se pudieron consultar los respaldos"
        });

    }

});

app.post(
    "/api/admin/crear-respaldo",
    requerirAdmin,
    async (req, res)=>{

        try{

            const turnos =
                await gestorTurnos.obtenerTurnosDia();

            const baseDatos =
                await gestorRespaldos
                    .crearCopiaBaseDatos();

            const reporte =
                await gestorRespaldos
                    .guardarReporteCSV(turnos);

            res.json({
                success:true,
                baseDatos:
                    baseDatos.nombreArchivo,
                reporte:
                    reporte.nombreArchivo
            });

        }catch(error){

            console.error(
                "Error al crear respaldo:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudo crear el respaldo"
            });

        }

    }
);

app.post(
    "/api/admin/eliminar-respaldos-antiguos",
    requerirAdmin,
    async (req, res)=>{

        const dias =
            Number(req.body.dias);

        if(
            !Number.isInteger(dias)
            || dias < 1
        ){

            return res.status(400).json({
                success:false,
                mensaje:
                    "Debes indicar una cantidad válida de días"
            });

        }

        try{

            const resultado =
                await gestorRespaldos
                    .eliminarRespaldosAntiguos(dias);

            res.json({
                success:true,
                ...resultado
            });

        }catch(error){

            console.error(
                "Error al eliminar respaldos antiguos:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudieron eliminar los respaldos"
            });

        }

    }
);

app.post("/api/login", async (req, res)=>{

    const usuario =
        String(req.body.usuario || "")
            .trim();

    const contraseña =
        String(req.body.contraseña || "");

    if(!usuario || !contraseña){

        return res.status(400).json({
            success:false,
            mensaje:"Completa usuario y contraseña"
        });

    }

    try{

        const encontrado =
            await gestorUsuarios
                .buscarPorUsuario(usuario);

        const contraseñaCorrecta =
            encontrado
                ? await bcrypt.compare(
                    contraseña,
                    encontrado.contraseña
                )
                : false;

        if(
            !encontrado
            || !encontrado.activo
            || !contraseñaCorrecta
        ){

            return res.status(401).json({
                success:false,
                mensaje:"Usuario o contraseña incorrectos"
            });

        }

        const token =
            crypto.randomBytes(32)
                .toString("hex");

        sesiones.set(token, {
            id:encontrado.id,
            usuario:encontrado.usuario,
            rol:encontrado.rol,
            creadoEn:Date.now(),
            ultimaActividad:Date.now()
        });

        res.setHeader(
            "Set-Cookie",
            `sapam_session=${token}; HttpOnly; Path=/; SameSite=Lax`
        );

        res.json({
            success:true,
            usuario:encontrado.usuario,
            rol:encontrado.rol
        });

    }catch(error){

        console.error(
            "Error al iniciar sesión:",
            error
        );

        res.status(500).json({
            success:false,
            mensaje:"No se pudo iniciar sesión"
        });

    }

});


app.get("/api/sesion", (req, res)=>{

    const sesion =
        obtenerSesion(req);

    if(!sesion){

        return res.status(401).json({
            success:false
        });

    }

    res.json({
        success:true,
        usuario:sesion.usuario,
        rol:sesion.rol
    });

});


app.post("/api/logout", (req, res)=>{

    const cookies =
        leerCookies(req);

    const token =
        cookies.sapam_session;

    if(token){
        sesiones.delete(token);
    }

    res.setHeader(
        "Set-Cookie",
        "sapam_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax"
    );

    res.json({
        success:true
    });

});

app.post(
    "/api/admin/cambiar-contrasena",
    requerirAdmin,
    async (req, res)=>{

        const actual =
            String(req.body.actual || "");

        const nueva =
            String(req.body.nueva || "");

        if(nueva.length < 8){

            return res.status(400).json({
                success:false,
                mensaje:
                    "La nueva contraseña debe tener al menos 8 caracteres"
            });

        }

        try{

            const usuario =
                await gestorUsuarios.buscarPorUsuario(
                    req.sesion.usuario
                );

            const actualCorrecta =
                await bcrypt.compare(
                    actual,
                    usuario.contraseña
                );

            if(!actualCorrecta){

                return res.status(401).json({
                    success:false,
                    mensaje:
                        "La contraseña actual es incorrecta"
                });

            }

            const hash =
                await bcrypt.hash(
                    nueva,
                    12
                );

            await gestorUsuarios.cambiarContraseña(
                usuario.id,
                hash
            );

            res.json({
                success:true,
                mensaje:
                    "Contraseña actualizada correctamente"
            });

        }catch(error){

            console.error(
                "Error al cambiar contraseña:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudo cambiar la contraseña"
            });

        }

    }
);

app.get(
    [
        "/recepcion",
        "/recepcion/",
        "/recepcion/index.html"
    ],
    (req,res)=>{

        const sesion =
            obtenerSesion(req);

        if(
            !sesion
            || ![
                "admin",
                "recepcion"
            ].includes(sesion.rol)
        ){

            return res.redirect(
                "/login?destino=recepcion"
            );

        }

        res.sendFile(
            path.join(
                __dirname,
                "../public/recepcion/index.html"
            )
        );

    }
);

app.get(
    "/api/admin/usuarios",
    requerirAdmin,
    async (req, res)=>{

        try{

            const usuarios =
                await gestorUsuarios
                    .listarUsuarios();

            res.json({
                success:true,
                usuarios
            });

        }catch(error){

            console.error(
                "Error al consultar usuarios:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudieron consultar los usuarios"
            });

        }

    }
);

app.post(
    "/api/admin/usuarios",
    requerirAdmin,
    async (req, res)=>{

        const usuario =
            String(req.body.usuario || "")
                .trim()
                .toLowerCase();

        const contraseña =
            String(req.body.contraseña || "");

        const rol =
            String(req.body.rol || "");

        const rolesPermitidos = [
            "admin",
            "recepcion",
            "supervisor"
        ];

        if(
            !usuario
            || !/^[a-z0-9._-]{3,30}$/.test(usuario)
        ){

            return res.status(400).json({
                success:false,
                mensaje:
                    "El usuario debe tener entre 3 y 30 caracteres y usar solo letras, números, punto, guion o guion bajo"
            });

        }

        if(contraseña.length < 8){

            return res.status(400).json({
                success:false,
                mensaje:
                    "La contraseña debe tener al menos 8 caracteres"
            });

        }

        if(!rolesPermitidos.includes(rol)){

            return res.status(400).json({
                success:false,
                mensaje:"Rol inválido"
            });

        }

        try{

            const hash =
                await bcrypt.hash(
                    contraseña,
                    12
                );

            const resultado =
                await gestorUsuarios.crearUsuario(
                    usuario,
                    hash,
                    rol
                );

            res.status(201).json({
                success:true,
                id:resultado.id,
                mensaje:"Usuario creado correctamente"
            });

        }catch(error){

            if(
                error.code
                === "SQLITE_CONSTRAINT"
            ){

                return res.status(409).json({
                    success:false,
                    mensaje:
                        "Ya existe un usuario con ese nombre"
                });

            }

            console.error(
                "Error al crear usuario:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudo crear el usuario"
            });

        }

    }
);

app.patch(
    "/api/admin/usuarios/:id/estado",
    requerirAdmin,
    async (req, res)=>{

        const id =
            Number(req.params.id);

        const activo =
            req.body.activo === true;

        if(
            !Number.isInteger(id)
            || id <= 0
        ){

            return res.status(400).json({
                success:false,
                mensaje:"Usuario inválido"
            });

        }

        if(id === Number(req.sesion.id)){

            return res.status(400).json({
                success:false,
                mensaje:
                    "No puedes desactivar tu propia cuenta"
            });

        }

        try{

            const cambios =
                await gestorUsuarios
                    .cambiarEstadoUsuario(
                        id,
                        activo
                    );

            if(cambios === 0){

                return res.status(404).json({
                    success:false,
                    mensaje:
                        "El usuario no existe"
                });

            }

            /*
            Si el usuario fue desactivado,
            cerramos inmediatamente sus sesiones.
            */
            if(!activo){

                cerrarSesionesUsuario(id);

            }

            res.json({
                success:true,
                mensaje:
                    activo
                        ? "Usuario activado"
                        : "Usuario desactivado"
            });

        }catch(error){

            console.error(
                "Error al cambiar estado del usuario:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudo cambiar el estado"
            });

        }

    }
);

app.post(
    "/api/admin/usuarios/:id/restablecer-contrasena",
    requerirAdmin,
    async (req, res)=>{

        const id =
            Number(req.params.id);

        const nuevaContraseña =
            String(
                req.body.nuevaContraseña || ""
            );

        if(
            !Number.isInteger(id)
            || id <= 0
        ){

            return res.status(400).json({
                success:false,
                mensaje:"Usuario inválido"
            });

        }

        if(nuevaContraseña.length < 8){

            return res.status(400).json({
                success:false,
                mensaje:
                    "La contraseña debe tener al menos 8 caracteres"
            });

        }

        try{

            const hash =
                await bcrypt.hash(
                    nuevaContraseña,
                    12
                );

            const cambios =
                await gestorUsuarios
                    .restablecerContraseña(
                        id,
                        hash
                    );

            if(cambios === 0){

                return res.status(404).json({
                    success:false,
                    mensaje:
                        "El usuario no existe"
                });

            }

            /*
            Obligamos al usuario a volver a iniciar sesión
            con su nueva contraseña.
            */
            cerrarSesionesUsuario(id);

            res.json({
                success:true,
                mensaje:
                    "Contraseña restablecida correctamente"
            });

        }catch(error){

            console.error(
                "Error al restablecer contraseña:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudo restablecer la contraseña"
            });

        }

    }
);

app.post(
    "/api/admin/usuarios/:id/cerrar-sesiones",
    requerirAdmin,
    async (req, res)=>{

        const id =
            Number(req.params.id);

        if(
            !Number.isInteger(id)
            || id <= 0
        ){

            return res.status(400).json({
                success:false,
                mensaje:"Usuario inválido"
            });

        }

        try{

            const usuario =
                await gestorUsuarios
                    .buscarPorId(id);

            if(!usuario){

                return res.status(404).json({
                    success:false,
                    mensaje:"El usuario no existe"
                });

            }

            cerrarSesionesUsuario(id);

            res.json({
                success:true,
                mensaje:
                    `Sesiones de ${usuario.usuario} cerradas correctamente`
            });

        }catch(error){

            console.error(
                "Error al cerrar sesiones:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudieron cerrar las sesiones"
            });

        }

    }
);

app.delete(
    "/api/admin/usuarios/:id",
    requerirAdmin,
    async (req, res)=>{

        const id =
            Number(req.params.id);

        if(
            !Number.isInteger(id)
            || id <= 0
        ){

            return res.status(400).json({
                success:false,
                mensaje:"Usuario inválido"
            });

        }

        if(id === Number(req.sesion.id)){

            return res.status(400).json({
                success:false,
                mensaje:
                    "No puedes eliminar tu propia cuenta"
            });

        }

        try{

            const usuario =
                await gestorUsuarios
                    .buscarPorId(id);

            if(!usuario){

                return res.status(404).json({
                    success:false,
                    mensaje:"El usuario no existe"
                });

            }

            if(
                usuario.rol === "admin"
                && Number(usuario.activo) === 1
            ){

                const administradores =
                    await gestorUsuarios
                        .contarAdministradoresActivos();

                if(administradores <= 1){

                    return res.status(400).json({
                        success:false,
                        mensaje:
                            "No puedes eliminar el último administrador activo"
                    });

                }

            }

            const eliminados =
                await gestorUsuarios
                    .eliminarUsuario(id);

            if(eliminados === 0){

                return res.status(404).json({
                    success:false,
                    mensaje:"El usuario no existe"
                });

            }

            cerrarSesionesUsuario(id);

            res.json({
                success:true,
                mensaje:
                    `Usuario ${usuario.usuario} eliminado correctamente`
            });

        }catch(error){

            console.error(
                "Error al eliminar usuario:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudo eliminar el usuario"
            });

        }

    }
);

app.get(
    "/api/admin/tramites",
    requerirAdmin,
    async (req, res)=>{

        try{

            const tramites =
                await gestorTramites.listarTodos();

            res.json({
                success:true,
                tramites
            });

        }catch(error){

            console.error(
                "Error al consultar trámites:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudieron consultar los trámites"
            });

        }

    }
);

app.get(
    "/api/recepcion/tramites",
    requerirRoles(
        "admin",
        "recepcion"
    ),
    async (req, res)=>{

        try{

            const tramites =
                await gestorTramites
                    .listarRecepcion();

            res.json({
                success:true,
                tramites
            });

        }catch(error){

            console.error(
                "Error al consultar trámites de recepción:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudieron cargar los trámites"
            });

        }

    }
);

app.post(
    "/api/admin/tramites",
    requerirAdmin,
    async (req, res)=>{

        const codigo =
            String(req.body.codigo || "")
                .trim()
                .toUpperCase();

        const nombre =
            String(req.body.nombre || "")
                .trim();

        const prefijo =
            String(req.body.prefijo || "")
                .trim()
                .toUpperCase();

        const descripcion =
            String(req.body.descripcion || "")
                .trim();

        const orden =
            Number(req.body.orden || 0);

        if(
            !/^[A-Z0-9_]{2,30}$/.test(codigo)
        ){

            return res.status(400).json({
                success:false,
                mensaje:
                    "El código debe tener entre 2 y 30 caracteres y usar solamente letras, números o guion bajo"
            });

        }

        if(nombre.length < 3){

            return res.status(400).json({
                success:false,
                mensaje:
                    "El nombre del trámite no es válido"
            });

        }

        if(
            !/^[A-Z0-9]{1,4}$/.test(prefijo)
        ){

            return res.status(400).json({
                success:false,
                mensaje:
                    "El prefijo debe tener de 1 a 4 letras o números"
            });

        }

        try{

            const existente =
                await gestorTramites
                    .buscarPorCodigo(codigo);

            if(existente){

                return res.status(409).json({
                    success:false,
                    mensaje:
                        "Ya existe un trámite con ese código"
                });

            }

            const prefijoExistente =
                await gestorTramites
                    .buscarPorPrefijo(prefijo);

            if(prefijoExistente){

                return res.status(409).json({
                    success:false,
                    mensaje:
                        "Ese prefijo ya está siendo utilizado"
                });

            }

            await gestorTramites.crear({
                codigo,
                nombre,
                prefijo,
                descripcion,
                orden
            });

            /*
            Cada trámite necesita su contador.
            */
            await new Promise(
                (resolve, reject)=>{

                    db.run(
                        `
                        INSERT OR IGNORE INTO folios
                        (
                            tramite,
                            ultimoNumero
                        )
                        VALUES (?, 0)
                        `,
                        [codigo],
                        error => {

                            if(error){
                                reject(error);
                                return;
                            }

                            resolve();

                        }
                    );

                }
            );

            res.status(201).json({
                success:true,
                mensaje:
                    "Trámite creado correctamente"
            });

        }catch(error){

            console.error(
                "Error al crear trámite:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudo crear el trámite"
            });

        }

    }
);

app.put(
    "/api/admin/tramites/:codigo",
    requerirAdmin,
    async (req, res)=>{

        const codigo =
            String(req.params.codigo || "")
                .trim()
                .toUpperCase();

        const nombre =
            String(req.body.nombre || "")
                .trim();

        const prefijo =
            String(req.body.prefijo || "")
                .trim()
                .toUpperCase();

        const descripcion =
            String(req.body.descripcion || "")
                .trim();

        const activo =
            req.body.activo === true;

        const mostrarRecepcion =
            req.body.mostrarRecepcion === true;

        const orden =
            Number(req.body.orden || 0);

        if(nombre.length < 3){

            return res.status(400).json({
                success:false,
                mensaje:"Nombre inválido"
            });

        }

        if(
            !/^[A-Z0-9]{1,4}$/.test(prefijo)
        ){

            return res.status(400).json({
                success:false,
                mensaje:"Prefijo inválido"
            });

        }

        try{

            const tramite =
                await gestorTramites
                    .buscarPorCodigo(codigo);

            if(!tramite){

                return res.status(404).json({
                    success:false,
                    mensaje:
                        "El trámite no existe"
                });

            }

            const prefijoExistente =
                await gestorTramites
                    .buscarPorPrefijo(prefijo);

            if(
                prefijoExistente
                && prefijoExistente.codigo
                    !== codigo
            ){

                return res.status(409).json({
                    success:false,
                    mensaje:
                        "Ese prefijo pertenece a otro trámite"
                });

            }

            const cambios =
                await gestorTramites.actualizar(
                    codigo,
                    {
                        nombre,
                        prefijo,
                        descripcion,
                        activo,
                        mostrarRecepcion,
                        orden
                    }
                );

            if(cambios === 0){

                return res.status(404).json({
                    success:false,
                    mensaje:
                        "El trámite no existe"
                });

            }

            res.json({
                success:true,
                mensaje:
                    "Trámite actualizado correctamente"
            });

        }catch(error){

            console.error(
                "Error al actualizar trámite:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudo actualizar el trámite"
            });

        }

    }
);

app.get(
    "/api/admin/mesas-config",
    requerirAdmin,
    async (req, res)=>{

        try{

            const mesas =
                await gestorMesasConfig
                    .listarTodas();

            res.json({
                success:true,
                mesas
            });

        }catch(error){

            console.error(
                "Error al consultar mesas:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudieron consultar las mesas"
            });

        }

    }
);

app.post(
    "/api/admin/mesas-config",
    requerirAdmin,
    async (req, res)=>{

        const nombreRecibido =
            String(req.body.nombre || "")
                .trim();

        try{

            const numero =
                await gestorMesasConfig
                    .obtenerSiguienteNumero();

            const nombre =
                nombreRecibido
                || `Mesa ${numero}`;

            await gestorMesasConfig.crear({
                numero,
                nombre,
                orden:numero
            });

            io.emit("configuracionMesasActualizada");

            res.status(201).json({
                success:true,
                numero,
                nombre,
                mensaje:
                    `${nombre} creada correctamente`
            });

        }catch(error){

            console.error(
                "Error al crear mesa:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudo crear la mesa"
            });

        }

    }
);

app.put(
    "/api/admin/mesas-config/:numero",
    requerirAdmin,
    async (req, res)=>{

        const numero =
            Number(req.params.numero);

        const nombre =
            String(req.body.nombre || "")
                .trim();

        const activo =
            req.body.activo === true;

        const permiteTurnos =
            req.body.permiteTurnos === true;

        const orden =
            Number(req.body.orden || numero);

        if(
            !Number.isInteger(numero)
            || numero <= 0
        ){

            return res.status(400).json({
                success:false,
                mensaje:"Mesa inválida"
            });

        }

        if(nombre.length < 3){

            return res.status(400).json({
                success:false,
                mensaje:
                    "El nombre de la mesa no es válido"
            });

        }

        try{

            const mesa =
                await gestorMesasConfig
                    .buscarPorNumero(numero);

            if(!mesa){

                return res.status(404).json({
                    success:false,
                    mensaje:
                        "La mesa no existe"
                });

            }

            const cambios =
                await gestorMesasConfig.actualizar(
                    numero,
                    {
                        nombre,
                        activo,
                        permiteTurnos,
                        orden
                    }
                );

            if(cambios === 0){

                return res.status(404).json({
                    success:false,
                    mensaje:
                        "La mesa no existe"
                });

            }

            /*
            Una mesa inactiva queda también
            deshabilitada operativamente.
            */
            if(!activo || !permiteTurnos){

                await gestorMesa.cambiarEstado(
                    numero,
                    "deshabilitada",
                    "Mesa deshabilitada desde Administración"
                );

            }else{

                const estadoActual =
                    await gestorMesa
                        .obtenerEstado(numero);

                if(
                    estadoActual.estado
                    === "deshabilitada"
                ){

                    await gestorMesa.cambiarEstado(
                        numero,
                        "disponible",
                        null
                    );

                }

            }

            io.emit("configuracionMesasActualizada");

            io.emit("estadoMesaActualizado", {
                numero,
                estado:
                    !activo || !permiteTurnos
                        ? "deshabilitada"
                        : "disponible",
                motivo:
                    !activo || !permiteTurnos
                        ? "Mesa deshabilitada desde Administración"
                        : null
            });

            res.json({
                success:true,
                mensaje:
                    "Mesa actualizada correctamente"
            });

        }catch(error){

            console.error(
                "Error al actualizar mesa:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudo actualizar la mesa"
            });

        }

    }
);

app.get(
    "/api/mesa/:numero/config",
    async (req, res)=>{

        const numero =
            Number(req.params.numero);

        if(
            !Number.isInteger(numero)
            || numero <= 0
        ){

            return res.status(400).json({
                success:false,
                mensaje:"Punto de atención inválido"
            });

        }

        try{

            const mesa =
                await gestorMesasConfig
                    .buscarPorNumero(numero);

            if(!mesa){

                return res.status(404).json({
                    success:false,
                    mensaje:
                        "El punto de atención no existe"
                });

            }

            res.json({
                success:true,
                mesa
            });

        }catch(error){

            console.error(
                "Error al consultar configuración de mesa:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudo consultar el punto de atención"
            });

        }

    }
);

app.get(
    "/api/admin/reglas",
    requerirAdmin,
    async (req, res)=>{

        try{

            const reglas =
                await gestorReglas
                    .listarConfiguracionCompleta();

            const mesas =
                await gestorMesasConfig
                    .listarTodas();

            res.json({
                success:true,
                reglas,
                mesas
            });

        }catch(error){

            console.error(
                "Error al consultar reglas:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudieron consultar las reglas"
            });

        }

    }
);

app.put(
    "/api/admin/reglas/:tramite",
    requerirAdmin,
    async (req, res)=>{

        const tramite =
            String(
                req.params.tramite || ""
            )
                .trim()
                .toUpperCase();

        const limiteApoyo =
            Number(req.body.limiteApoyo);

        const prioridad =
            Array.isArray(req.body.prioridad)
                ? req.body.prioridad.map(Number)
                : [];

        const apoyo =
            Array.isArray(req.body.apoyo)
                ? req.body.apoyo.map(Number)
                : [];

        if(
            !Number.isInteger(limiteApoyo)
            || limiteApoyo < 1
            || limiteApoyo > 999
        ){

            return res.status(400).json({
                success:false,
                mensaje:
                    "El límite de apoyo debe estar entre 1 y 999"
            });

        }

        const prioridadValida =
            prioridad.every(
                numero =>
                    Number.isInteger(numero)
                    && numero > 0
            );

        const apoyoValido =
            apoyo.every(
                numero =>
                    Number.isInteger(numero)
                    && numero > 0
            );

        if(
            !prioridadValida
            || !apoyoValido
        ){

            return res.status(400).json({
                success:false,
                mensaje:
                    "La configuración contiene mesas inválidas"
            });

        }

        const duplicadas =
            prioridad.some(
                numero =>
                    apoyo.includes(numero)
            );

        if(duplicadas){

            return res.status(400).json({
                success:false,
                mensaje:
                    "Una mesa no puede ser prioridad y apoyo al mismo tiempo"
            });

        }

        try{

            const tramiteConfig =
                await gestorTramites
                    .buscarPorCodigo(tramite);

            if(!tramiteConfig){

                return res.status(404).json({
                    success:false,
                    mensaje:
                        "El trámite no existe"
                });

            }

            const mesasConfiguradas =
                await gestorMesasConfig
                    .listarTodas();

            const numerosExistentes =
                new Set(
                    mesasConfiguradas.map(
                        mesa =>
                            Number(mesa.numero)
                    )
                );

            const todasLasMesas = [
                ...prioridad,
                ...apoyo
            ];

            const existeMesaInvalida =
                todasLasMesas.some(
                    numero =>
                        !numerosExistentes.has(
                            numero
                        )
                );

            if(existeMesaInvalida){

                return res.status(400).json({
                    success:false,
                    mensaje:
                        "Una de las mesas seleccionadas no existe"
                });

            }

            if(prioridad.length === 0){

                return res.status(400).json({
                    success:false,
                    mensaje:
                        "Debes seleccionar al menos una mesa prioritaria"
                });

            }

            await gestorReglas
                .guardarConfiguracion(
                    tramite,
                    limiteApoyo,
                    prioridad,
                    apoyo
                );

            io.emit(
                "reglasActualizadas",
                {
                    tramite
                }
            );

            res.json({
                success:true,
                mensaje:
                    "Prioridades y apoyos guardados correctamente"
            });

        }catch(error){

            console.error(
                "Error al guardar reglas:",
                error
            );

            res.status(500).json({
                success:false,
                mensaje:
                    "No se pudieron guardar las reglas"
            });

        }

    }
);

server.listen(3000, () => {
    console.log("Servidor en puerto 3000");
});