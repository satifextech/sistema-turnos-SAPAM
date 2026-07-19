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
                WHERE date(fechaCreacion, 'localtime') = date('now','localtime')
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
                    AND date(fechaCreacion, 'localtime')=date('now','localtime')

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
                date(fechaCreacion, 'localtime')
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

    return new Promise(
        (resolve, reject)=>{

            db.all(
                `
                SELECT
                    t.tramite,

                    COALESCE(
                        tc.nombre,
                        t.tramite
                    ) AS nombreTramite,

                    COUNT(*) AS total

                FROM turnos t

                LEFT JOIN tramites_config tc
                    ON tc.codigo=t.tramite

                WHERE
                    t.estado='espera'
                    AND date(
                        t.fechaCreacion,
                        'localtime'
                    )
                    =
                    date(
                        'now',
                        'localtime'
                    )

                GROUP BY
                    t.tramite,
                    tc.nombre

                ORDER BY
                    total DESC,
                    nombreTramite ASC
                `,
                [],
                (err, rows)=>{

                    if(err){

                        reject(err);
                        return;

                    }

                    resolve(
                        rows.map(
                            fila => ({

                                tramite:
                                    fila.tramite,

                                nombreTramite:
                                    fila.nombreTramite
                                    || fila.tramite,

                                total:
                                    Number(
                                        fila.total || 0
                                    )

                            })
                        )
                    );

                }
            );

        }
    );

}


obtenerMesasActuales(){

    return new Promise((resolve, reject)=>{

        db.all(
            `
            SELECT
                mc.numero,
                mc.nombre,
                mc.activo,
                mc.permiteTurnos,

                COALESCE(
                    me.estado,
                    'disponible'
                ) AS estadoOperativo,

                me.motivo,

                t.id AS turnoId,
                t.codigo,
                t.tramite,

                COALESCE(
                    tc.nombre,
                    t.tramite
                ) AS nombreTramite,

                t.fechaLlamado

            FROM mesas_config mc

            LEFT JOIN mesas_estado me
                ON me.numero=mc.numero

            LEFT JOIN turnos t
                ON t.id = (

                    SELECT id

                    FROM turnos

                    WHERE
                        mesa=mc.numero
                        AND estado='atendiendo'
                        AND date(
                            fechaCreacion,
                            'localtime'
                        )
                        =
                        date(
                            'now',
                            'localtime'
                        )

                    ORDER BY id DESC
                    LIMIT 1

                )
                
            LEFT JOIN tramites_config tc
                ON tc.codigo=t.tramite

            ORDER BY
                mc.orden ASC,
                mc.numero ASC
            `,
            [],
            (err, rows)=>{

                if(err){
                    reject(err);
                    return;
                }

                const mesas =
                    rows.map(fila => {

                        const tieneTurno =
                            Boolean(
                                fila.turnoId
                            );

                        const habilitada =
                            Number(fila.activo) === 1
                            &&
                            Number(
                                fila.permiteTurnos
                            ) === 1;

                        return {

                            numero:
                                Number(
                                    fila.numero
                                ),

                            nombre:
                                fila.nombre
                                || `Mesa ${fila.numero}`,

                            activo:
                                Number(
                                    fila.activo
                                ),

                            permiteTurnos:
                                Number(
                                    fila.permiteTurnos
                                ),

                            estadoOperativo:
                                habilitada
                                    ? fila.estadoOperativo
                                    : "deshabilitada",

                            motivo:
                                habilitada
                                    ? fila.motivo || null
                                    : "Punto de atención deshabilitado",

                            estado:
                                tieneTurno
                                    ? "atendiendo"
                                    : habilitada
                                        ? fila.estadoOperativo
                                        : "deshabilitada",

                            codigo:
                                tieneTurno
                                    ? fila.codigo
                                    : null,

                            tramite:
                                tieneTurno
                                    ? fila.tramite
                                    : null,

                            nombreTramite:
                                tieneTurno
                                    ? fila.nombreTramite
                                        || fila.tramite
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
                date(fechaCreacion, 'localtime')
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

obtenerUltimosTurnosPantalla(
    limite = 5
){

    return new Promise(
        (resolve, reject)=>{

            const cantidad =
                Number.isInteger(
                    Number(limite)
                )
                && Number(limite) > 0
                    ? Math.min(
                        Number(limite),
                        20
                    )
                    : 5;

            db.all(
                `
                SELECT
                    t.id,
                    t.codigo,
                    t.tramite,
                    t.mesa,
                    t.fechaLlamado,

                    tc.nombre AS nombreTramite,

                    mc.nombre AS nombreMesa

                FROM turnos t

                LEFT JOIN tramites_config tc
                    ON tc.codigo=t.tramite

                LEFT JOIN mesas_config mc
                    ON mc.numero=t.mesa

                WHERE
                    t.fechaLlamado IS NOT NULL
                    AND t.mesa IS NOT NULL
                    AND date(
                        t.fechaCreacion,
                        'localtime'
                    )
                    =
                    date(
                        'now',
                        'localtime'
                    )

                ORDER BY
                    t.fechaLlamado DESC,
                    t.id DESC

                LIMIT ?
                `,
                [cantidad],
                (err, filas)=>{

                    if(err){

                        reject(err);
                        return;

                    }

                    const turnos =
                        filas.map(
                            fila => ({

                                id:
                                    Number(
                                        fila.id
                                    ),

                                codigo:
                                    fila.codigo,

                                tramite:
                                    fila.tramite,

                                nombreTramite:
                                    fila.nombreTramite
                                    || fila.tramite
                                    || "",

                                mesa:
                                    Number(
                                        fila.mesa
                                    ),

                                nombreMesa:
                                    fila.nombreMesa
                                    || `Mesa ${fila.mesa}`,

                                fechaLlamado:
                                    fila.fechaLlamado

                            })
                        );

                    resolve(turnos);

                }
            );

        }
    );

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
                    AND date(fechaCreacion, 'localtime')
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
                            AND date(fechaCreacion, 'localtime')
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