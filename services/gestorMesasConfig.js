const db = require("../database/db");

class GestorMesasConfig {

    listarTodas(){

        return new Promise((resolve, reject)=>{

            db.all(
                `
                SELECT
                    mc.numero,
                    mc.nombre,
                    mc.activo,
                    mc.permiteTurnos,
                    mc.orden,

                    COALESCE(
                        me.estado,
                        'disponible'
                    ) AS estado,

                    me.motivo

                FROM mesas_config mc

                LEFT JOIN mesas_estado me
                    ON me.numero=mc.numero

                ORDER BY
                    mc.orden ASC,
                    mc.numero ASC
                `,
                [],
                (err, filas)=>{

                    if(err){
                        reject(err);
                        return;
                    }

                    resolve(filas);

                }
            );

        });

    }


    buscarPorNumero(numero){

        return new Promise((resolve, reject)=>{

            db.get(
                `
                SELECT
                    numero,
                    nombre,
                    activo,
                    permiteTurnos,
                    orden

                FROM mesas_config

                WHERE numero=?
                LIMIT 1
                `,
                [numero],
                (err, fila)=>{

                    if(err){
                        reject(err);
                        return;
                    }

                    resolve(fila || null);

                }
            );

        });

    }


    obtenerSiguienteNumero(){

        return new Promise((resolve, reject)=>{

            db.get(
                `
                SELECT
                    COALESCE(
                        MAX(numero),
                        0
                    ) + 1 AS siguiente

                FROM mesas_config
                `,
                [],
                (err, fila)=>{

                    if(err){
                        reject(err);
                        return;
                    }

                    resolve(
                        Number(fila.siguiente)
                    );

                }
            );

        });

    }


    crear(datos){

        return new Promise((resolve, reject)=>{

            db.serialize(()=>{

                db.run(
                    "BEGIN TRANSACTION"
                );

                db.run(
                    `
                    INSERT INTO mesas_config
                    (
                        numero,
                        nombre,
                        activo,
                        permiteTurnos,
                        orden
                    )
                    VALUES (?, ?, 1, 1, ?)
                    `,
                    [
                        datos.numero,
                        datos.nombre,
                        datos.orden
                    ],
                    errorMesa => {

                        if(errorMesa){

                            db.run("ROLLBACK");
                            reject(errorMesa);
                            return;

                        }

                        db.run(
                            `
                            INSERT OR IGNORE INTO mesas_estado
                            (
                                numero,
                                estado
                            )
                            VALUES (?, 'disponible')
                            `,
                            [
                                datos.numero
                            ],
                            errorEstado => {

                                if(errorEstado){

                                    db.run("ROLLBACK");
                                    reject(errorEstado);
                                    return;

                                }

                                db.run(
                                    "COMMIT",
                                    errorCommit => {

                                        if(errorCommit){
                                            reject(errorCommit);
                                            return;
                                        }

                                        resolve();

                                    }
                                );

                            }
                        );

                    }
                );

            });

        });

    }


    actualizar(numero, datos){

        return new Promise((resolve, reject)=>{

            db.run(
                `
                UPDATE mesas_config
                SET
                    nombre=?,
                    activo=?,
                    permiteTurnos=?,
                    orden=?,
                    fechaActualizacion=CURRENT_TIMESTAMP

                WHERE numero=?
                `,
                [
                    datos.nombre,
                    datos.activo ? 1 : 0,
                    datos.permiteTurnos ? 1 : 0,
                    datos.orden,
                    numero
                ],
                function(err){

                    if(err){
                        reject(err);
                        return;
                    }

                    resolve(this.changes);

                }
            );

        });

    }

}

module.exports = new GestorMesasConfig();