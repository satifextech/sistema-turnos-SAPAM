const db =
    require("../database/db");


class GestorVideos {


    listarTodos(){

        return new Promise(
            (resolve, reject)=>{

                db.all(
                    `
                    SELECT
                        id,
                        nombreArchivo,
                        nombreVisible,
                        activo,
                        orden,
                        tamañoBytes,
                        tipoMime,
                        fechaCreacion,
                        fechaActualizacion

                    FROM videos_pantalla

                    ORDER BY
                        orden ASC,
                        id ASC
                    `,
                    [],
                    (error, filas)=>{

                        if(error){

                            reject(error);
                            return;

                        }

                        resolve(
                            (filas || [])
                                .map(
                                    fila =>
                                        this.formatearVideo(
                                            fila
                                        )
                                )
                        );

                    }
                );

            }
        );

    }


    listarActivos(){

        return new Promise(
            (resolve, reject)=>{

                db.all(
                    `
                    SELECT
                        id,
                        nombreArchivo,
                        nombreVisible,
                        activo,
                        orden,
                        tamañoBytes,
                        tipoMime,
                        fechaCreacion,
                        fechaActualizacion

                    FROM videos_pantalla

                    WHERE activo=1

                    ORDER BY
                        orden ASC,
                        id ASC
                    `,
                    [],
                    (error, filas)=>{

                        if(error){

                            reject(error);
                            return;

                        }

                        resolve(
                            (filas || [])
                                .map(
                                    fila =>
                                        this.formatearVideo(
                                            fila
                                        )
                                )
                        );

                    }
                );

            }
        );

    }


    buscarPorId(
        id
    ){

        return new Promise(
            (resolve, reject)=>{

                db.get(
                    `
                    SELECT
                        id,
                        nombreArchivo,
                        nombreVisible,
                        activo,
                        orden,
                        tamañoBytes,
                        tipoMime,
                        fechaCreacion,
                        fechaActualizacion

                    FROM videos_pantalla

                    WHERE id=?

                    LIMIT 1
                    `,
                    [
                        id
                    ],
                    (error, fila)=>{

                        if(error){

                            reject(error);
                            return;

                        }

                        resolve(
                            fila
                                ? this.formatearVideo(
                                    fila
                                )
                                : null
                        );

                    }
                );

            }
        );

    }


    obtenerSiguienteOrden(){

        return new Promise(
            (resolve, reject)=>{

                db.get(
                    `
                    SELECT
                        COALESCE(
                            MAX(orden),
                            0
                        ) + 1
                        AS siguiente

                    FROM videos_pantalla
                    `,
                    [],
                    (error, fila)=>{

                        if(error){

                            reject(error);
                            return;

                        }

                        resolve(
                            Number(
                                fila?.siguiente
                                || 1
                            )
                        );

                    }
                );

            }
        );

    }


    crear(
        datos
    ){

        return new Promise(
            (resolve, reject)=>{

                db.run(
                    `
                    INSERT INTO videos_pantalla
                    (
                        nombreArchivo,
                        nombreVisible,
                        activo,
                        orden,
                        tamañoBytes,
                        tipoMime,
                        fechaCreacion,
                        fechaActualizacion
                    )
                    VALUES (
                        ?,
                        ?,
                        1,
                        ?,
                        ?,
                        ?,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    `,
                    [
                        datos.nombreArchivo,
                        datos.nombreVisible,
                        datos.orden,
                        datos.tamañoBytes,
                        datos.tipoMime
                    ],
                    function(error){

                        if(error){

                            reject(error);
                            return;

                        }

                        resolve({
                            id:
                                this.lastID
                        });

                    }
                );

            }
        );

    }


    actualizar(
        id,
        datos
    ){

        return new Promise(
            (resolve, reject)=>{

                db.run(
                    `
                    UPDATE videos_pantalla

                    SET
                        nombreVisible=?,
                        activo=?,
                        orden=?,
                        fechaActualizacion=
                            CURRENT_TIMESTAMP

                    WHERE id=?
                    `,
                    [
                        datos.nombreVisible,
                        datos.activo
                            ? 1
                            : 0,
                        datos.orden,
                        id
                    ],
                    function(error){

                        if(error){

                            reject(error);
                            return;

                        }

                        resolve(
                            this.changes
                        );

                    }
                );

            }
        );

    }


    eliminar(
        id
    ){

        return new Promise(
            (resolve, reject)=>{

                db.run(
                    `
                    DELETE FROM videos_pantalla
                    WHERE id=?
                    `,
                    [
                        id
                    ],
                    function(error){

                        if(error){

                            reject(error);
                            return;

                        }

                        resolve(
                            this.changes
                        );

                    }
                );

            }
        );

    }


    formatearVideo(
        fila
    ){

        return {

            id:
                Number(
                    fila.id
                ),

            nombreArchivo:
                fila.nombreArchivo,

            nombreVisible:
                fila.nombreVisible,

            activo:
                Number(
                    fila.activo
                ) === 1,

            orden:
                Number(
                    fila.orden
                    || 0
                ),

            tamañoBytes:
                Number(
                    fila.tamañoBytes
                    || 0
                ),

            tipoMime:
                fila.tipoMime
                || "video/mp4",

            fechaCreacion:
                fila.fechaCreacion,

            fechaActualizacion:
                fila.fechaActualizacion,

            url:
                `/assets/videos/${
                    encodeURIComponent(
                        fila.nombreArchivo
                    )
                }`

        };

    }


}


module.exports =
    new GestorVideos();