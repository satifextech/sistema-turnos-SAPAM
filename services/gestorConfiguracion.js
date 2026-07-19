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


}


module.exports =
    new GestorConfiguracion();