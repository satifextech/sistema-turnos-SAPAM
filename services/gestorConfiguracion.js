const db =
    require("../database/db");


class GestorConfiguracion {


    obtenerTodas(){

        return new Promise(
            (resolve, reject)=>{

                db.all(
                    `
                    SELECT
                        clave,
                        valor,
                        descripcion,
                        fechaActualizacion

                    FROM configuracion_sistema

                    ORDER BY clave ASC
                    `,
                    [],
                    (error, filas)=>{

                        if(error){

                            reject(error);
                            return;

                        }

                        const configuracion = {};

                        for(const fila of filas){

                            configuracion[
                                fila.clave
                            ] =
                                fila.valor;

                        }

                        resolve(
                            configuracion
                        );

                    }
                );

            }
        );

    }


    obtenerPorClave(
        clave
    ){

        return new Promise(
            (resolve, reject)=>{

                db.get(
                    `
                    SELECT
                        clave,
                        valor,
                        descripcion,
                        fechaActualizacion

                    FROM configuracion_sistema

                    WHERE clave=?

                    LIMIT 1
                    `,
                    [
                        clave
                    ],
                    (error, fila)=>{

                        if(error){

                            reject(error);
                            return;

                        }

                        resolve(
                            fila || null
                        );

                    }
                );

            }
        );

    }


    guardar(
        clave,
        valor,
        descripcion = null
    ){

        return new Promise(
            (resolve, reject)=>{

                db.run(
                    `
                    INSERT INTO configuracion_sistema
                    (
                        clave,
                        valor,
                        descripcion,
                        fechaActualizacion
                    )
                    VALUES (
                        ?,
                        ?,
                        ?,
                        CURRENT_TIMESTAMP
                    )

                    ON CONFLICT(clave)
                    DO UPDATE SET

                        valor=
                            excluded.valor,

                        descripcion=
                            COALESCE(
                                excluded.descripcion,
                                configuracion_sistema.descripcion
                            ),

                        fechaActualizacion=
                            CURRENT_TIMESTAMP
                    `,
                    [
                        clave,
                        String(valor),
                        descripcion
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


    async obtenerLimitesAlertas(){

        const configuracion =
            await this.obtenerTodas();

        return {

            colaAdvertencia:
                this.convertirNumero(
                    configuracion
                        .alerta_cola_advertencia,
                    5
                ),

            colaCritica:
                this.convertirNumero(
                    configuracion
                        .alerta_cola_critica,
                    10
                ),

            esperaAdvertencia:
                this.convertirNumero(
                    configuracion
                        .alerta_espera_advertencia,
                    10
                ),

            esperaCritica:
                this.convertirNumero(
                    configuracion
                        .alerta_espera_critica,
                    20
                )

        };

    }


    convertirNumero(
        valor,
        respaldo
    ){

        const numero =
            Number(valor);

        if(
            !Number.isFinite(numero)
            || numero < 1
        ){

            return respaldo;

        }

        return numero;

    }


    async guardarLimitesAlertas(
        limites
    ){

        await Promise.all([

            this.guardar(
                "alerta_cola_advertencia",
                limites.colaAdvertencia
            ),

            this.guardar(
                "alerta_cola_critica",
                limites.colaCritica
            ),

            this.guardar(
                "alerta_espera_advertencia",
                limites.esperaAdvertencia
            ),

            this.guardar(
                "alerta_espera_critica",
                limites.esperaCritica
            )

        ]);

        return this.obtenerLimitesAlertas();

    }

    convertirVolumen(
        valor,
        respaldo
    ){

        const numero =
            Number(valor);

        if(
            !Number.isFinite(numero)
        ){

            return respaldo;

        }

        return Math.max(
            0,
            Math.min(
                100,
                Math.round(numero)
            )
        );

    }


    convertirBooleano(
        valor,
        respaldo = false
    ){

        if(
            valor === true
            || valor === 1
            || valor === "1"
            || valor === "true"
        ){

            return true;

        }

        if(
            valor === false
            || valor === 0
            || valor === "0"
            || valor === "false"
        ){

            return false;

        }

        return respaldo;

    }


    async obtenerConfiguracionMultimedia(){

        const configuracion =
            await this.obtenerTodas();

        return {

            volumenVoz:
                this.convertirVolumen(
                    configuracion
                        .volumen_voz,
                    100
                ),

            volumenVideo:
                this.convertirVolumen(
                    configuracion
                        .volumen_video,
                    35
                ),

            vozSilenciada:
                this.convertirBooleano(
                    configuracion
                        .voz_silenciada,
                    false
                ),

            videoSilenciado:
                this.convertirBooleano(
                    configuracion
                        .video_silenciado,
                    false
                )

        };

    }


    async guardarConfiguracionMultimedia(
        configuracion
    ){

        await Promise.all([

            this.guardar(
                "volumen_voz",
                configuracion.volumenVoz,
                "Volumen de los anuncios de voz de la pantalla"
            ),

            this.guardar(
                "volumen_video",
                configuracion.volumenVideo,
                "Volumen normal de los videos de la pantalla"
            ),

            this.guardar(
                "voz_silenciada",
                configuracion.vozSilenciada
                    ? "1"
                    : "0",
                "Indica si los anuncios de voz están silenciados"
            ),

            this.guardar(
                "video_silenciado",
                configuracion.videoSilenciado
                    ? "1"
                    : "0",
                "Indica si los videos están silenciados"
            )

        ]);

        return this
            .obtenerConfiguracionMultimedia();

    }


}


module.exports =
    new GestorConfiguracion();