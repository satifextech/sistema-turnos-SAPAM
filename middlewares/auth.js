const crypto =
    require("crypto");


const sesiones =
    new Map();


const DURACION_SESION =
    8 * 60 * 60 * 1000;


function leerCookies(req){

    const encabezado =
        req.headers.cookie || "";

    const cookies = {};

    encabezado
        .split(";")
        .map(
            valor =>
                valor.trim()
        )
        .filter(Boolean)
        .forEach(par => {

            const posicion =
                par.indexOf("=");

            if(posicion === -1){
                return;
            }

            const nombre =
                par.slice(
                    0,
                    posicion
                );

            const valor =
                par.slice(
                    posicion + 1
                );

            try{

                cookies[nombre] =
                    decodeURIComponent(
                        valor
                    );

            }catch{

                cookies[nombre] =
                    valor;

            }

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
        Date.now()
        - sesion.ultimaActividad
        > DURACION_SESION;

    if(vencida){

        sesiones.delete(token);

        return null;

    }

    sesion.ultimaActividad =
        Date.now();

    return sesion;

}


function crearSesion(
    usuario
){

    const token =
        crypto
            .randomBytes(32)
            .toString("hex");

    sesiones.set(
        token,
        {
            id:
                usuario.id,

            usuario:
                usuario.usuario,

            rol:
                usuario.rol,

            creadoEn:
                Date.now(),

            ultimaActividad:
                Date.now()
        }
    );

    return token;

}


function cerrarSesionToken(
    token
){

    if(token){

        sesiones.delete(
            token
        );

    }

}


function cerrarSesionesUsuario(
    idUsuario
){

    for(
        const [token, sesion]
        of sesiones
    ){

        if(
            Number(sesion.id)
            === Number(idUsuario)
        ){

            sesiones.delete(
                token
            );

        }

    }

}


function limpiarSesionesVencidas(){

    const ahora =
        Date.now();

    let eliminadas =
        0;

    for(
        const [token, sesion]
        of sesiones
    ){

        if(
            ahora
            - sesion.ultimaActividad
            > DURACION_SESION
        ){

            sesiones.delete(
                token
            );

            eliminadas++;

        }

    }

    return eliminadas;

}


function requerirAdmin(
    req,
    res,
    next
){

    const sesion =
        obtenerSesion(req);

    if(!sesion){

        return res
            .status(401)
            .json({
                success:false,
                mensaje:
                    "Sesión no válida o vencida"
            });

    }

    if(sesion.rol !== "admin"){

        return res
            .status(403)
            .json({
                success:false,
                mensaje:
                    "No tienes permiso para realizar esta acción"
            });

    }

    req.sesion =
        sesion;

    next();

}


function requerirRoles(
    ...rolesPermitidos
){

    return (
        req,
        res,
        next
    )=>{

        const sesion =
            obtenerSesion(req);

        if(!sesion){

            return res
                .status(401)
                .json({
                    success:false,
                    mensaje:
                        "Sesión no válida o vencida"
                });

        }

        if(
            !rolesPermitidos
                .includes(
                    sesion.rol
                )
        ){

            return res
                .status(403)
                .json({
                    success:false,
                    mensaje:
                        "No tienes permiso para realizar esta acción"
                });

        }

        req.sesion =
            sesion;

        next();

    };

}


function obtenerCantidadSesiones(){

    return sesiones.size;

}


module.exports = {

    leerCookies,

    obtenerSesion,

    crearSesion,

    cerrarSesionToken,

    cerrarSesionesUsuario,

    limpiarSesionesVencidas,

    requerirAdmin,

    requerirRoles,

    obtenerCantidadSesiones

};