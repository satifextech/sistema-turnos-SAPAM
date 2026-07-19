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

construirFiltrosHistorial(filtros = {}){

    const condiciones = [];
    const parametros = [];

    const codigo =
        String(
            filtros.codigo || ""
        )
            .trim()
            .toUpperCase();

    const fechaInicio =
        String(
            filtros.fechaInicio || ""
        ).trim();

    const fechaFin =
        String(
            filtros.fechaFin || ""
        ).trim();

    const tramite =
        String(
            filtros.tramite || ""
        )
            .trim()
            .toUpperCase();

    const estado =
        String(
            filtros.estado || ""
        )
            .trim()
            .toLowerCase();

    const mesa =
        Number(
            filtros.mesa
        );

    if(codigo){

        condiciones.push(
            "UPPER(t.codigo) LIKE ?"
        );

        parametros.push(
            `%${codigo}%`
        );

    }

    if(fechaInicio){

        condiciones.push(
            `
            date(
                t.fechaCreacion,
                'localtime'
            ) >= date(?)
            `
        );

        parametros.push(
            fechaInicio
        );

    }

    if(fechaFin){

        condiciones.push(
            `
            date(
                t.fechaCreacion,
                'localtime'
            ) <= date(?)
            `
        );

        parametros.push(
            fechaFin
        );

    }

    if(tramite){

        condiciones.push(
            "t.tramite = ?"
        );

        parametros.push(
            tramite
        );

    }

    if(estado){

        condiciones.push(
            "t.estado = ?"
        );

        parametros.push(
            estado
        );

    }

    if(
        Number.isInteger(mesa)
        && mesa > 0
    ){

        condiciones.push(
            "t.mesa = ?"
        );

        parametros.push(
            mesa
        );

    }

    const where =
        condiciones.length
            ? `WHERE ${condiciones.join(" AND ")}`
            : "";

    return {
        where,
        parametros
    };

}


consultarHistorialTurnos(
    filtros = {}
){

    return new Promise(
        async (resolve, reject)=>{

            try{

                const paginaRecibida =
                    Number(
                        filtros.pagina
                    );

                const limiteRecibido =
                    Number(
                        filtros.limite
                    );

                const pagina =
                    Number.isInteger(
                        paginaRecibida
                    )
                    && paginaRecibida > 0
                        ? paginaRecibida
                        : 1;

                const limite =
                    Number.isInteger(
                        limiteRecibido
                    )
                    && limiteRecibido >= 10
                    && limiteRecibido <= 100
                        ? limiteRecibido
                        : 25;

                const desplazamiento =
                    (pagina - 1)
                    * limite;

                const {
                    where,
                    parametros
                } =
                    this.construirFiltrosHistorial(
                        filtros
                    );

                const consultarTotal =
                    new Promise(
                        (resolver, rechazar)=>{

                            db.get(
                                `
                                SELECT
                                    COUNT(*) AS total,

                                    SUM(
                                        CASE
                                            WHEN t.estado='espera'
                                            THEN 1
                                            ELSE 0
                                        END
                                    ) AS espera,

                                    SUM(
                                        CASE
                                            WHEN t.estado='atendiendo'
                                            THEN 1
                                            ELSE 0
                                        END
                                    ) AS atendiendo,

                                    SUM(
                                        CASE
                                            WHEN t.estado='finalizado'
                                            THEN 1
                                            ELSE 0
                                        END
                                    ) AS finalizados,

                                    SUM(
                                        CASE
                                            WHEN t.estado='cancelado'
                                            THEN 1
                                            ELSE 0
                                        END
                                    ) AS cancelados

                                FROM turnos t

                                ${where}
                                `,
                                parametros,
                                (error, fila)=>{

                                    if(error){

                                        rechazar(error);
                                        return;

                                    }

                                    resolver({
                                        total:
                                            Number(
                                                fila?.total
                                                || 0
                                            ),

                                        espera:
                                            Number(
                                                fila?.espera
                                                || 0
                                            ),

                                        atendiendo:
                                            Number(
                                                fila?.atendiendo
                                                || 0
                                            ),

                                        finalizados:
                                            Number(
                                                fila?.finalizados
                                                || 0
                                            ),

                                        cancelados:
                                            Number(
                                                fila?.cancelados
                                                || 0
                                            )
                                    });

                                }
                            );

                        }
                    );

                const consultarTurnos =
                    new Promise(
                        (resolver, rechazar)=>{

                            db.all(
                                `
                                SELECT
                                    t.id,
                                    t.codigo,
                                    t.tramite,

                                    COALESCE(
                                        tc.nombre,
                                        t.tramite
                                    ) AS nombreTramite,

                                    t.estado,
                                    t.mesa,

                                    CASE
                                        WHEN t.mesa IS NULL
                                        THEN NULL
                                        ELSE COALESCE(
                                            mc.nombre,
                                            'Mesa ' || t.mesa
                                        )
                                    END AS nombreMesa,

                                    t.fechaCreacion,
                                    t.fechaLlamado,
                                    t.fechaFinalizado,

                                    ROUND(
                                        CASE
                                            WHEN
                                                t.fechaLlamado
                                                IS NOT NULL
                                            THEN
                                                (
                                                    julianday(
                                                        t.fechaLlamado
                                                    )
                                                    -
                                                    julianday(
                                                        t.fechaCreacion
                                                    )
                                                ) * 1440
                                        END,
                                        2
                                    ) AS tiempoEsperaMinutos,

                                    ROUND(
                                        CASE
                                            WHEN
                                                t.fechaLlamado
                                                IS NOT NULL
                                                AND
                                                t.fechaFinalizado
                                                IS NOT NULL
                                            THEN
                                                (
                                                    julianday(
                                                        t.fechaFinalizado
                                                    )
                                                    -
                                                    julianday(
                                                        t.fechaLlamado
                                                    )
                                                ) * 1440
                                        END,
                                        2
                                    ) AS tiempoAtencionMinutos

                                FROM turnos t

                                LEFT JOIN tramites_config tc
                                    ON tc.codigo=t.tramite

                                LEFT JOIN mesas_config mc
                                    ON mc.numero=t.mesa

                                ${where}

                                ORDER BY
                                    t.id DESC

                                LIMIT ?
                                OFFSET ?
                                `,
                                [
                                    ...parametros,
                                    limite,
                                    desplazamiento
                                ],
                                (error, filas)=>{

                                    if(error){

                                        rechazar(error);
                                        return;

                                    }

                                    resolver(
                                        filas || []
                                    );

                                }
                            );

                        }
                    );

                const [
                    resumen,
                    turnos
                ] =
                    await Promise.all([
                        consultarTotal,
                        consultarTurnos
                    ]);

                const totalPaginas =
                    resumen.total > 0
                        ? Math.ceil(
                            resumen.total
                            / limite
                        )
                        : 1;

                resolve({
                    turnos,
                    resumen,
                    paginacion:{
                        pagina,
                        limite,
                        totalResultados:
                            resumen.total,
                        totalPaginas
                    }
                });

            }catch(error){

                reject(error);

            }

        }
    );

}


