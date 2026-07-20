const db = require("../database/db");

class GestorReglas {

    listarConfiguracionCompleta(){

        return new Promise(
            (resolve, reject)=>{

                db.all(
                    `
                    SELECT
                        tc.codigo,
                        tc.nombre,
                        tc.prefijo,

                        COALESCE(
                            rt.limiteApoyo,
                            5
                        ) AS limiteApoyo,

                        COALESCE(
                            rt.activo,
                            1
                        ) AS reglaActiva,

                        rm.mesa,
                        rm.tipo,
                        rm.orden,
                        rm.activo,

                        mc.nombre AS nombreMesa,
                        mc.activo AS mesaActiva,
                        mc.permiteTurnos

                    FROM tramites_config tc

                    LEFT JOIN reglas_tramites rt
                        ON rt.tramite=tc.codigo

                    LEFT JOIN reglas_mesas rm
                        ON rm.tramite=tc.codigo
                        AND rm.activo=1

                    LEFT JOIN mesas_config mc
                        ON mc.numero=rm.mesa

                    WHERE
                        tc.activo=1

                    ORDER BY
                        tc.orden ASC,
                        tc.nombre ASC,

                        CASE
                            WHEN rm.tipo='prioridad'
                            THEN 1

                            WHEN rm.tipo='apoyo'
                            THEN 2

                            ELSE 3
                        END,

                        rm.orden ASC,
                        rm.mesa ASC
                    `,
                    [],
                    (error, filas)=>{

                        if(error){

                            reject(error);
                            return;

                        }

                        const tramites =
                            new Map();

                        for(
                            const fila
                            of filas
                        ){

                            if(
                                !tramites.has(
                                    fila.codigo
                                )
                            ){

                                tramites.set(
                                    fila.codigo,
                                    {
                                        codigo:
                                            fila.codigo,

                                        nombre:
                                            fila.nombre,

                                        prefijo:
                                            fila.prefijo,

                                        limiteApoyo:
                                            Number(
                                                fila.limiteApoyo
                                                || 5
                                            ),

                                        reglaActiva:
                                            Number(
                                                fila.reglaActiva
                                            ),

                                        prioridad:[],

                                        apoyo:[]
                                    }
                                );

                            }

                            /*
                            Un trámite puede no tener todavía
                            mesas configuradas. En ese caso,
                            rm.mesa será NULL y no agregamos
                            ninguna asignación.
                            */
                            if(
                                fila.mesa === null
                                ||
                                fila.mesa === undefined
                            ){

                                continue;

                            }

                            const asignacion = {

                                mesa:
                                    Number(
                                        fila.mesa
                                    ),

                                tipo:
                                    fila.tipo,

                                orden:
                                    Number(
                                        fila.orden
                                        || 0
                                    ),

                                activo:
                                    Number(
                                        fila.activo
                                    ),

                                nombreMesa:
                                    fila.nombreMesa
                                    || `Mesa ${fila.mesa}`,

                                mesaActiva:
                                    Number(
                                        fila.mesaActiva
                                        || 0
                                    ),

                                permiteTurnos:
                                    Number(
                                        fila.permiteTurnos
                                        || 0
                                    )

                            };

                            const tramite =
                                tramites.get(
                                    fila.codigo
                                );

                            if(
                                fila.tipo
                                === "prioridad"
                            ){

                                tramite.prioridad.push(
                                    asignacion
                                );

                            }else if(
                                fila.tipo
                                === "apoyo"
                            ){

                                tramite.apoyo.push(
                                    asignacion
                                );

                            }

                        }

                        resolve(
                            Array.from(
                                tramites.values()
                            )
                        );

                    }
                );

            }
        );

    }

