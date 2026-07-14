const db = require("../database/db");

class GestorTurnos {

    buscarPrimerTurno(tramites){

        return new Promise((resolve,reject)=>{

            db.get(

                `
                SELECT *
                FROM turnos
                WHERE estado='espera'
                AND tramite IN (${tramites.map(()=>"?").join(",")})
                ORDER BY id ASC
                LIMIT 1
                `,

                tramites,

                (err,row)=>{

                    if(err){

                        reject(err);
                        return;

                    }

                    resolve(row);

                }

            );

        });

    }


    contarPendientes(tramite){

        return new Promise((resolve,reject)=>{

            db.get(

                `
                SELECT COUNT(*) total
                FROM turnos
                WHERE estado='espera'
                AND tramite=?
                `,

                [tramite],

                (err,row)=>{

                    if(err){

                        reject(err);
                        return;

                    }

                    resolve(row.total);

                }

            );

        });

    }

    marcarAtendiendo(id, mesa){

        return new Promise((resolve,reject)=>{

            db.run(

                `
                UPDATE turnos
                SET
                    estado='atendiendo',
                    mesa=?,
                    fechaLlamado=CURRENT_TIMESTAMP
                WHERE id=?
                `,

                [mesa,id],

                function(err){

                    if(err){

                        reject(err);
                        return;

                    }

                    resolve();

                }

            );

        });

    }