obtenerHistorialParaExportar(
    filtros = {}
){

    return new Promise(
        (resolve, reject)=>{

            const {
                where,
                parametros
            } =
                this.construirFiltrosHistorial(
                    filtros
                );

            db.all(
                `
                SELECT
                    t.codigo,

                    COALESCE(
                        tc.nombre,
                        t.tramite
                    ) AS nombreTramite,

                    t.estado,

                    CASE
                        WHEN t.mesa IS NULL
                        THEN NULL
                        ELSE COALESCE(
                            mc.nombre,
                            'Mesa ' || t.mesa
                        )
                    END AS nombreMesa,

                    t.fechaCreacion,
                    t.fechaLlamado,
                    t.fechaFinalizado,

                    ROUND(
                        CASE
                            WHEN
                                t.fechaLlamado
                                IS NOT NULL
                            THEN
                                (
                                    julianday(
                                        t.fechaLlamado
                                    )
                                    -
                                    julianday(
                                        t.fechaCreacion
                                    )
                                ) * 1440
                        END,
                        2
                    ) AS tiempoEsperaMinutos,

                    ROUND(
                        CASE
                            WHEN
                                t.fechaLlamado
                                IS NOT NULL
                                AND
                                t.fechaFinalizado
                                IS NOT NULL
                            THEN
                                (
                                    julianday(
                                        t.fechaFinalizado
                                    )
                                    -
                                    julianday(
                                        t.fechaLlamado
                                    )
                                ) * 1440
                        END,
                        2
                    ) AS tiempoAtencionMinutos

                FROM turnos t

                LEFT JOIN tramites_config tc
                    ON tc.codigo=t.tramite

                LEFT JOIN mesas_config mc
                    ON mc.numero=t.mesa

                ${where}

                ORDER BY
                    t.id DESC
                `,
                parametros,
                (error, filas)=>{

                    if(error){

                        reject(error);
                        return;

                    }

                    resolve(
                        filas || []
                    );

                }
            );

        }
    );

}

}

module.exports = new GestorTurnos();