    obtenerAsignaciones(tramite){

        return new Promise((resolve, reject)=>{

            db.all(
                `
                SELECT
                    rm.mesa,
                    rm.tipo,
                    rm.orden,
                    rm.activo,

                    mc.nombre AS nombreMesa,
                    mc.activo AS mesaActiva,
                    mc.permiteTurnos

                FROM reglas_mesas rm

                LEFT JOIN mesas_config mc
                    ON mc.numero=rm.mesa

                WHERE
                    rm.tramite=?
                    AND rm.activo=1

                ORDER BY
                    CASE
                        WHEN rm.tipo='prioridad'
                        THEN 1
                        ELSE 2
                    END,
                    rm.orden ASC,
                    rm.mesa ASC
                `,
                [tramite],
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


    obtenerReglaTramite(tramite){

        return new Promise((resolve, reject)=>{

            db.get(
                `
                SELECT
                    tramite,
                    limiteApoyo,
                    activo

                FROM reglas_tramites

                WHERE tramite=?
                LIMIT 1
                `,
                [tramite],
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


    asegurarReglaTramite(
        tramite,
        limiteApoyo = 5
    ){

        return new Promise((resolve, reject)=>{

            db.run(
                `
                INSERT OR IGNORE INTO reglas_tramites
                (
                    tramite,
                    limiteApoyo,
                    activo
                )
                VALUES (?, ?, 1)
                `,
                [
                    tramite,
                    limiteApoyo
                ],
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


    guardarConfiguracion(
        tramite,
        limiteApoyo,
        prioridad,
        apoyo
    ){

        return new Promise((resolve, reject)=>{

            db.serialize(()=>{

                db.run(
                    "BEGIN IMMEDIATE TRANSACTION"
                );

                db.run(
                    `
                    INSERT INTO reglas_tramites
                    (
                        tramite,
                        limiteApoyo,
                        activo,
                        fechaActualizacion
                    )
                    VALUES (?, ?, 1, CURRENT_TIMESTAMP)

                    ON CONFLICT(tramite)
                    DO UPDATE SET
                        limiteApoyo=
                            excluded.limiteApoyo,
                        activo=1,
                        fechaActualizacion=
                            CURRENT_TIMESTAMP
                    `,
                    [
                        tramite,
                        limiteApoyo
                    ],
                    errorRegla => {

                        if(errorRegla){

                            db.run("ROLLBACK");
                            reject(errorRegla);
                            return;

                        }

                        db.run(
                            `
                            DELETE FROM reglas_mesas
                            WHERE tramite=?
                            `,
                            [tramite],
                            errorEliminar => {

                                if(errorEliminar){

                                    db.run("ROLLBACK");
                                    reject(errorEliminar);
                                    return;

                                }

                                const inserciones = [];

                                prioridad.forEach(
                                    (mesa, indice)=>{

                                        inserciones.push({
                                            mesa,
                                            tipo:"prioridad",
                                            orden:
                                                indice + 1
                                        });

                                    }
                                );

                                apoyo.forEach(
                                    (mesa, indice)=>{

                                        inserciones.push({
                                            mesa,
                                            tipo:"apoyo",
                                            orden:
                                                indice + 1
                                        });

                                    }
                                );

                                if(inserciones.length === 0){

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

                                    return;

                                }

                                let pendientes =
                                    inserciones.length;

                                let fallo = false;

                                for(
                                    const asignacion
                                    of inserciones
                                ){

                                    db.run(
                                        `
                                        INSERT INTO reglas_mesas
                                        (
                                            tramite,
                                            mesa,
                                            tipo,
                                            orden,
                                            activo
                                        )
                                        VALUES (?, ?, ?, ?, 1)
                                        `,
                                        [
                                            tramite,
                                            asignacion.mesa,
                                            asignacion.tipo,
                                            asignacion.orden
                                        ],
                                        errorInsertar => {

                                            if(fallo){
                                                return;
                                            }

                                            if(errorInsertar){

                                                fallo = true;

                                                db.run(
                                                    "ROLLBACK"
                                                );

                                                reject(
                                                    errorInsertar
                                                );

                                                return;

                                            }

                                            pendientes--;

                                            if(pendientes === 0){

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

                                        }
                                    );

                                }

                            }
                        );

                    }
                );

            });

        });

    }


    obtenerReglasParaMesa(numeroMesa){

        return new Promise((resolve, reject)=>{

            db.all(
                `
                SELECT
                    rm.tramite,
                    rm.tipo,
                    rm.orden,
                    rt.limiteApoyo,

                    tc.nombre,
                    tc.activo AS tramiteActivo

                FROM reglas_mesas rm

                INNER JOIN reglas_tramites rt
                    ON rt.tramite=rm.tramite

                INNER JOIN tramites_config tc
                    ON tc.codigo=rm.tramite

                WHERE
                    rm.mesa=?
                    AND rm.activo=1
                    AND rt.activo=1
                    AND tc.activo=1

                ORDER BY
                    CASE
                        WHEN rm.tipo='prioridad'
                        THEN 1
                        ELSE 2
                    END,
                    rm.orden ASC,
                    tc.orden ASC
                `,
                [numeroMesa],
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


    obtenerMesasPrioritarias(tramite){

        return new Promise((resolve, reject)=>{

            db.all(
                `
                SELECT
                    rm.mesa

                FROM reglas_mesas rm

                INNER JOIN mesas_config mc
                    ON mc.numero=rm.mesa

                LEFT JOIN mesas_estado me
                    ON me.numero=rm.mesa

                WHERE
                    rm.tramite=?
                    AND rm.tipo='prioridad'
                    AND rm.activo=1
                    AND mc.activo=1
                    AND mc.permiteTurnos=1
                    AND COALESCE(
                        me.estado,
                        'disponible'
                    )='disponible'

                ORDER BY
                    rm.orden ASC,
                    rm.mesa ASC
                `,
                [tramite],
                (err, filas)=>{

                    if(err){
                        reject(err);
                        return;
                    }

                    resolve(
                        filas.map(
                            fila =>
                                Number(fila.mesa)
                        )
                    );

                }
            );

        });

    }

}

module.exports =
    new GestorReglas();