    finalizarTurno(id){

        return new Promise((resolve, reject)=>{

            db.run(

                `
                UPDATE turnos
                SET
                    estado='finalizado',
                    fechaFinalizado=CURRENT_TIMESTAMP
                WHERE id=?
                AND estado='atendiendo'
                `,

                [id],

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

    obtenerEstadisticasDia(){

        return new Promise((resolve,reject)=>{

            db.all(

                `
                SELECT
                    tramite,
                    COUNT(*) AS total,
                    AVG(
                        (julianday(fechaLlamado) - julianday(fechaCreacion))
                        * 24 * 60
                    ) AS esperaPromedioMinutos,
                    AVG(
                        (julianday(fechaFinalizado) - julianday(fechaLlamado))
                        * 24 * 60
                    ) AS atencionPromedioMinutos
                FROM turnos
                WHERE date(fechaCreacion) = date('now','localtime')
                GROUP BY tramite
                ORDER BY tramite
                `,

                [],

                (err, rows)=>{

                    if(err){
                        reject(err);
                        return;
                    }

                    resolve(rows);

                }

            );

        });

    }

    obtenerTurnoActualMesa(mesa){

        return new Promise((resolve, reject)=>{

            db.get(

                `
                SELECT
                    id,
                    codigo,
                    tramite,
                    estado,
                    mesa

                FROM turnos

                WHERE
                    mesa=?
                    AND estado='atendiendo'
                    AND date(fechaCreacion)=date('now','localtime')

                ORDER BY id DESC
                LIMIT 1
                `,

                [mesa],

                (err, turno)=>{

                    if(err){
                        reject(err);
                        return;
                    }

                    resolve(turno || null);

                }

            );

        });

    }

    obtenerResumenDia(){

    return new Promise((resolve,reject)=>{

        db.get(

            `
            SELECT

                COUNT(*) AS generados,

                SUM(
                    CASE
                        WHEN estado='espera'
                        THEN 1
                        ELSE 0
                    END
                ) AS pendientes,

                SUM(
                    CASE
                        WHEN estado='atendiendo'
                        THEN 1
                        ELSE 0
                    END
                ) AS atendiendo,

                SUM(
                    CASE
                        WHEN estado='finalizado'
                        THEN 1
                        ELSE 0
                    END
                ) AS finalizados,

                ROUND(
                    AVG(
                        CASE
                            WHEN fechaLlamado IS NOT NULL
                            THEN
                                (
                                    julianday(fechaLlamado)
                                    -
                                    julianday(fechaCreacion)
                                ) * 1440
                        END
                    ),
                    2
                ) AS esperaPromedioMinutos,

                ROUND(
                    AVG(
                        CASE
                            WHEN
                                fechaLlamado IS NOT NULL
                                AND fechaFinalizado IS NOT NULL
                            THEN
                                (
                                    julianday(fechaFinalizado)
                                    -
                                    julianday(fechaLlamado)
                                ) * 1440
                        END
                    ),
                    2
                ) AS atencionPromedioMinutos

            FROM turnos

            WHERE
                date(fechaCreacion)
                =
                date('now','localtime')
            `,

            [],

            (err,row)=>{

                if(err){
                    reject(err);
                    return;
                }

                resolve(row);

            }

        );

    });

}


obtenerColasDia(){

    return new Promise((resolve,reject)=>{

        db.all(

            `
            SELECT
                tramite,
                COUNT(*) AS total

            FROM turnos

            WHERE
                estado='espera'
                AND date(fechaCreacion)
                    =
                    date('now','localtime')

            GROUP BY tramite

            ORDER BY total DESC
            `,

            [],

            (err,rows)=>{

                if(err){
                    reject(err);
                    return;
                }

                resolve(rows);

            }

        );

    });

}


obtenerMesasActuales(){

    return new Promise((resolve, reject)=>{

        db.all(
            `
            SELECT
                me.numero,
                me.estado AS estadoOperativo,
                me.motivo,

                t.id AS turnoId,
                t.codigo,
                t.tramite,
                t.fechaLlamado

            FROM mesas_estado me

            LEFT JOIN turnos t
                ON t.id = (

                    SELECT id
                    FROM turnos

                    WHERE
                        mesa = me.numero
                        AND estado = 'atendiendo'
                        AND date(fechaCreacion)
                            =
                            date('now','localtime')

                    ORDER BY id DESC
                    LIMIT 1

                )

            ORDER BY me.numero ASC
            `,
            [],
            (err, rows)=>{

                if(err){
                    reject(err);
                    return;
                }

                const mesas = rows.map(fila => {

                    const tieneTurno =
                        Boolean(fila.turnoId);

                    return {

                        numero:
                            Number(fila.numero),

                        estadoOperativo:
                            fila.estadoOperativo
                            || "disponible",

                        motivo:
                            fila.motivo || null,

                        estado:
                            tieneTurno
                                ? "atendiendo"
                                : fila.estadoOperativo,

                        codigo:
                            tieneTurno
                                ? fila.codigo
                                : null,

                        tramite:
                            tieneTurno
                                ? fila.tramite
                                : null

                    };

                });

                resolve(mesas);

            }
        );

    });

}

obtenerTurnosDia(){

    return new Promise((resolve, reject)=>{

        db.all(

            `
            SELECT
                codigo,
                tramite,
                estado,
                mesa,
                fechaCreacion,
                fechaLlamado,
                fechaFinalizado,

                ROUND(
                    CASE
                        WHEN fechaLlamado IS NOT NULL
                        THEN (
                            julianday(fechaLlamado)
                            - julianday(fechaCreacion)
                        ) * 1440
                    END,
                    2
                ) AS tiempoEsperaMinutos,

                ROUND(
                    CASE
                        WHEN fechaFinalizado IS NOT NULL
                        AND fechaLlamado IS NOT NULL
                        THEN (
                            julianday(fechaFinalizado)
                            - julianday(fechaLlamado)
                        ) * 1440
                    END,
                    2
                ) AS tiempoAtencionMinutos

            FROM turnos

            WHERE
                date(fechaCreacion)
                =
                date('now','localtime')

            ORDER BY id ASC
            `,

            [],

            (err, rows)=>{

                if(err){
                    reject(err);
                    return;
                }

                resolve(rows);

            }

        );

    });

}

liberarMesas(){

    return new Promise((resolve, reject)=>{

        db.run(

            `
            UPDATE turnos
            SET
                estado='finalizado',
                fechaFinalizado=COALESCE(
                    fechaFinalizado,
                    CURRENT_TIMESTAMP
                )
            WHERE estado='atendiendo'
            `,

            [],

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

cerrarJornada(){

    return new Promise((resolve, reject)=>{

        db.serialize(()=>{

            db.run("BEGIN TRANSACTION");

            db.run(

                `
                UPDATE turnos
                SET
                    estado='finalizado',
                    fechaFinalizado=COALESCE(
                        fechaFinalizado,
                        CURRENT_TIMESTAMP
                    )
                WHERE
                    estado='atendiendo'
                    AND date(fechaCreacion)
                        =
                        date('now','localtime')
                `,

                [],

                function(errorAtendiendo){

                    if(errorAtendiendo){

                        db.run("ROLLBACK");
                        reject(errorAtendiendo);
                        return;

                    }

                    const finalizados =
                        this.changes;

                    db.run(

                        `
                        UPDATE turnos
                        SET
                            estado='cancelado',
                            fechaFinalizado=COALESCE(
                                fechaFinalizado,
                                CURRENT_TIMESTAMP
                            )
                        WHERE
                            estado='espera'
                            AND date(fechaCreacion)
                                =
                                date('now','localtime')
                        `,

                        [],

                        function(errorEspera){

                            if(errorEspera){

                                db.run("ROLLBACK");
                                reject(errorEspera);
                                return;

                            }

                            const cancelados =
                                this.changes;

                            db.run(
                                "COMMIT",
                                (errorCommit)=>{

                                    if(errorCommit){

                                        reject(errorCommit);
                                        return;

                                    }

                                    resolve({
                                        finalizados,
                                        cancelados
                                    });

                                }
                            );

                        }

                    );

                }

            );

        });

    });

}

reiniciarFolios(){

    return new Promise((resolve, reject)=>{

        db.run(
            `
            UPDATE folios
            SET
                ultimoNumero=0,
                fechaReinicio=CURRENT_TIMESTAMP
            `,
            [],
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

module.exports = new GestorTurnos();