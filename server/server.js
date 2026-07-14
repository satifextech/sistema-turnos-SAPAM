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

const app = express();

const sesiones = new Map();

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

    return sesiones.get(token) || null;

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

app.get("/mesa/:numero", (req,res)=>{

    res.sendFile(
        path.join(
            __dirname,
            "../public/mesa/index.html"
        )
    );

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
        {
            index:false
        }
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

app.post("/api/llamar", async (req, res) => {

    const { mesa } = req.body;

    try {

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

        io.emit("nuevoTurno", {
            codigo: turno.codigo,
            mesa
        });

        res.json({
            success:true,
            id: turno.id,
            codigo:turno.codigo,
            mesa
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

app.get("/api/mesa/:numero/actual", async (req, res) => {

    const mesa = Number(req.params.numero);

    if(!Number.isInteger(mesa) || mesa < 1 || mesa > 5){

        return res.status(400).json({
            success:false,
            mensaje:"Mesa inválida"
        });

    }

    try{

        const turno =
            await gestorTurnos.obtenerTurnoActualMesa(mesa);

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
            mensaje:"No se pudo consultar la mesa"
        });

    }

});

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

    if(
        !Number.isInteger(numero)
        || numero < 1
        || numero > 5
    ){

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
            creadoEn:Date.now()
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

app.get("/recepcion", (req,res)=>{

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

});

server.listen(3000, () => {
    console.log("Servidor en puerto 3000");
});